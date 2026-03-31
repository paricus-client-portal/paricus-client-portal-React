/**
 * Builds an authenticated URL for file attachments.
 * Uses VITE_API_URL as base and strips duplicate /api prefix from attachment path.
 *
 * @param {Object} attachment - The attachment object with a `url` property (relative path).
 * @param {string} token - The JWT auth token.
 * @returns {string|null} The full authenticated URL, or null if inputs are invalid.
 */
export const getAttachmentUrl = (attachment, token) => {
  if (!attachment?.url || !token) return null;

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
  // attachment.url comes as "/api/tickets/..." — remove "/api" prefix since apiUrl already ends with /api
  const path = attachment.url.startsWith("/api") ? attachment.url.slice(4) : attachment.url;
  return `${apiUrl}${path}?token=${encodeURIComponent(token)}`;
};
