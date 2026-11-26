import { redirect } from 'next/navigation'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { maintenanceItems, maintenanceRecords, vehicles } from '@/lib/db/schema'
import { TrackerDashboard } from '@/components/tracker-dashboard'

export default async function Home() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id
  const [vehicleRows, records] = await Promise.all([
    db.select().from(vehicles).where(eq(vehicles.userId, userId)).orderBy(desc(vehicles.createdAt)),
    db
      .select()
      .from(maintenanceRecords)
      .where(eq(maintenanceRecords.userId, userId))
      .orderBy(desc(maintenanceRecords.serviceDate)),
  ])
  const recordIds = records.map((record) => record.id)
  const itemRows = recordIds.length
    ? await db
        .select({
          id: maintenanceItems.id,
          maintenanceRecordId: maintenanceItems.maintenanceRecordId,
          remark: maintenanceItems.remark,
          priceUsd: maintenanceItems.priceUsd,
          priceKhr: maintenanceItems.priceKhr,
        })
        .from(maintenanceItems)
        .innerJoin(
          maintenanceRecords,
          eq(maintenanceItems.maintenanceRecordId, maintenanceRecords.id),
        )
        .where(eq(maintenanceRecords.userId, userId))
    : []
  const payload = vehicleRows.map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    plateNumber: vehicle.plateNumber,
    notes: vehicle.notes,
    records: records
      .filter((record) => record.vehicleId === vehicle.id)
      .map((record) => ({
        id: record.id,
        serviceDate: record.serviceDate.toISOString(),
        odometerKm: record.odometerKm,
        items: itemRows.filter((item) => item.maintenanceRecordId === record.id),
      })),
  }))
  return (
    <TrackerDashboard
      vehicles={payload}
      userId={userId}
      userName={session.user.name || session.user.email || 'Driver'}
    />
  )
}
