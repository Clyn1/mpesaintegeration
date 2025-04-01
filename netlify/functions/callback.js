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
      statusCode: 200,
      headers
    };
  }

  try {
    // Parse the callback data
    const callbackData = JSON.parse(event.body);
    console.log('Received callback data:', JSON.stringify(callbackData, null, 2));

    // Extract relevant information
    const {
      Body: {
        stkCallback: {
          ResultCode,
          ResultDesc,
          CallbackMetadata: {
            Item: items
          }
        }
      }
    } = callbackData;

    // Convert items array to object for easier access
    const metadata = {};
    if (items) {
      items.forEach(item => {
        metadata[item.Name] = item.Value;
      });
    }

    // Log the processed data
    console.log('Processed callback data:', {
      ResultCode,
      ResultDesc,
      metadata
    });

    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Callback processed successfully'
      })
    };
  } catch (error) {
    console.error('Error processing callback:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process callback',
        details: error.message
      })
    };
  }
}; 