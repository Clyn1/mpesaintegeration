const axios = require('axios');
require('dotenv').config();

// M-Pesa API Configuration
const config = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  businessShortCode: process.env.MPESA_SHORTCODE,
  passkey: process.env.MPESA_PASSKEY,
  baseUrl: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke'
};

// Debug logging
console.log('Environment Variables Check:');
console.log('MPESA_CONSUMER_KEY exists:', !!process.env.MPESA_CONSUMER_KEY);
console.log('MPESA_CONSUMER_SECRET exists:', !!process.env.MPESA_CONSUMER_SECRET);
console.log('MPESA_SHORTCODE exists:', !!process.env.MPESA_SHORTCODE);
console.log('MPESA_PASSKEY exists:', !!process.env.MPESA_PASSKEY);
console.log('MPESA_BASE_URL:', process.env.MPESA_BASE_URL);

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Generate timestamp in the format YYYYMMDDHHmmss
function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// Generate password
function generatePassword(businessShortCode, passkey, timestamp) {
  const str = businessShortCode + passkey + timestamp;
  return Buffer.from(str).toString('base64');
}

// Get access token
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const response = await axios.get(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.response?.data || error.message);
    throw new Error('Failed to get access token');
  }
}

exports.handler = async function(event, context) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  try {
    console.log('Request body:', event.body);
    const { phone_number, amount, account_reference, transaction_desc } = JSON.parse(event.body);

    // Log environment variables (safely)
    console.log('Environment check:', {
      CONSUMER_KEY_EXISTS: !!process.env.MPESA_CONSUMER_KEY,
      CONSUMER_SECRET_EXISTS: !!process.env.MPESA_CONSUMER_SECRET,
      SHORTCODE_EXISTS: !!process.env.MPESA_SHORTCODE,
      PASSKEY_EXISTS: !!process.env.MPESA_PASSKEY,
      BASE_URL: process.env.MPESA_BASE_URL
    });

    // Validate required fields
    if (!phone_number || !amount) {
      const error = 'Missing required fields: phone_number and amount are required';
      console.error(error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error })
      };
    }

    // Validate configuration
    if (!config.consumerKey || !config.consumerSecret || !config.businessShortCode || !config.passkey) {
      const error = `Missing M-Pesa configuration: ${!config.consumerKey ? 'consumerKey ' : ''}${!config.consumerSecret ? 'consumerSecret ' : ''}${!config.businessShortCode ? 'businessShortCode ' : ''}${!config.passkey ? 'passkey' : ''}`;
      console.error(error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error })
      };
    }

    // Format phone number (remove leading 0 and add country code if needed)
    const formattedPhone = phone_number.startsWith('254') ? phone_number : phone_number.replace(/^0?/, '254');
    console.log('Formatted phone:', formattedPhone);

    // Get access token
    console.log('Attempting to get access token...');
    const accessToken = await getAccessToken();
    console.log('Access token obtained successfully');

    // Generate timestamp and password
    const timestamp = generateTimestamp();
    console.log('Generated timestamp:', timestamp);
    
    const password = generatePassword(config.businessShortCode, config.passkey, timestamp);
    console.log('Generated password successfully');

    // Prepare STK Push request
    const stkPushRequest = {
      BusinessShortCode: config.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: parseInt(amount),
      PartyA: formattedPhone,
      PartyB: config.businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: 'https://techmoms.netlify.app/.netlify/functions/callback',
      AccountReference: account_reference || 'Test',
      TransactionDesc: transaction_desc || 'Test Payment'
    };

    console.log('Prepared STK Push request:', JSON.stringify(stkPushRequest, null, 2));

    // Make STK Push request
    console.log('Sending STK Push request to:', `${config.baseUrl}/mpesa/stkpush/v1/processrequest`);
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

    console.log('STK Push response:', JSON.stringify(response.data, null, 2));

    // Check if the response indicates success
    if (response.data.ResponseCode === '0') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Payment request sent successfully',
          data: response.data
        })
      };
    } else {
      throw new Error(response.data.ResponseDescription || 'Failed to initiate payment');
    }
  } catch (error) {
    console.error('Detailed error information:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
      config: error.config ? {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers
      } : null
    });

    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to initiate payment',
        details: error.response?.data || error.message,
        errorCode: error.response?.status || 500
      })
    };
  }
}; 