import { pgTable, text, timestamp, integer, numeric, index } from 'drizzle-orm/pg-core'

export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
})

export const vehicles = pgTable('vehicle', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  plateNumber: text('plateNumber'),
  notes: text('notes'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('vehicle_user_idx').on(table.userId)])

export const maintenanceRecords = pgTable('maintenance_record', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  vehicleId: text('vehicleId').notNull(),
  serviceDate: timestamp('serviceDate', { withTimezone: true }).notNull(),
  odometerKm: integer('odometerKm'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('maintenance_record_user_vehicle_date_idx').on(table.userId, table.vehicleId, table.serviceDate)])

export const maintenanceItems = pgTable('maintenance_item', {
  id: text('id').primaryKey(),
  maintenanceRecordId: text('maintenanceRecordId').notNull(),
  remark: text('remark').notNull(),
  priceUsd: numeric('priceUsd', { precision: 10, scale: 2 }).notNull().default('0'),
  priceKhr: numeric('priceKhr', { precision: 14, scale: 0 }).notNull().default('0'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('maintenance_item_record_idx').on(table.maintenanceRecordId)])
