export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeDatabase } = await import('./lib/db/initialize')
    await initializeDatabase()
    const { seedAdminUser } = await import('./lib/db/seed')
    await seedAdminUser()
  }
}
