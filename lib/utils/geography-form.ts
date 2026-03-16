import { FALLBACK_COUNTRIES } from '@/lib/constants/fallbackCountries';
import { Country } from '@/lib/firestore/geography';

export const normalizeLocationValue = (value?: string | null) => (value || '').trim().toLowerCase();

export const getFallbackCountryByIso = (preferredIso?: string | null): Country => {
  const normalizedPreferredIso = normalizeLocationValue(preferredIso);

  return (
    FALLBACK_COUNTRIES.find(
      (country) => normalizeLocationValue(country.isoCode) === normalizedPreferredIso
    ) ||
    FALLBACK_COUNTRIES.find((country) => country.isoCode === 'PK') ||
    FALLBACK_COUNTRIES[0]
  );
};

export const getActiveCountriesWithFallback = (
  fetchedCountries: Country[],
  preferredIso?: string | null
): Country[] => {
  const activeCountries = fetchedCountries.filter((country) => country.status === 'active');
  return activeCountries.length > 0 ? activeCountries : [getFallbackCountryByIso(preferredIso)];
};

export const findPreferredCountry = (
  countries: Country[],
  preferredIso?: string | null,
  preferredName?: string | null
): Country | undefined => {
  const normalizedPreferredIso = normalizeLocationValue(preferredIso);
  const normalizedPreferredName = normalizeLocationValue(preferredName);

  return (
    countries.find((country) => normalizeLocationValue(country.isoCode) === normalizedPreferredIso) ||
    countries.find((country) => normalizeLocationValue(country.name) === normalizedPreferredName) ||
    countries[0]
  );
};

export const stripDialCode = (phone?: string | null, dialCode?: string | null) => {
  const normalizedPhone = (phone || '').trim();
  const normalizedDialCode = (dialCode || '').trim();

  if (!normalizedPhone) {
    return '';
  }

  if (!normalizedDialCode) {
    return normalizedPhone.replace(/^\+/, '');
  }

  const digitsOnlyDialCode = normalizedDialCode.replace(/\D/g, '');

  if (normalizedPhone.startsWith(normalizedDialCode)) {
    return normalizedPhone.slice(normalizedDialCode.length);
  }

  return normalizedPhone.replace(new RegExp(`^\\+?${digitsOnlyDialCode}`), '');
};

export const buildInternationalPhoneNumber = (value: string, dialCode?: string | null) => {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  const digitsOnlyDialCode = (dialCode || '').replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return digitsOnlyDialCode ? `+${digitsOnlyDialCode}${digits}` : `+${digits}`;
};
