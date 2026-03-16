import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getTemplate } from './template.js';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const getFirestoreDB = () => admin.firestore();

// Get PayPal config from Firestore
const getPayPalConfig = async () => {
  const db = getFirestoreDB();
  try {
    const gatewaysSnapshot = await db.collection('payment_gateways')
      .where('type', '==', 'paypal')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    console.log('PayPal gateways found:', gatewaysSnapshot.size);
    
    if (!gatewaysSnapshot.empty) {
      const gateway = gatewaysSnapshot.docs[0].data();
      const gatewayId = gatewaysSnapshot.docs[0].id;
      
      console.log('PayPal Gateway ID:', gatewayId);
      console.log('PayPal Gateway Data:', JSON.stringify(gateway, null, 2));
      console.log('PayPal Gateway Config:', JSON.stringify(gateway.config, null, 2));
      
      const clientId = gateway.config?.clientId || '';
      const clientSecret = gateway.config?.clientSecret || '';
      const environment = gateway.config?.environment || (gateway.isTestMode ? 'sandbox' : 'production');
      
      console.log('Extracted Client ID:', clientId ? (clientId.substring(0, 20) + '... (length: ' + clientId.length + ')') : 'EMPTY');
      console.log('Extracted Environment:', environment);
      console.log('Is Test Mode:', gateway.isTestMode);
      
      // Trim whitespace from client ID
      const trimmedClientId = clientId.trim();
      
      return {
        clientId: trimmedClientId,
        clientSecret: clientSecret.trim(),
        environment: environment,
        isTestMode: gateway.isTestMode || false,
      };
    } else {
      console.log('No active PayPal gateway found in Firestore');
    }
  } catch (error) {
    console.error('Error fetching PayPal config:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
    });
  }
  
  // Fallback to environment variables
  console.log('Falling back to environment variables');
  const envClientId = process.env.PAYPAL_CLIENT_ID || '';
  console.log('Env Client ID:', envClientId ? (envClientId.substring(0, 20) + '... (length: ' + envClientId.length + ')') : 'NOT SET');
  
  return {
    clientId: envClientId.trim(),
    clientSecret: (process.env.PAYPAL_CLIENT_SECRET || '').trim(),
    environment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
    isTestMode: true,
  };
};

