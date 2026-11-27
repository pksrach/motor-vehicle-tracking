'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { maintenanceItems, maintenanceRecords, vehicles } from '@/lib/db/schema'

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
const recordSchema = z.object({
  vehicleId: z.string().min(1),
  serviceDate: z.string().min(1),
  odometerKm: z.number().int().nonnegative().optional(),
  items: z
    .array(
      z.object({
        remark: z.string().trim().min(1).max(160),
        quantity: z.number().int().positive().max(999999999),
        priceUsd: z
          .number()
          .nonnegative()
          .max(99999999.999)
          .refine((price) => Number(price.toFixed(3)) === price),
        priceKhr: z
          .number()
          .nonnegative()
          .max(99999999999999.999)
          .refine((price) => Number(price.toFixed(3)) === price),
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

export async function saveMaintenance(input: unknown, recordId?: string) {
  const userId = await currentUserId()
  const data = recordSchema.parse(input)
  const date = new Date(`${data.serviceDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid service date')
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
      data.items.map((item) => ({
        id: randomUUID(),
        maintenanceRecordId: id!,
        remark: item.remark,
        quantity: item.quantity,
        priceUsd: item.priceUsd.toFixed(3),
        priceKhr: item.priceKhr.toFixed(3),
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
