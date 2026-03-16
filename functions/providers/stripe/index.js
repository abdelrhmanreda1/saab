import { onRequest } from 'firebase-functions/v2/https';
import { render_checkout, process_checkout } from './checkout.js';

// Firebase Functions v2: Export name = Function URL
// Functions are deployed as stripeLink and stripeProcess (camelCase)
// URLs: /stripeLink and /stripeProcess
export const stripeLink = onRequest(
  {
    region: 'us-central1',
  },
  render_checkout
);

export const stripeProcess = onRequest(
  {
    region: 'us-central1',
  },
  process_checkout
);