export const render_checkout = async (request, response) => {
  try {
    const config = await getPayPalConfig();
    
    if (!config.clientId) {
      response.status(400).send({ error: 'PayPal is not configured. Please set up PayPal keys in payment gateway settings.' });
      return;
    }

    const refr = request.get('Referrer');
    const server_url = refr 
      ? ((refr.includes('checkout') || refr.includes('cart') || refr.includes('wallet'))
          ? refr.substring(0, refr.length - refr.split("/")[refr.split("/").length - 1].length) 
          : refr) 
      : request.protocol + "://" + request.get('host') + "/";

    const order_id = request.body.order_id;
    const amount = parseFloat(request.body.amount);
    const currency = request.body.currency || 'USD';

    if (!order_id || !amount) {
      response.status(400).send({ error: 'Missing required fields: order_id and amount' });
      return;
    }

    // Use client ID from config
    const clientId = config.clientId;
    
    // Log for debugging
    console.log('=== PayPal Render Checkout ===');
    console.log('Client ID (first 20 chars):', clientId ? clientId.substring(0, 20) : 'NOT SET');
    console.log('Client ID Length:', clientId ? clientId.length : 0);
    console.log('Client ID (full):', clientId);
    console.log('Environment:', config.environment);
    console.log('Test Mode:', config.isTestMode);
    console.log('==============================');

    if (!clientId || clientId.trim() === '') {
      response.status(400).send(`
        <html>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1>PayPal Configuration Error</h1>
            <p>PayPal Client ID is not configured. Please set up PayPal Client ID in payment gateway settings.</p>
            <p><a href="${server_url}checkout">Return to Checkout</a></p>
          </body>
        </html>
      `);
      return;
    }

    // Validate PayPal Client ID format
    // PayPal Client IDs are typically 80 characters long and contain alphanumeric characters
    const trimmedClientId = clientId.trim();
    if (trimmedClientId.length < 20 || trimmedClientId.length > 200) {
      console.error('Invalid PayPal Client ID length:', trimmedClientId.length);
      response.status(400).send(`
        <html>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1>PayPal Configuration Error</h1>
            <p>Invalid PayPal Client ID format. Client ID should be between 20-200 characters.</p>
            <p>Current length: ${trimmedClientId.length}</p>
            <p>Please check your PayPal Client ID in payment gateway settings.</p>
            <p><a href="${server_url}checkout">Return to Checkout</a></p>
          </body>
        </html>
      `);
      return;
    }

    // Validate and encode client ID for URL
    if (!clientId || clientId.trim() === '') {
      response.status(400).send(`
        <html>
          <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1>PayPal Configuration Error</h1>
            <p>PayPal Client ID is empty or not configured.</p>
            <p>Please set up PayPal Client ID in payment gateway settings.</p>
            <p><a href="${server_url}checkout">Return to Checkout</a></p>
          </body>
        </html>
      `);
      return;
    }

    // Set proper content type and send template
    // Note: clientId is already validated and trimmed, template will handle URL encoding
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.status(200).send(getTemplate(server_url, clientId.trim(), order_id, amount.toFixed(2), currency));
  } catch (error) {
    console.error('Error in PayPal render_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

export const process_checkout = async (request, response) => {
  try {
    console.log('PayPal process_checkout called');
    console.log('Query params:', request.query);
    
    const config = await getPayPalConfig();
    
    if (!config.clientId || !config.clientSecret) {
      console.error('PayPal not configured');
      response.redirect('/cancel?error=paypal_not_configured');
      return;
    }

    const order_id = request.query.order_id;
    const transaction_id = request.query.id;
    const amount = request.query.amount;

    console.log('Processing order:', order_id, 'Transaction:', transaction_id);

    if (!order_id || !transaction_id) {
      console.error('Missing required params');
      response.redirect('/cancel?error=missing_params');
      return;
    }

    const paypal_endpoint = config.environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    console.log('PayPal endpoint:', paypal_endpoint);
    console.log('Verifying transaction:', transaction_id);

    // Verify payment with PayPal
    const auth = Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64');
    const verifyResponse = await fetch(`${paypal_endpoint}/v2/checkout/orders/${transaction_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth
      },
    });

    if (!verifyResponse.ok) {
      console.error('PayPal verification failed:', verifyResponse.status, await verifyResponse.text());
      response.redirect('/cancel?error=paypal_verification_failed');
      return;
    }

    const data = await verifyResponse.json();
    console.log('PayPal verification response:', data.status);

    if (data.status === 'COMPLETED') {
      const db = getFirestoreDB();
      const orderRef = db.collection('orders').doc(order_id);
      const orderDoc = await orderRef.get();

      if (orderDoc.exists) {
        // Update order with payment info
        await orderRef.update({
          paymentStatus: 'paid',
          paymentMethod: 'paypal',
          paymentTransactionId: transaction_id,
          paymentDate: admin.firestore.FieldValue.serverTimestamp(),
          status: 'processing',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const refr = request.get('Referrer');
        const server_url = refr 
          ? refr.substring(0, refr.length - refr.split("/")[refr.split("/").length - 1].length)
          : request.protocol + "://" + request.get('host') + "/";
        
        response.redirect(`${server_url}success?order_id=${order_id}&amount=${amount}&transaction_id=${transaction_id}`);
      } else if (order_id && order_id.startsWith('wallet')) {
        // Handle wallet top-up
        const userId = order_id.substring(7, order_id.length - 12);
        if (userId) {
          const userRef = db.collection('users').doc(userId);
          const userDoc = await userRef.get();
          
          if (userDoc.exists) {
            const currentBalance = userDoc.data().walletBalance || 0;
            await userRef.update({
              walletBalance: currentBalance + parseFloat(amount)
            });
            
            await db.collection('walletHistory').add({
              userId: userId,
              type: 'credit',
              amount: parseFloat(amount),
              transactionId: transaction_id,
              description: 'Wallet Top-up via PayPal',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        
        // Get server URL from referrer or construct from request
        const refr2 = request.get('Referrer') || request.get('referer');
        let server_url2 = '';
        
        if (refr2) {
          try {
            const url = new URL(refr2);
            server_url2 = `${url.protocol}//${url.host}/`;
          } catch {
            server_url2 = refr2.substring(0, refr2.length - refr2.split("/")[refr2.split("/").length - 1].length);
          }
        } else {
          server_url2 = request.protocol + "://" + request.get('host') + "/";
        }
        
        console.log('Redirecting to success (wallet):', `${server_url2}success?order_id=${order_id}&amount=${amount}&transaction_id=${transaction_id}`);
        response.redirect(`${server_url2}success?order_id=${order_id}&amount=${amount}&transaction_id=${transaction_id}`);
      } else {
        console.error('Order not found:', order_id);
        response.redirect('/cancel?error=order_not_found');
      }
    } else {
      console.error('PayPal payment not completed. Status:', data.status);
      response.redirect('/cancel?error=payment_failed');
    }
  } catch (error) {
    console.error('Error in PayPal process_checkout:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Get server URL for redirect
    const refr = request.get('Referrer') || request.get('referer');
    let server_url = '/';
    if (refr) {
      try {
        const url = new URL(refr);
        server_url = `${url.protocol}//${url.host}/`;
      } catch {
        server_url = '/';
      }
    }
    
    response.redirect(`${server_url}cancel?error=` + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

