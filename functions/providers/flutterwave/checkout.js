import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getTemplate } from './template.js';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const getFirestoreDB = () => admin.firestore();

// Get Flutterwave config from Firestore
const getFlutterwaveConfig = async () => {
  const db = getFirestoreDB();
  try {
    const gatewaysSnapshot = await db.collection('payment_gateways')
      .where('type', '==', 'flutterwave')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (!gatewaysSnapshot.empty) {
      const gateway = gatewaysSnapshot.docs[0].data();
      return {
        publicKey: gateway.config?.publicKey || '',
        secretKey: gateway.config?.secretKey || '',
        encryptionKey: gateway.config?.encryptionKey || '',
        isTestMode: gateway.isTestMode || false,
      };
    }
  } catch (error) {
    console.error('Error fetching Flutterwave config:', error);
  }
  
  // Fallback to environment variables
  return {
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || '',
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
    encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY || '',
    isTestMode: false,
  };
};

export const render_checkout = async (request, response) => {
  try {
    const config = await getFlutterwaveConfig();
    
    if (!config.publicKey) {
      response.status(400).send({ error: 'Flutterwave is not configured. Please set up Flutterwave keys in payment gateway settings.' });
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
    const currency = request.body.currency || 'NGN';
    const email = request.body.email || request.body.customerEmail || '';

    if (!order_id || !amount || !email) {
      response.status(400).send({ error: 'Missing required fields: order_id, amount, and email' });
      return;
    }

    const payData = {
      amount: amount,
      order_id: order_id,
      email: email,
      currency: currency
    };

    response.send(getTemplate(payData, server_url, config.publicKey));
  } catch (error) {
    console.error('Error in Flutterwave render_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

export const process_checkout = async (request, response) => {
  try {
    const config = await getFlutterwaveConfig();
    
    if (!config.secretKey) {
      response.redirect('/cancel?error=flutterwave_not_configured');
      return;
    }

    const transaction_id = request.query.transaction_id;

    if (!transaction_id) {
      response.redirect('/cancel?error=no_transaction_id');
      return;
    }

    // Verify transaction with Flutterwave
    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.secretKey}`
      },
    });

    const txData = await verifyResponse.json();

    if (txData.status === "success" && txData.data) {
      const order_id = txData.data.tx_ref;
      const transactionId = txData.data.id || transaction_id;
      const amount = txData.data.amount;

      const db = getFirestoreDB();
      const orderRef = db.collection('orders').doc(order_id);
      const orderDoc = await orderRef.get();

      if (orderDoc.exists) {
        // Update order with payment info
        await orderRef.update({
          paymentStatus: 'paid',
          paymentMethod: 'flutterwave',
          paymentTransactionId: transactionId,
          paymentDate: admin.firestore.FieldValue.serverTimestamp(),
          status: 'processing',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const refr = request.get('Referrer');
        const server_url = refr 
          ? refr.substring(0, refr.length - refr.split("/")[refr.split("/").length - 1].length)
          : request.protocol + "://" + request.get('host') + "/";
        
        response.redirect(`${server_url}success?order_id=${order_id}&amount=${amount}&transaction_id=${transactionId}`);
      } else if (order_id && order_id.startsWith('wallet')) {
        // Handle wallet top-up
        const userId = order_id.substring(7, order_id.length - 12);
        if (userId) {
          const userRef = db.collection('users').doc(userId);
          const userDoc = await userRef.get();
          
          if (userDoc.exists) {
            const currentBalance = userDoc.data().walletBalance || 0;
            await userRef.update({
              walletBalance: currentBalance + amount
            });
            
            await db.collection('walletHistory').add({
              userId: userId,
              type: 'credit',
              amount: amount,
              transactionId: transactionId,
              description: 'Wallet Top-up via Flutterwave',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        
        const refr = request.get('Referrer');
        const server_url = refr 
          ? refr.substring(0, refr.length - refr.split("/")[refr.split("/").length - 1].length)
          : request.protocol + "://" + request.get('host') + "/";
        
        response.redirect(`${server_url}success?order_id=${order_id}&amount=${amount}&transaction_id=${transactionId}`);
      } else {
        response.redirect('/cancel?error=order_not_found');
      }
    } else {
      response.redirect('/cancel?error=payment_failed');
    }
  } catch (error) {
    console.error('Error in Flutterwave process_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

