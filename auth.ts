import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  // The v0 preview runs in a cross-site iframe, so Lax cookies are omitted from auth requests there.
  cookies: {
    csrfToken: {
      name: '__Host-authjs.csrf-token',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: true },
    },
    sessionToken: {
      name: '__Secure-authjs.session-token',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: true },
    },
  },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(credentials)
        if (!parsed.success) return null
        const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1)
        if (!user || !(await compare(parsed.data.password, user.passwordHash))) return null
        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id
      return token
    },
    session({ session, token }) {
      if (session.user && token.userId) session.user.id = token.userId as string
      return session
    },
  },
})
