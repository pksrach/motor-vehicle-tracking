import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { db } from './index'
import { users } from './schema'

export async function seedAdminUser() {
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase()
  const password = process.env.ADMIN_PWD || '123456'

  await db.insert(users).values({
    id: randomUUID(),
    name: 'Admin',
    email,
    passwordHash: await hash(password, 12),
  }).onConflictDoNothing({ target: users.email })
}
