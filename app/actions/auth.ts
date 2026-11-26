'use server'

import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

const registrationSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().max(160), password: z.string().min(8).max(72) })

export async function registerAccount(input: unknown) {
  const data = registrationSchema.parse(input)
  const email = data.email.toLowerCase()
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) throw new Error('An account with this email already exists.')
  await db.insert(users).values({ id: randomUUID(), name: data.name, email, passwordHash: await hash(data.password, 12) })
}
