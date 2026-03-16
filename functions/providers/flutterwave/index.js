import { onRequest } from 'firebase-functions/v2/https';
import { render_checkout, process_checkout } from './checkout.js';

// Firebase Functions v2: Export name = Function URL
// Functions are deployed as flutterwaveLink and flutterwaveProcess (camelCase)
// URLs: /flutterwaveLink and /flutterwaveProcess
export const flutterwaveLink = onRequest(
  {
    region: 'us-central1',
  },
  render_checkout
);

export const flutterwaveProcess = onRequest(
  {
    region: 'us-central1',
  },
  process_checkout
);

