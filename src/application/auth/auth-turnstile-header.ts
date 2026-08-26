export const AUTH_TURNSTILE_TOKEN_HEADER = "x-passvero-turnstile-token";

export function readOptionalTurnstileTokenHeader(
  headers: Headers,
): string | undefined | null {
  const token = headers.get(AUTH_TURNSTILE_TOKEN_HEADER);
  if (token === null) return undefined;
  if (token.length === 0 || token.length > 2048 || token.includes(",")) {
    return null;
  }
  return token;
}
