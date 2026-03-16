import { onRequest } from 'firebase-functions/v2/https';
import { render_checkout, process_checkout } from './checkout.js';

// Firebase Functions v2: Export name = Function URL
// Functions are deployed as paypalLink and paypalProcess (camelCase)
// URLs: /paypalLink and /paypalProcess
export const paypalLink = onRequest(
  {
    region: 'us-central1',
  },
  render_checkout
);

export const paypalProcess = onRequest(
  {
    region: 'us-central1',
  },
  process_checkout
);

