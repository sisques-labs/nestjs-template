/**
 * Normalized token pair returned by `login`/`refreshToken`, regardless of
 * which provider adapter produced it.
 */
export interface ITokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}
