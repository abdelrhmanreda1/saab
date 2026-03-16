import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { defaultSettings } from '@/lib/firestore/settings';

let adminDb: admin.firestore.Firestore | null = null;

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      adminDb = admin.firestore();
    } else {
      const serviceAccountPath = path.join(process.cwd(), 'service-account-key.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        adminDb = admin.firestore();
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        adminDb = admin.firestore();
      } else {
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        adminDb = admin.firestore();
      }
    }
  } else {
    adminDb = admin.firestore();
  }
} catch {
  adminDb = null;
}

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'general';

const buildCandidateKeys = (apiUrl: string) => {
  const currencyMatch = apiUrl.match(/currency\/([^/]+)/i);
  const measureMatch = apiUrl.match(/measure\/([^/?]+)/i);

  const currency = currencyMatch?.[1]?.toLowerCase() || '';
  const measure = measureMatch?.[1]?.toLowerCase() || '';

  return [
    `${measure}_in_${currency}`,
    `${measure}_price_${currency}`,
    `${measure}_${currency}`,
    'gram_in_sar',
    'gram_price_sar',
    'gram_sar',
    'price',
    'gram_24k',
    'gram24k',
    'gram_in_usd',
    'ounce_price_usd',
    'ounce_price',
    'rate',
    'value',
    'ask',
    'bid',
    'sell',
    'buy',
  ].filter(Boolean);
};

const extractNumericValue = (payload: unknown, candidates: string[]): number | null => {
  if (typeof payload === 'number' && Number.isFinite(payload)) {
    return payload;
  }

  if (typeof payload === 'string') {
    const cleaned = payload.replace(/[^0-9.]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const value = extractNumericValue(item, candidates);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of candidates) {
      if (key in record) {
        const value = extractNumericValue(record[key], candidates);
        if (value !== null) {
          return value;
        }
      }
    }

    for (const value of Object.values(record)) {
      const nested = extractNumericValue(value, candidates);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
};

const fetchRemoteGoldPrice = async (apiUrl: string) => {
  const apiKey = process.env.GOLDPRICEZ_API_KEY || '';

  if (!apiKey) {
    throw new Error('GOLDPRICEZ_API_KEY is missing');
  }

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'X-API-KEY': apiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Gold API request failed with status ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  const extractedPrice = extractNumericValue(payload, buildCandidateKeys(apiUrl));
  if (extractedPrice === null || extractedPrice <= 0) {
    throw new Error('Gold API response did not contain a valid price');
  }

  return {
    pricePerGram: extractedPrice,
    raw: payload,
  };
};

const fetchGoldPriceFromWebsite = async () => {
  const response = await fetch('https://goldpricez.com/sa', {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GoldPricez website request failed with status ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(
    /title=['"]Gold price for 24K['"]>\s*24K\s*<\/a><\/td><td[^>]*>\s*([0-9.,]+)\s*<\/td>/i
  );

  if (!match?.[1]) {
    throw new Error('Failed to extract 24K gram price from GoldPricez website');
  }

  const parsedPrice = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    throw new Error('Extracted website price is invalid');
  }

  return {
    pricePerGram: parsedPrice,
    raw: { source: 'website', price24kGram: parsedPrice },
  };
};

export async function GET(request: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin is not configured' },
        { status: 500 }
      );
    }

    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
    const settingsRef = adminDb.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    const settingsSnap = await settingsRef.get();
    const settingsData = settingsSnap.exists ? settingsSnap.data() : {};
    const goldPricing = {
      ...defaultSettings.goldPricing,
      ...(settingsData?.goldPricing || {}),
      cache: {
        ...defaultSettings.goldPricing.cache,
        ...((settingsData?.goldPricing as { cache?: Record<string, unknown> } | undefined)?.cache || {}),
      },
    };

    const refreshIntervalMs = Math.max(1, Number(goldPricing.refreshIntervalSeconds || 60)) * 1000;
    const fetchedAtMs = goldPricing.cache?.fetchedAt
      ? new Date(goldPricing.cache.fetchedAt).getTime()
      : 0;
    const cacheAgeMs = Date.now() - fetchedAtMs;
    const hasFreshCache =
      Number(goldPricing.cache?.pricePerGram || 0) > 0 &&
      fetchedAtMs > 0 &&
      cacheAgeMs < refreshIntervalMs;

    if (hasFreshCache && !forceRefresh) {
      return NextResponse.json({
        success: true,
        source: 'cache',
        pricePerGram: goldPricing.cache?.pricePerGram || 0,
        currency: goldPricing.cache?.currency || 'SAR',
        fetchedAt: goldPricing.cache?.fetchedAt || '',
        sourceTimestamp: goldPricing.cache?.sourceTimestamp || '',
      });
    }

    if (goldPricing.provider === 'manual') {
      const manualPrice = Number(goldPricing.manualPricePerGram || 0);
      const nowIso = new Date().toISOString();
      await settingsRef.set(
        {
          goldPricing: {
            cache: {
              pricePerGram: manualPrice,
              currency: 'SAR',
              fetchedAt: nowIso,
              sourceTimestamp: nowIso,
              source: 'manual',
            },
          },
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        source: 'manual',
        pricePerGram: manualPrice,
        currency: 'SAR',
        fetchedAt: nowIso,
        sourceTimestamp: nowIso,
      });
    }

    const apiUrl = goldPricing.apiUrl || defaultSettings.goldPricing.apiUrl;
    let remoteData;

    try {
      remoteData = await fetchRemoteGoldPrice(apiUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message.includes('status 403') ||
        message.includes('status 404') ||
        message.includes('did not contain a valid price')
      ) {
        remoteData = await fetchGoldPriceFromWebsite();
      } else {
        throw error;
      }
    }
    const nowIso = new Date().toISOString();

    await settingsRef.set(
      {
        goldPricing: {
          cache: {
            pricePerGram: remoteData.pricePerGram,
            currency: 'SAR',
            fetchedAt: nowIso,
            sourceTimestamp: nowIso,
            source: remoteData.raw?.source === 'website' ? 'goldpricez-website' : 'goldpricez-api',
          },
        },
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      source: 'remote',
      pricePerGram: remoteData.pricePerGram,
      currency: 'SAR',
      fetchedAt: nowIso,
      sourceTimestamp: nowIso,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load gold price';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
