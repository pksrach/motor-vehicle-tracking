import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { vehicles } from '@/lib/db/schema'
import { TrackerDashboard } from '@/components/tracker-dashboard'

export default async function Home() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id
  const payload = await db
    .select({
      id: vehicles.id,
      name: vehicles.name,
      plateNumber: vehicles.plateNumber,
      notes: vehicles.notes,
    })
    .from(vehicles)
    .where(eq(vehicles.userId, userId))
    .orderBy(desc(vehicles.createdAt))
  return (
    <TrackerDashboard
      vehicles={payload}
      userId={userId}
      userName={session.user.name || session.user.email || 'Driver'}
    />
  )
}
