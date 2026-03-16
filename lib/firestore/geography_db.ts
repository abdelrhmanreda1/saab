import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Country, State, City } from './geography';

// --- Countries ---
const COUNTRIES_COLLECTION = 'countries';

export const getCountries = async (): Promise<Country[]> => {
  try {
    const q = query(collection(db, COUNTRIES_COLLECTION), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Country));
  } catch {
    // Failed to fetch countries
    return [];
  }
};

export const addCountry = async (country: Country) => {
  try {
    await addDoc(collection(db, COUNTRIES_COLLECTION), {
      ...country,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    // Failed to add country
    throw error;
  }
};

export const updateCountry = async (id: string, country: Partial<Country>) => {
  try {
    const docRef = doc(db, COUNTRIES_COLLECTION, id);
    await updateDoc(docRef, country);
  } catch (error) {
    // Failed to update country
    throw error;
  }
};

export const deleteCountry = async (id: string) => {
  try {
    await deleteDoc(doc(db, COUNTRIES_COLLECTION, id));
  } catch (error) {
    // Failed to delete country
    throw error;
  }
};

// --- States ---
const STATES_COLLECTION = 'states';

export const getStates = async (countryId?: string): Promise<State[]> => {
  try {
    let q;
    if (countryId) {
      q = query(collection(db, STATES_COLLECTION), where('countryId', '==', countryId), orderBy('name'));
    } else {
      q = query(collection(db, STATES_COLLECTION), orderBy('name'));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as State));
  } catch {
    // Failed to fetch states
    return [];
  }
};

export const addState = async (state: State) => {
  try {
    await addDoc(collection(db, STATES_COLLECTION), {
      ...state,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    // Failed to add state
    throw error;
  }
};

export const updateState = async (id: string, state: Partial<State>) => {
  try {
    const docRef = doc(db, STATES_COLLECTION, id);
    await updateDoc(docRef, state);
  } catch (error) {
    // Failed to update state
    throw error;
  }
};

export const deleteState = async (id: string) => {
  try {
    await deleteDoc(doc(db, STATES_COLLECTION, id));
  } catch (error) {
    // Failed to delete state
    throw error;
  }
};

// --- Cities ---
const CITIES_COLLECTION = 'cities';

export const getCities = async (stateId?: string): Promise<City[]> => {
  try {
    let q;
    if (stateId) {
      q = query(collection(db, CITIES_COLLECTION), where('stateId', '==', stateId), orderBy('name'));
    } else {
      q = query(collection(db, CITIES_COLLECTION), orderBy('name'));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as City));
  } catch {
    // Failed to fetch cities
    return [];
  }
};

export const addCity = async (city: City) => {
  try {
    await addDoc(collection(db, CITIES_COLLECTION), {
      ...city,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    // Failed to add city
    throw error;
  }
};

export const updateCity = async (id: string, city: Partial<City>) => {
  try {
    const docRef = doc(db, CITIES_COLLECTION, id);
    await updateDoc(docRef, city);
  } catch (error) {
    // Failed to update city
    throw error;
  }
};

export const deleteCity = async (id: string) => {
  try {
    await deleteDoc(doc(db, CITIES_COLLECTION, id));
  } catch (error) {
    // Failed to delete city
    throw error;
  }
};

