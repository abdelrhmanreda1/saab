export const DEFAULT_METADATA_LANGUAGE = 'ar';

export function normalizeLanguageCode(languageCode?: string | null): string {
  return String(languageCode || '').trim().toLowerCase();
}

export function pickPreferredPageTranslation<
  T extends {
    languageCode?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    title?: string | null;
    content?: string | null;
  }
>(translations: T[] | undefined, preferredLanguage = DEFAULT_METADATA_LANGUAGE): T | undefined {
  const normalizedPreferred = normalizeLanguageCode(preferredLanguage);
  const normalizedTranslations = (translations || []).map((translation) => ({
    raw: translation,
    languageCode: normalizeLanguageCode(translation.languageCode),
    hasSeo: Boolean(
      String(translation.metaTitle || '').trim() || String(translation.metaDescription || '').trim()
    ),
    hasContent: Boolean(
      String(translation.title || '').trim() || String(translation.content || '').trim()
    ),
  }));

  return (
    normalizedTranslations.find((translation) => translation.languageCode === normalizedPreferred && translation.hasSeo)
      ?.raw ||
    normalizedTranslations.find((translation) => translation.languageCode === normalizedPreferred && translation.hasContent)
      ?.raw ||
    normalizedTranslations.find((translation) => translation.languageCode === 'en' && translation.hasSeo)?.raw ||
    normalizedTranslations.find((translation) => translation.languageCode === 'en' && translation.hasContent)?.raw ||
    normalizedTranslations[0]?.raw
  );
}
