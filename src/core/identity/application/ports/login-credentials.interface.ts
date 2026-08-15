/**
 * Credentials submitted to `POST /auth/login` and forwarded to the active
 * provider. Never logged, never persisted.
 */
export interface ILoginCredentials {
  email: string;
  password: string;
}
