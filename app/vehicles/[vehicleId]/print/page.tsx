import { notFound, redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { PrintReport as PrintReportView } from '@/components/print-report'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { maintenanceItems, maintenanceRecords, vehicles } from '@/lib/db/schema'
import { isLocale, type Locale } from '@/lib/i18n'
import { formatReportDate, maintenanceTotals } from '@/lib/utils'

export default async function PrintReport({ params }: { params: Promise<{ vehicleId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const cookieStore = await cookies()
  const localeValue = cookieStore.get('locale')?.value ?? 'en'
  const locale: Locale = isLocale(localeValue) ? localeValue : 'en'
  const { vehicleId } = await params
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, vehicleId), eq(vehicles.userId, session.user.id)))
    .limit(1)
  if (!vehicle) notFound()
  const records = await db
    .select()
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.vehicleId, vehicle.id),
        eq(maintenanceRecords.userId, session.user.id),
      ),
    )
    .orderBy(desc(maintenanceRecords.serviceDate))
  const entries = records.length
    ? await db
        .select({
          recordId: maintenanceItems.maintenanceRecordId,
          remark: maintenanceItems.remark,
          priceUsd: maintenanceItems.priceUsd,
          priceKhr: maintenanceItems.priceKhr,
        })
        .from(maintenanceItems)
        .innerJoin(
          maintenanceRecords,
          eq(maintenanceItems.maintenanceRecordId, maintenanceRecords.id),
        )
        .where(
          and(
            eq(maintenanceRecords.vehicleId, vehicle.id),
            eq(maintenanceRecords.userId, session.user.id),
          ),
        )
        .orderBy(desc(maintenanceRecords.serviceDate))
    : []
  const recordDates = new Map(
    records.map((record) => [record.id, formatReportDate(record.serviceDate, locale)]),
  )
  const reportEntries = entries.map((item) => ({
    ...item,
    date: recordDates.get(item.recordId) || '—',
  }))
  const totals = maintenanceTotals(entries)
  return (
    <PrintReportView
      vehicle={{ name: vehicle.name, plateNumber: vehicle.plateNumber }}
      owner={session.user.name || session.user.email || ''}
      exportedAt={formatReportDate(new Date(), locale)}
      entries={reportEntries}
      totals={totals}
    />
  )
}
