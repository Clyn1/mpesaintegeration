# M-Pesa Integration with Firebase Functions

This project provides a Netlify-compatible solution for M-Pesa integration using Firebase Functions. It includes both the backend (Firebase Functions) and frontend (static HTML) components

## Prerequisites

1. Node.js (v18 or later)
2. Firebase CLI (`npm install -g firebase-tools`)
3. M-Pesa Daraja API credentials
4. Firebase account and project
5. Netlify account

## Setup Instructions

1. **Firebase Setup**
   ```bash
   # Login to Firebase
   firebase login

   # Initialize Firebase project
   firebase init

   # Select the following options:
   # - Functions
   # - JavaScript
   # - No to ESLint
   # - Yes to installing dependencies
   ```

2. **Environment Variables**
   Create a `.env` file in the `functions` directory with your M-Pesa credentials:
   ```
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_SHORTCODE=your_shortcode
   MPESA_PASSKEY=your_passkey
   MPESA_BASE_URL=https://sandbox.safaricom.co.ke
   ```

3. **Install Dependencies**
   ```bash
   cd functions
   npm install
   ```

4. **Deploy Firebase Functions**
   ```bash
   firebase deploy --only functions
   ```

5. **Update Frontend**
   - Open `public/index.html`
   - Replace `YOUR_FIREBASE_FUNCTION_URL` with your actual Firebase Function URL

6. **Deploy to Netlify**
   - Connect your GitHub repository to Netlify
   - Set the build command to: `echo "No build required"`
   - Set the publish directory to: `public`

## Project Structure

```
firebase-mpesa/
├── functions/
│   ├── index.js           # Firebase Functions code
│   ├── package.json       # Functions dependencies
│   └── .env              # Environment variables
├── public/
│   └── index.html        # Frontend interface
└── README.md
```

## Features

- STK Push integration
- Transaction logging in Firestore
- Callback handling
- CORS support
- Error handling
- Responsive UI

## Testing

1. Use the sandbox environment first
2. Test with test phone numbers provided by Safaricom
3. Monitor Firebase Functions logs for debugging

## Going Live

1. Update `MPESA_BASE_URL` to production URL
2. Update Firebase project settings
3. Deploy to production
4. Test thoroughly with real transactions

## Security Considerations

1. Keep your API credentials secure
2. Use environment variables
3. Implement proper validation
4. Use HTTPS only
5. Monitor Firebase logs.

## Support

For issues or questions, refer to:
- [Firebase Documentation](https://firebase.google.com/docs)
- [M-Pesa Daraja API Documentation](https://developer.safaricom.co.ke/docs)
- [Netlify Documentation](https://docs.netlify.com/) 
