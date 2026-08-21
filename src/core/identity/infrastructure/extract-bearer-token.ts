/** Extracts the token from an `Authorization: Bearer <token>` header, or `null` if absent/malformed. */
export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
