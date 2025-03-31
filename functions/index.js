const functions = require('firebase-functions');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
admin.initializeApp();

// M-Pesa API Configuration
const config = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  businessShortCode: process.env.MPESA_SHORTCODE,
  passkey: process.env.MPESA_PASSKEY,
  baseUrl: process.env.MPESA_BASE_URL
};

// Generate timestamp in the required format
const generateTimestamp = () => {
  return new Date().toISOString().replace(/[-T:.Z]/g, '');
};

// Generate password for STK Push
const generatePassword = (shortcode, passkey, timestamp) => {
  return Buffer.from(shortcode + passkey + timestamp).toString('base64');
};

// Get M-Pesa access token
const getAccessToken = async () => {
  try {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const response = await axios.get(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error('Failed to get access token');
  }
};

// STK Push function
exports.stkPush = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { phone_number, amount, account_reference, transaction_desc } = req.body;

    // Validate required fields
    if (!phone_number || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: phone_number and amount are required'
      });
    }

    // Format phone number (remove leading 0 and add country code if needed)
    const formattedPhone = phone_number.replace(/^0/, '254');

    // Get access token
    const accessToken = await getAccessToken();

    // Generate timestamp and password
    const timestamp = generateTimestamp();
    const password = generatePassword(config.businessShortCode, config.passkey, timestamp);

    // Prepare STK Push request
    const stkPushRequest = {
      BusinessShortCode: config.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: config.businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${req.protocol}://${req.get('host')}/callback`,
      AccountReference: account_reference || 'Payment',
      TransactionDesc: transaction_desc || 'Payment for services'
    };

    // Make STK Push request
    const response = await axios.post(
      `${config.baseUrl}/mpesa/stkpush/v1/processrequest`,
      stkPushRequest,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Log the transaction attempt
    await admin.firestore().collection('transactions').add({
      phone_number: formattedPhone,
      amount,
      merchant_request_id: response.data.MerchantRequestID,
      checkout_request_id: response.data.CheckoutRequestID,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });

    res.json(response.data);
  } catch (error) {
    console.error('STK Push error:', error);
    res.status(500).json({
      error: 'Failed to initiate payment',
      details: error.message
    });
  }
});

// Callback function to handle M-Pesa responses
exports.callback = functions.https.onRequest(async (req, res) => {
  try {
    const callbackData = req.body;

    // Log the callback
    console.log('Received callback:', JSON.stringify(callbackData, null, 2));

    // Extract relevant information
    const resultCode = callbackData.Body?.stkCallback?.ResultCode;
    const merchantRequestID = callbackData.Body?.stkCallback?.MerchantRequestID;

    if (resultCode === 0) {
      // Payment successful
      const callbackMetadata = callbackData.Body.stkCallback.CallbackMetadata.Item;
      const amount = callbackMetadata.find(item => item.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = callbackMetadata.find(item => item.Name === 'TransactionDate')?.Value;
      const phoneNumber = callbackMetadata.find(item => item.Name === 'PhoneNumber')?.Value;

      // Update transaction in Firestore
      const transactionsRef = admin.firestore().collection('transactions');
      const querySnapshot = await transactionsRef
        .where('merchant_request_id', '==', merchantRequestID)
        .get();

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        await doc.ref.update({
          status: 'success',
          mpesa_receipt_number: mpesaReceiptNumber,
          transaction_date: transactionDate,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({
        ResultCode: 0,
        ResultDesc: 'Success'
      });
    } else {
      // Payment failed
      const transactionsRef = admin.firestore().collection('transactions');
      const querySnapshot = await transactionsRef
        .where('merchant_request_id', '==', merchantRequestID)
        .get();

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        await doc.ref.update({
          status: 'failed',
          error_message: callbackData.Body?.stkCallback?.ResultDesc,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({
        ResultCode: resultCode,
        ResultDesc: callbackData.Body?.stkCallback?.ResultDesc
      });
    }
  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({
      ResultCode: 1,
      ResultDesc: 'Failed to process callback'
    });
  }
}); 