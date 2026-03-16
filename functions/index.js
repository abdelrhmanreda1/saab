/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/v2/https";
import { nextjs } from './nextjs.js';
import { scheduledReportsRunner } from './scheduled-reports.js';
import { stripeLink, stripeProcess } from './providers/stripe/index.js';
import { paystackLink, paystackProcess } from './providers/paystack/index.js';
import { razorpayLink, razorpayProcess } from './providers/razorpay/index.js';
import { paypalLink, paypalProcess } from './providers/paypal/index.js';
import { flutterwaveLink, flutterwaveProcess } from './providers/flutterwave/index.js';
import { sendWhatsAppOrderNotification } from './whatsapp-orders.js';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export { nextjs, scheduledReportsRunner };
// Export payment provider functions
export { stripeLink, stripeProcess };
export { paystackLink, paystackProcess };
export { razorpayLink, razorpayProcess };
export { paypalLink, paypalProcess };
export { flutterwaveLink, flutterwaveProcess };
export { sendWhatsAppOrderNotification };

// Success page endpoint
export const success = onRequest(async (request, response) => {
  const db = getFirestore();
  try {
    // Get default language
    const languagesSnapshot = await db.collection('languages')
      .where('default', '==', true)
      .limit(1)
      .get();
    
    let language = {
      payment_of: 'Payment of',
      was_successful: 'was successful',
      order_no: 'Order No:',
      transaction_id: 'Transaction ID:',
      success_payment: 'Payment Successful',
      payment_thanks: 'Thank you for your payment!',
    };
    
    if (!languagesSnapshot.empty) {
      const langData = languagesSnapshot.docs[0].data();
      if (langData.translations && langData.translations.EN) {
        language = langData.translations.EN;
      }
    }

    const amount = request.query.amount || '';
    const order_id = request.query.order_id || '';
    const transaction_id = request.query.transaction_id || '';
    
    const amount_line = amount ? `<h3>${language.payment_of || 'Payment of'} <strong>$${amount}</strong> ${language.was_successful || 'was successful'}</h3>` : '';
    const order_line = order_id ? `<h5>${language.order_no || 'Order No:'} ${order_id}</h5>` : '';
    const transaction_line = transaction_id ? `<h6>${language.transaction_id || 'Transaction ID:'} ${transaction_id}</h6>` : '';
    
    response.status(200).send(`
      <!DOCTYPE HTML>
      <html>
      <head> 
          <meta name='viewport' content='width=device-width, initial-scale=1.0'> 
          <title>${language.success_payment || 'Payment Successful'}</title> 
          <style> 
              body { font-family: Verdana, Geneva, Tahoma, sans-serif; } 
              h3, h6, h4 { margin: 0px; } 
              .container { display: flex; justify-content: center; align-items: center; width: 100%; height: 100vh; padding: 60px 0; } 
              .contentDiv { padding: 40px; box-shadow: 0px 0px 12px 0px rgba(0, 0, 0, 0.3); border-radius: 10px; width: 70%; margin: 0px auto; text-align: center; } 
              .contentDiv img { width: 140px; display: block; margin: 0px auto; margin-bottom: 10px; } 
              .contentDiv h3 { font-size: 22px; } 
              .contentDiv h6 { font-size: 13px; margin: 5px 0; } 
              .contentDiv h4 { font-size: 16px; } 
          </style>
      </head>
      <body> 
          <div class='container'>
              <div class='contentDiv'> 
                  <img src='https://cdn.pixabay.com/photo/2012/05/07/02/13/accept-47587_960_720.png' alt='Icon'> 
                  ${amount_line}
                  ${order_line}
                  ${transaction_line}
                  <h4>${language.payment_thanks || 'Thank you for your payment!'}</h4>
              </div>
          </div>
          <script type="text/JavaScript">setTimeout("location.href = '/orders';",5000);</script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in success page:', error);
    response.status(200).send(`
      <!DOCTYPE HTML>
      <html>
      <head><title>Payment Successful</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>Payment Successful</h1>
        <p>Thank you for your payment!</p>
        <script>setTimeout("location.href = '/orders';",5000);</script>
      </body>
      </html>
    `);
  }
});

// Cancel page endpoint
export const cancel = onRequest(async (request, response) => {
  const db = getFirestore();
  try {
    // Get default language
    const languagesSnapshot = await db.collection('languages')
      .where('default', '==', true)
      .limit(1)
      .get();
    
    let language = {
      payment_cancelled: 'Payment Cancelled',
      payment_fail: 'Payment Failed',
      try_again: 'Please try again',
    };
    
    if (!languagesSnapshot.empty) {
      const langData = languagesSnapshot.docs[0].data();
      if (langData.translations && langData.translations.EN) {
        language = langData.translations.EN;
      }
    }
    
    response.send(`
      <!DOCTYPE HTML>
      <html>
      <head> 
          <meta name='viewport' content='width=device-width, initial-scale=1.0'> 
          <title>${language.payment_cancelled || 'Payment Cancelled'}</title> 
          <style> 
              body { font-family: Verdana, Geneva, Tahoma, sans-serif; } 
              .container { display: flex; justify-content: center; align-items: center; width: 100%; height: 100vh; padding: 60px 0; } 
              .contentDiv { padding: 40px; box-shadow: 0px 0px 12px 0px rgba(0, 0, 0, 0.3); border-radius: 10px; width: 70%; margin: 0px auto; text-align: center; } 
              .contentDiv img { width: 140px; display: block; margin: 0px auto; margin-bottom: 10px; } 
              h3, h6, h4 { margin: 0px; } 
              .contentDiv h3 { font-size: 22px; } 
              .contentDiv h6 { font-size: 13px; margin: 5px 0; } 
              .contentDiv h4 { font-size: 16px; } 
          </style>
      </head>
      <body> 
          <div class='container'> 
              <div class='contentDiv'> 
                  <img src='https://cdn.pixabay.com/photo/2012/05/07/02/13/cancel-47588_960_720.png' alt='Icon'> 
                  <h3>${language.payment_fail || 'Payment Failed'}</h3> 
                  <h4>${language.try_again || 'Please try again'}</h4>
              </div> 
          </div>
          <script type="text/JavaScript">setTimeout("location.href = '/checkout';",5000);</script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in cancel page:', error);
    response.send(`
      <!DOCTYPE HTML>
      <html>
      <head><title>Payment Cancelled</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>Payment Cancelled</h1>
        <p>Please try again</p>
        <script>setTimeout("location.href = '/checkout';",5000);</script>
      </body>
      </html>
    `);
  }
});

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});
