import { onRequest } from 'firebase-functions/v2/https';
import { render_checkout, process_checkout } from './checkout.js';

// Firebase Functions v2: Export name = Function URL
// Functions are deployed as paystackLink and paystackProcess (camelCase)
// URLs: /paystackLink and /paystackProcess
export const paystackLink = onRequest(
  {
    region: 'us-central1',
  },
  render_checkout
);

export const paystackProcess = onRequest(
  {
    region: 'us-central1',
  },
  process_checkout
);

