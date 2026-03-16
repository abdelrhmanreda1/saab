import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  defaultSettings,
  normalizeGoldPricingSettings,
  Settings,
} from './settings';

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'general';

export const getSettings = async (): Promise<Settings | null> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<Settings>;
      return {
        ...defaultSettings,
        ...data,
        goldPricing: normalizeGoldPricingSettings(data.goldPricing),
      } as Settings;
    } else {
      return null;
    }
  } catch (error) {
    // Failed to fetch settings
    throw error;
  }
};

// Helper function to flatten nested objects for Firestore update
const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  const flattened: Record<string, unknown> = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      // Check if value is a Firestore Timestamp (has seconds and nanoseconds properties)
      const isTimestamp = value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !isTimestamp) {
        // Recursively flatten nested objects
        const nestedObj = value as Record<string, unknown>;
        Object.assign(flattened, flattenObject(nestedObj, newKey));
      } else {
        // Only include non-undefined values
        if (value !== undefined) {
          flattened[newKey] = value;
        }
      }
    }
  }
  
  return flattened;
};

export const updateSettings = async (settings: Partial<Settings>) => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    
    // Check if document exists
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Document exists, use updateDoc with flattened paths
      const flattened = flattenObject(settings);
      await updateDoc(docRef, flattened);
    } else {
      // Document doesn't exist, use setDoc
      await setDoc(docRef, settings);
    }
  } catch (error) {
    // Failed to update settings
    throw error;
  }
};

