const axios = require('axios');
require('dotenv').config();

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
    console.log('Getting access token...');
    console.log('Consumer Key:', config.consumerKey);
    console.log('Consumer Secret:', config.consumerSecret);
    
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    const response = await axios.get(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });
    
    console.log('Access token response:', response.data);
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to get access token: ' + (error.response ? JSON.stringify(error.response.data) : error.message));
  }
};

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  try {
    console.log('Request body:', event.body);
    const { phone_number, amount, account_reference, transaction_desc } = JSON.parse(event.body);

    // Validate required fields
    if (!phone_number || !amount) {
      console.error('Missing required fields');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required fields: phone_number and amount are required'
        })
      };
    }

    // Format phone number (remove leading 0 and add country code if needed)
    const formattedPhone = phone_number.replace(/^0/, '254');
    console.log('Formatted phone:', formattedPhone);

    // Get access token
    const accessToken = await getAccessToken();
    console.log('Access token obtained');

    // Generate timestamp and password
    const timestamp = generateTimestamp();
    const password = generatePassword(config.businessShortCode, config.passkey, timestamp);

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
      CallBackURL: `${process.env.URL || 'https://techmoms.netlify.app'}/.netlify/functions/callback`,
      AccountReference: account_reference || 'Test',
      TransactionDesc: transaction_desc || 'Test Payment'
    };

    console.log('STK Push request:', stkPushRequest);

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

    console.log('STK Push response:', response.data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('STK Push error:', error.response ? error.response.data : error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to initiate payment',
        details: error.response ? error.response.data : error.message
      })
    };
  }
}; 