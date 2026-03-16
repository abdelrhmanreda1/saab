import Stripe from 'stripe';
import admin from 'firebase-admin';
import { getTemplate } from './template.js';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const getFirestore = () => admin.firestore();

// Get Stripe config from Firestore
const getStripeConfig = async () => {
  const db = getFirestore();
  try {
    const settingsDoc = await db.collection('settings').doc('general').get();
    if (settingsDoc.exists) {
      // Get payment gateway config from payment_gateways collection
      const gatewaysSnapshot = await db.collection('payment_gateways')
        .where('type', '==', 'stripe')
        .where('isActive', '==', true)
        .limit(1)
        .get();
      
      if (!gatewaysSnapshot.empty) {
        const gateway = gatewaysSnapshot.docs[0].data();
        return {
          secretKey: gateway.config?.secretKey || '',
          publishableKey: gateway.config?.publishableKey || '',
          isTestMode: gateway.isTestMode || false,
        };
      }
    }
  } catch (error) {
    console.error('Error fetching Stripe config:', error);
  }

  // If no active Stripe gateway config is found in Firestore, return empty config
  return {
    secretKey: '',
    publishableKey: '',
    isTestMode: true,
  };
};

export const render_checkout = async (request, response) => {
  try {
    const config = await getStripeConfig();
    
    if (!config.secretKey || !config.publishableKey) {
      response.status(400).send({ error: 'Stripe is not configured. Please set up Stripe keys in payment gateway settings.' });
      return;
    }

    const stripe = new Stripe(config.secretKey);
    
    // Get server URL from referrer or request
    const refr = request.get('Referrer');
    const server_url = refr 
      ? ((refr.includes('checkout') || refr.includes('cart') || refr.includes('wallet'))
          ? refr.substring(0, refr.length - refr.split("/")[refr.split("/").length - 1].length) 
          : refr) 
      : request.protocol + "://" + request.get('host') + "/";

    const order_id = request.body.order_id;
    const amount = parseFloat(request.body.amount);
    const currency = request.body.currency || 'usd';
    const quantity = request.body.quantity || 1;

    if (!order_id || !amount) {
      response.status(400).send({ error: 'Missing required fields: order_id and amount' });
      return;
    }

    // Create Stripe Checkout Session
    // success_url should point to Next.js app route, which will then call Firebase Function
    const session_data = {
      success_url: server_url + 'stripe-process?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: server_url + 'cancel',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: 'Order Payment',
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: quantity,
      }],
      mode: 'payment',
      metadata: {
        order_id: order_id
      }
    };

    const session = await stripe.checkout.sessions.create(session_data);
    
    if (session) {
      response.send(getTemplate(config.publishableKey, session.id));
    } else {
      response.status(500).send({ error: 'Failed to create checkout session' });
    }
  } catch (error) {
    console.error('Error in render_checkout:', error);
    response.status(500).send({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
};

export const process_checkout = async (request, response) => {
  try {
    const config = await getStripeConfig();
    
    if (!config.secretKey) {
      response.redirect('/cancel?error=stripe_not_configured');
      return;
    }

    const stripe = new Stripe(config.secretKey);
    const session_id = request.query.session_id;

    if (!session_id) {
      response.redirect('/cancel?error=no_session_id');
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session && session.payment_status === 'paid') {
      const order_id = session.metadata.order_id;
      const transaction_id = session.payment_intent;
      const amount = session.amount_total / 100; // Convert from cents

      const db = getFirestore();
      
      // Check if order exists
      const orderRef = db.collection('orders').doc(order_id);
      const orderDoc = await orderRef.get();

      if (orderDoc.exists) {
        // Update order with payment info and change status to Processing
        await orderRef.update({
          paymentStatus: 'paid',
          paymentMethod: 'stripe',
          paymentIntentId: transaction_id,
          paymentTransactionId: transaction_id,
          paymentDate: admin.firestore.FieldValue.serverTimestamp(),
          status: 'processing', // Change from Pending to Processing after payment
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const refr = request.get('Referrer');
        const server_url = refr 
          ? refr.substring(0, refr.length - refr.split("/")[refr.split("/").length - 1].length)
          : request.protocol + "://" + request.get('host') + "/";
        
        response.redirect(`${server_url}success?order_id=${order_id}&amount=${amount}&transaction_id=${transaction_id}`);
      } else if (order_id && order_id.startsWith('wallet')) {
        // Handle wallet top-up
        const userId = order_id.substring(7, order_id.length - 12); // Extract user ID from wallet order ID
        if (userId) {
          const userRef = db.collection('users').doc(userId);
          const userDoc = await userRef.get();
          
          if (userDoc.exists) {
            const currentBalance = userDoc.data().walletBalance || 0;
            await userRef.update({
              walletBalance: currentBalance + amount
            });
            
            // Add to wallet history
            await db.collection('walletHistory').add({
              userId: userId,
              type: 'credit',
              amount: amount,
              transactionId: transaction_id,
              description: 'Wallet Top-up via Stripe',
              createdAt: new Date(),
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
    console.error('Error in process_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

