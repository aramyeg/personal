import { cookies } from 'next/headers'
import { z } from 'zod'
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from '@/components/labs/curator/server/session'

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }
  const parsed = credentials.safeParse(body)
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Enter a valid email and password.' }, { status: 400 })
  }
  const token = await signSession(parsed.data.email)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return Response.json({ ok: true })
}

export async function DELETE(): Promise<Response> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
  return Response.json({ ok: true })
}
