/**
 * URL/identifier slug from a display name.
 *
 * Extracted from the category action so the collision and edge-case behaviour
 * can be tested directly rather than only through a database round-trip.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    // Strip combining diacritical marks (U+0300–U+036F).
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')
}
