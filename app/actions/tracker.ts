'use server'

import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { maintenanceItems, maintenanceRecords, maintenanceRemarks, vehicles } from '@/lib/db/schema'

async function currentUserId() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session.user.id
}

const vehicleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  plateNumber: z.string().trim().max(24).optional(),
  notes: z.string().trim().max(500).optional(),
})
const remarkNameSchema = z.string().trim().min(1).max(160)
const remarkSearchSchema = z.string().trim().max(160)
const recordSchema = z.object({
  vehicleId: z.string().min(1),
  serviceDate: z.string().min(1),
  odometerKm: z.number().int().nonnegative().optional(),
  items: z
    .array(
      z.object({
        remark: z.string().trim().min(1).max(160),
        priceUsd: z
          .number()
          .nonnegative()
          .lt(1e24)
          .refine((price) => Number(price.toFixed(6)) === price),
        priceKhr: z
          .number()
          .nonnegative()
          .lt(1e24)
          .refine((price) => Number(price.toFixed(6)) === price),
      }),
    )
    .min(1)
    .max(30),
})

export async function createVehicle(input: unknown) {
  const userId = await currentUserId()
  const data = vehicleSchema.parse(input)
  await db.insert(vehicles).values({
    id: randomUUID(),
    userId,
    name: data.name,
    plateNumber: data.plateNumber || null,
    notes: data.notes || null,
  })
  revalidatePath('/')
}

export async function updateVehicle(id: string, input: unknown) {
  const userId = await currentUserId()
  const data = vehicleSchema.parse(input)
  const [updated] = await db
    .update(vehicles)
    .set({ name: data.name, plateNumber: data.plateNumber || null, notes: data.notes || null })
    .where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)))
    .returning({ id: vehicles.id })
  if (!updated) throw new Error('Vehicle not found or access denied')
  revalidatePath('/')
}

export async function deleteVehicle(id: string) {
  const userId = await currentUserId()
  await db.delete(vehicles).where(and(eq(vehicles.id, id), eq(vehicles.userId, userId)))
  revalidatePath('/')
}

export async function searchMaintenanceRemarks(query: unknown = '') {
  const userId = await currentUserId()
  const normalizedQuery = remarkSearchSchema.parse(query)
  const escapedQuery = normalizedQuery.replace(/[!%_]/g, '!$&').toLowerCase()

  return db
    .select({ id: maintenanceRemarks.id, name: maintenanceRemarks.name })
    .from(maintenanceRemarks)
    .where(
      and(
        eq(maintenanceRemarks.userId, userId),
        sql`lower(${maintenanceRemarks.name}) LIKE ${`${escapedQuery}%`} ESCAPE '!'`,
      ),
    )
    .orderBy(
      sql`CASE WHEN lower(${maintenanceRemarks.name}) = ${normalizedQuery.toLowerCase()} THEN 0 ELSE 1 END`,
      sql`lower(${maintenanceRemarks.name})`,
    )
    .limit(20)
}

export async function createMaintenanceRemark(input: unknown) {
  const userId = await currentUserId()
  const name = remarkNameSchema.parse(input)
  const [existing] = await db
    .select({ id: maintenanceRemarks.id })
    .from(maintenanceRemarks)
    .where(
      and(
        eq(maintenanceRemarks.userId, userId),
        sql`lower(${maintenanceRemarks.name}) = lower(${name})`,
      ),
    )
    .limit(1)
  if (existing) throw new Error('Remark already exists')

  try {
    await db.insert(maintenanceRemarks).values({ id: randomUUID(), userId, name })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === 'maintenance_remark_user_name_unique'
    ) {
      throw new Error('Remark already exists')
    }
    throw error
  }

  revalidatePath('/')
  return name
}

export async function getVehicleServiceHistory(vehicleId: string) {
  const userId = await currentUserId()
  const records = await db
    .select()
    .from(maintenanceRecords)
    .where(and(eq(maintenanceRecords.vehicleId, vehicleId), eq(maintenanceRecords.userId, userId)))
    .orderBy(desc(maintenanceRecords.serviceDate))
  if (!records.length) return []

  const items = await db
    .select({
      id: maintenanceItems.id,
      maintenanceRecordId: maintenanceItems.maintenanceRecordId,
      remark: maintenanceItems.remark,
      priceUsd: maintenanceItems.priceUsd,
      priceKhr: maintenanceItems.priceKhr,
    })
    .from(maintenanceItems)
    .innerJoin(maintenanceRecords, eq(maintenanceItems.maintenanceRecordId, maintenanceRecords.id))
    .where(and(eq(maintenanceRecords.vehicleId, vehicleId), eq(maintenanceRecords.userId, userId)))

  return records.map((record) => ({
    id: record.id,
    serviceDate: record.serviceDate.toISOString(),
    odometerKm: record.odometerKm,
    items: items.filter((item) => item.maintenanceRecordId === record.id),
  }))
}

export async function saveMaintenance(input: unknown, recordId?: string) {
  const userId = await currentUserId()
  const data = recordSchema.parse(input)
  const date = new Date(`${data.serviceDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid service date')
  const requestedRemarks = [...new Set(data.items.map((item) => item.remark.toLowerCase()))]
  const ownedRemarks = await db
    .select({ name: maintenanceRemarks.name })
    .from(maintenanceRemarks)
    .where(
      and(
        eq(maintenanceRemarks.userId, userId),
        inArray(sql`lower(${maintenanceRemarks.name})`, requestedRemarks),
      ),
    )
  const canonicalRemarkNames = new Map(
    ownedRemarks.map((remark) => [remark.name.toLowerCase(), remark.name]),
  )
  const items = data.items.map((item) => {
    const remark = canonicalRemarkNames.get(item.remark.toLowerCase())
    if (!remark) throw new Error('Remark not found or access denied')
    return { ...item, remark }
  })

  const [vehicle] = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.id, data.vehicleId), eq(vehicles.userId, userId)))
    .limit(1)
  if (!vehicle) throw new Error('Vehicle not found or access denied')

  await db.transaction(async (tx) => {
    let id = recordId
    if (recordId) {
      const [existing] = await tx
        .select({ id: maintenanceRecords.id })
        .from(maintenanceRecords)
        .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.userId, userId)))
        .limit(1)
      if (!existing) throw new Error('Record not found or access denied')
      await tx
        .update(maintenanceRecords)
        .set({
          vehicleId: data.vehicleId,
          serviceDate: date,
          odometerKm: data.odometerKm ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.userId, userId)))
      await tx.delete(maintenanceItems).where(eq(maintenanceItems.maintenanceRecordId, recordId))
    } else {
      id = randomUUID()
      await tx.insert(maintenanceRecords).values({
        id,
        userId,
        vehicleId: data.vehicleId,
        serviceDate: date,
        odometerKm: data.odometerKm ?? null,
      })
    }
    await tx.insert(maintenanceItems).values(
      items.map((item) => ({
        id: randomUUID(),
        maintenanceRecordId: id!,
        remark: item.remark,
        priceUsd: item.priceUsd.toFixed(6),
        priceKhr: item.priceKhr.toFixed(6),
      })),
    )
  })
  revalidatePath('/')
}

export async function removeMaintenance(recordId: string) {
  const userId = await currentUserId()
  await db
    .delete(maintenanceRecords)
    .where(and(eq(maintenanceRecords.id, recordId), eq(maintenanceRecords.userId, userId)))
  revalidatePath('/')
}
