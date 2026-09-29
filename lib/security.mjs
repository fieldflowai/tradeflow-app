/**
 * Resolve only same-site, root-relative redirect targets.
 * @param {string | null | undefined} candidate
 * @param {string} [fallback]
 * @returns {string}
 */
export function safeInternalRedirect(candidate, fallback = "/dashboard") {
  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  try {
    const target = new URL(candidate, "https://tradeflow.invalid");
    if (target.origin !== "https://tradeflow.invalid") return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Accept an HTTPS production base URL, or HTTP localhost during development.
 * Paths, credentials, query strings, and fragments are rejected.
 * @param {string | undefined} value
 * @returns {string | null}
 */
export function getTrustedAppOrigin(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((!localHttp && url.protocol !== "https:") || url.username || url.password) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}
