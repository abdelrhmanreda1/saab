import { onRequest } from 'firebase-functions/v2/https';
import { render_checkout, process_checkout } from './checkout.js';

// Firebase Functions v2: Export name = Function URL
// Functions are deployed as razorpayLink and razorpayProcess (camelCase)
// URLs: /razorpayLink and /razorpayProcess
export const razorpayLink = onRequest(
  {
    region: 'us-central1',
  },
  render_checkout
);

export const razorpayProcess = onRequest(
  {
    region: 'us-central1',
  },
  process_checkout
);

