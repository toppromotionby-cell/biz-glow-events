export type OAuthProvider = "google" | "apple";

function generateOAuthState() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isEmbeddedOAuthContext() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getOAuthInitiateUrl(provider: OAuthProvider) {
  const url = new URL("/~oauth/initiate", window.location.origin);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_uri", window.location.origin);
  url.searchParams.set("state", generateOAuthState());
  return url.toString();
}

export function openOAuthInNewTab(provider: OAuthProvider) {
  const popup = window.open(getOAuthInitiateUrl(provider), "_blank");

  if (!popup) return false;

  try {
    popup.opener = null;
    popup.focus();
  } catch {
    // Ignore browser-specific popup restrictions.
  }

  return true;
}