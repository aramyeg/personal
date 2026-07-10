import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'curator_session'
export const SESSION_MAX_AGE = 60 * 60 * 24

export type CuratorSession = { email: string }

// Demo deployment: the cookie gates no sensitive data — any credentials are
// accepted upstream. The fallback constant is deliberate and documented in
// EB-001; set CURATOR_SESSION_SECRET to override.
const secret = () =>
  new TextEncoder().encode(process.env.CURATOR_SESSION_SECRET ?? 'curator-demo-secret-protects-nothing')

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('operator')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret())
}

export async function verifySession(token: string | undefined): Promise<CuratorSession | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return typeof payload.email === 'string' ? { email: payload.email } : null
  } catch {
    return null
  }
}
