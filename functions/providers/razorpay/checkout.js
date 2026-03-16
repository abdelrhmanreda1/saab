import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const getFirestoreDB = () => admin.firestore();

// Get Razorpay config from Firestore
const getRazorpayConfig = async () => {
  const db = getFirestoreDB();
  try {
    const gatewaysSnapshot = await db.collection('payment_gateways')
      .where('type', '==', 'razorpay')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (!gatewaysSnapshot.empty) {
      const gateway = gatewaysSnapshot.docs[0].data();
      return {
        keyId: gateway.config?.keyId || '',
        keySecret: gateway.config?.keySecret || '',
        isTestMode: gateway.isTestMode || false,
      };
    }
  } catch (error) {
    console.error('Error fetching Razorpay config:', error);
  }
  
  // Fallback to environment variables
  return {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    isTestMode: false,
  };
};

export const render_checkout = async (request, response) => {
  try {
    const config = await getRazorpayConfig();
    
    if (!config.keyId || !config.keySecret) {
      response.status(400).send({ error: 'Razorpay is not configured. Please set up Razorpay keys in payment gateway settings.' });
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
    const email = request.body.email || request.body.customerEmail || '';
    const phone = request.body.phone || request.body.customerPhone || '';
    const name = request.body.name || request.body.customerName || '';

    if (!order_id || !amount || !email) {
      response.status(400).send({ error: 'Missing required fields: order_id, amount, and email' });
      return;
    }

    // Generate unique reference
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomKey = [...Array(4)].map(_ => c[~~(Math.random()*c.length)]).join('');
    const reference_id = order_id + "-" + randomKey;

    const nameParts = name.split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    const data = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      reference_id: reference_id,
      description: `Order ${order_id}`,
      customer: {
        name: name || first_name + " " + last_name,
        contact: phone,
        email: email
      },
      callback_url: server_url + "razorpay-process",
      callback_method: "get",
      notes: {
        order_id: order_id
      }
    };

    // Create Basic Auth header
    const auth = Buffer.from(config.keyId + ':' + config.keySecret).toString('base64');

    const fetchResponse = await fetch("https://api.razorpay.com/v1/payment_links/", {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const json = await fetchResponse.json();

    if (json.short_url) {
      response.redirect(json.short_url);
    } else {
      response.redirect('/cancel?error=razorpay_init_failed');
    }
  } catch (error) {
    console.error('Error in Razorpay render_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

export const process_checkout = async (request, response) => {
  try {
    const config = await getRazorpayConfig();
    
    if (!config.keyId || !config.keySecret) {
      response.redirect('/cancel?error=razorpay_not_configured');
      return;
    }

    const payment_link_id = request.query.payment_link_id;
    const payment_id = request.query.payment_id;

    if (!payment_link_id && !payment_id) {
      response.redirect('/cancel?error=no_payment_id');
      return;
    }

    // Verify payment using payment_id
    const auth = Buffer.from(config.keyId + ':' + config.keySecret).toString('base64');
    const verifyResponse = await fetch(`https://api.razorpay.com/v1/payments/${payment_id}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json',
      },
    });

    const paymentData = await verifyResponse.json();

    if (paymentData.status === 'authorized' || paymentData.status === 'captured') {
      // Get order_id from payment link or notes
      let order_id = '';
      if (payment_link_id) {
        const linkResponse = await fetch(`https://api.razorpay.com/v1/payment_links/${payment_link_id}`, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + auth,
            'Content-Type': 'application/json',
          },
        });
        const linkData = await linkResponse.json();
        if (linkData.notes && linkData.notes.order_id) {
          order_id = linkData.notes.order_id;
        } else if (linkData.reference_id) {
          // Extract order_id from reference_id (remove random key)
          const parts = linkData.reference_id.split("-");
          order_id = parts.slice(0, -1).join("-");
        }
      }

      if (!order_id) {
        response.redirect('/cancel?error=order_not_found');
        return;
      }

      const transaction_id = payment_id;
      const amount = parseFloat(paymentData.amount) / 100; // Convert from paise

      const db = getFirestoreDB();
      const orderRef = db.collection('orders').doc(order_id);
      const orderDoc = await orderRef.get();

      if (orderDoc.exists) {
        // Update order with payment info
        await orderRef.update({
          paymentStatus: 'paid',
          paymentMethod: 'razorpay',
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
      } else {
        response.redirect('/cancel?error=order_not_found');
      }
    } else {
      response.redirect('/cancel?error=payment_failed');
    }
  } catch (error) {
    console.error('Error in Razorpay process_checkout:', error);
    response.redirect('/cancel?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
  }
};

