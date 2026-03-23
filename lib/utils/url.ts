/**
 * Get the base URL for the application
 * Works in both server and client environments
 */
export function getBaseUrl(): string {
  // In server-side rendering
  if (typeof window === 'undefined') {
    // Prefer explicit site URL from environment
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL;
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    // Fallback for local development
    return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }
  
  // In client-side
  return window.location.origin;
}

