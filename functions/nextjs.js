import { onRequest } from 'firebase-functions/v2/https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import { rateLimiter } from './middleware/rateLimiter.js';
import { validateRequest, ddosProtection } from './middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

let nextHandler;
let isInitializing = false;

// Initialize rate limiter and security middleware
const apiRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500, // 500 requests per 15 minutes (increased from 100)
  keyGenerator: (req) => {
    // Use IP address or user ID if authenticated
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.ip || 
           req.headers['x-user-id'] || 
           'unknown';
  },
});

const ddosProtector = ddosProtection({
  maxRequestsPerMinute: 300, // Increased from 60 to 300 requests per minute
  blockDuration: 60000, // 1 minute
});

export const nextjs = onRequest(
  {
    maxInstances: 10,
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 60,
    invoker: 'public', // Allow public access (required for Firebase Hosting)
  },
  async (req, res) => {
    // Apply security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    // CSP for Next.js - allows inline scripts and external resources
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://*.firebaseio.com https://apis.google.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com wss://*.firebaseio.com https://*.gstatic.com https://apis.google.com; " +
      "frame-src 'self' https://*.google.com https://*.firebaseapp.com; " +
      "object-src 'none'; " +
      "base-uri 'self';"
    );
    
    // Validate request for suspicious content
    if (!validateRequest(req, res)) {
      return;
    }
    
    // Apply DDoS protection
    if (!ddosProtector(req, res)) {
      return;
    }
    
    // Apply rate limiting for API routes
    if (req.path?.startsWith('/api/')) {
      if (!apiRateLimiter(req, res)) {
        return;
      }
    }
    try {
      // Wait if initialization is in progress
      while (isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!nextHandler) {
        isInitializing = true;
        try {
          // Initializing Next.js handler
          const fs = require('fs');
          const originalCwd = process.cwd();
          
          // Try multiple possible paths
          const possiblePaths = [
            join(__dirname, '.next', 'standalone'),
            join(__dirname, '..', '.next', 'standalone'),
            join(process.cwd(), '.next', 'standalone'),
          ];
          
          let standalonePath = null;
          for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
              standalonePath = path;
              // Found standalone path
              break;
            }
          }
          
          if (!standalonePath) {
            throw new Error(`Standalone path not found. Tried: ${possiblePaths.join(', ')}`);
          }
          
          // Verify .next folder exists in standalone
          const nextInStandalone = join(standalonePath, '.next');
          if (!fs.existsSync(nextInStandalone)) {
            throw new Error(`Next.js build not found in: ${nextInStandalone}`);
          }
          
          // Change to the standalone directory (required for Next.js)
          process.chdir(standalonePath);
          process.env.NODE_ENV = 'production';
          
          // Load Next.js
          const next = require('next')({
            dev: false,
            dir: standalonePath,
            conf: {
              distDir: '.next',
            },
          });
          
          // Preparing Next.js
          await next.prepare();
          const handle = next.getRequestHandler();
          
          // Restore original working directory
          process.chdir(originalCwd);
          
          nextHandler = handle;
          // Next.js handler initialized successfully
        } finally {
          isInitializing = false;
        }
      }
      
      // Handle the request
      if (nextHandler) {
        await nextHandler(req, res);
      } else {
        throw new Error('Next.js handler not initialized');
      }
    } catch {
      // Failed to serve Next.js  
      if (!res.headersSent) {
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Error - Pardah</title>
              <meta charset="utf-8">
            </head>
            <body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto;">
              <h1>Internal Server Error</h1>
              <p><strong>Error:</strong> ${error.message}</p>
              ${process.env.NODE_ENV === 'development' && error.stack ? `<pre style="background: #f5f5f5; padding: 1rem; overflow: auto;">${error.stack}</pre>` : ''}
            </body>
          </html>
        `);
      }
    }
  }
);
