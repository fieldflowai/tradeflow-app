export function safeInternalRedirect(
  candidate: string | null | undefined,
  fallback?: string
): string;

export function getTrustedAppOrigin(value: string | undefined): string | null;
