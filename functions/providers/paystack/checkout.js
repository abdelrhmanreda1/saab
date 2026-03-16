import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const getFirestoreDB = () => admin.firestore();

// Get Paystack config from Firestore
const getPaystackConfig = async () => {
  const db = getFirestoreDB();
  try {
    const gatewaysSnapshot = await db.collection('payment_gateways')
      .where('type', '==', 'paystack')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (!gatewaysSnapshot.empty) {
      const gateway = gatewaysSnapshot.docs[0].data();
      return {
        secretKey: gateway.config?.secretKey || '',
        publicKey: gateway.config?.publicKey || '',
        isTestMode: gateway.isTestMode || false,
      };
    }
  } catch (error) {
    console.error('Error fetching Paystack config:', error);
  }
  
  // Fallback to environment variable
  return {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    isTestMode: false,
  };
};

export const render_checkout = async (request, response) => {
  try {
    const config = await getPaystackConfig();
    
    if (!config.secretKey) {
      response.status(400).send({ error: 'Paystack is not configured. Please set up Paystack keys in payment gateway settings.' });
      return;
    }

    const allowedCurrencies = ["GHS", "NGN", "ZAR", "KES"];
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

    // Generate unique reference
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomKey = [...Array(4)].map(_ => c[~~(Math.random()*c.length)]).join('');
    const reference = order_id + "-" + randomKey;

    const data = {
      amount: Math.round(amount * 100), // Convert to kobo/cent
      email: email,
      currency: allowedCurrencies.includes(currency) ? currency : 'NGN',
      reference: reference,
      callback_url: server_url + 'paystack-process',
      metadata: {
        order_id: order_id
      }
    };

    const fetchResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + config.secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const json = await fetchResponse.json();

    if (json.data && json.status && json.data.authorization_url) {
      response.redirect(json.data.authorization_url);
    } else {
      response.redirect('/cancel?error=paystack_init_failed');
    }
  } catch (error) {
    console.error('Error in Paystack render_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

export const process_checkout = async (request, response) => {
  try {
    const config = await getPaystackConfig();
    
    if (!config.secretKey) {
      response.redirect('/cancel?error=paystack_not_configured');
      return;
    }

    const reference = request.query.reference || request.query.trxref;

    if (!reference) {
      response.redirect('/cancel?error=no_reference');
      return;
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.secretKey
      },
    });

    const json = await verifyResponse.json();

    if (json.status && json.data && json.data.status === 'success') {
      // Extract original order_id from reference (remove random key)
      const referenceParts = json.data.reference.split("-");
      const order_id = referenceParts.slice(0, -1).join("-");
      const transaction_id = json.data.id || reference;
      const amount = parseFloat(json.data.amount) / 100; // Convert from kobo/cent

      const db = getFirestoreDB();
      const orderRef = db.collection('orders').doc(order_id);
      const orderDoc = await orderRef.get();

      if (orderDoc.exists) {
        // Update order with payment info
        await orderRef.update({
          paymentStatus: 'paid',
          paymentMethod: 'paystack',
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
              walletBalance: currentBalance + amount
            });
            
            await db.collection('walletHistory').add({
              userId: userId,
              type: 'credit',
              amount: amount,
              transactionId: transaction_id,
              description: 'Wallet Top-up via Paystack',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        
        const refr = request.get('Referrer');
        const server_url = refr 
          ? refr.substring(0, refr.length - refr.split("/")[refr.split("/").length - 1].length)
          : request.protocol + "://" + request.get('host') + "/";
        
        response.redirect(`${server_url}success?order_id=${order_id}&amount=${amount}&transaction_id=${transaction_id}`);
      } else {
        response.redirect('/cancel?error=order_not_found');
      }
    } else {
      response.redirect('/cancel?error=payment_failed');
    }
  } catch (error) {
    console.error('Error in Paystack process_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

