import { Timestamp } from 'firebase/firestore';

export interface Country {
  id?: string;
  name: string;
  isoCode: string; // e.g., PK, US
  phoneCode: string; // e.g., +92
  currency: string;
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
}

export interface State {
  id?: string;
  countryId: string; // Reference to Country
  countryName?: string; // Helper for display
  name: string;
  code: string; // e.g., PB, SD
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
}

export interface City {
  id?: string;
  stateId: string; // Reference to State
  stateName?: string; // Helper for display
  countryId: string; // Reference to Country
  countryName?: string; // Helper for display
  name: string;
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
}

