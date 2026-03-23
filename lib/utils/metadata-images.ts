export function pickFirstImage(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function extractFirstImageFromHtml(content?: string | null): string | undefined {
  const html = String(content || '');
  if (!html) return undefined;

  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1]?.trim() || undefined;
}
