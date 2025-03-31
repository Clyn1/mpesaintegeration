exports.handler = async function(event, context) {
  try {
    const callbackData = JSON.parse(event.body);

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

      // Here you would typically update your database with the transaction details
      // For now, we'll just log it
      console.log('Transaction successful:', {
        merchantRequestID,
        amount,
        mpesaReceiptNumber,
        transactionDate,
        phoneNumber
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          ResultCode: 0,
          ResultDesc: 'Success'
        })
      };
    } else {
      // Payment failed
      console.log('Transaction failed:', {
        merchantRequestID,
        error: callbackData.Body?.stkCallback?.ResultDesc
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          ResultCode: resultCode,
          ResultDesc: callbackData.Body?.stkCallback?.ResultDesc
        })
      };
    }
  } catch (error) {
    console.error('Callback processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ResultCode: 1,
        ResultDesc: 'Failed to process callback'
      })
    };
  }
}; 