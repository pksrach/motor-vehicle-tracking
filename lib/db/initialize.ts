import { pool } from './index'

const statements = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY,
    "name" text,
    "email" text NOT NULL UNIQUE,
    "passwordHash" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "vehicle" (
    "id" text PRIMARY KEY,
    "userId" text NOT NULL,
    "name" text NOT NULL,
    "plateNumber" text,
    "notes" text,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "maintenance_record" (
    "id" text PRIMARY KEY,
    "userId" text NOT NULL,
    "vehicleId" text NOT NULL,
    "serviceDate" timestamp with time zone NOT NULL,
    "odometerKm" integer,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "maintenance_item" (
    "id" text PRIMARY KEY,
    "maintenanceRecordId" text NOT NULL,
    "remark" text NOT NULL,
    "quantity" integer NOT NULL DEFAULT 1,
    "priceUsd" numeric(10, 2) NOT NULL DEFAULT '0',
    "priceKhr" numeric(14, 0) NOT NULL DEFAULT '0',
    "createdAt" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  'ALTER TABLE "maintenance_item" ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 1',
  'CREATE INDEX IF NOT EXISTS "vehicle_user_idx" ON "vehicle" ("userId")',
  'CREATE INDEX IF NOT EXISTS "maintenance_record_user_vehicle_date_idx" ON "maintenance_record" ("userId", "vehicleId", "serviceDate")',
  'CREATE INDEX IF NOT EXISTS "maintenance_item_record_idx" ON "maintenance_item" ("maintenanceRecordId")',
]

export async function initializeDatabase() {
  for (const statement of statements) {
    await pool.query(statement)
  }
}
