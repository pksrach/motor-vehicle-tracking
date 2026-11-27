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
    "quantity" numeric(12, 3) NOT NULL DEFAULT 1,
    "priceUsd" numeric(11, 3) NOT NULL DEFAULT '0',
    "priceKhr" numeric(17, 3) NOT NULL DEFAULT '0',
    "createdAt" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  'ALTER TABLE "maintenance_item" ADD COLUMN IF NOT EXISTS "quantity" numeric(12, 3) NOT NULL DEFAULT 1',
  `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'maintenance_item'
          AND column_name = 'quantity'
          AND data_type = 'integer'
      ) THEN
        ALTER TABLE "maintenance_item"
          ALTER COLUMN "quantity" TYPE numeric(12, 3)
          USING "quantity"::numeric(12, 3);
      END IF;
    END
  $$`,
  `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'maintenance_item'
          AND column_name = 'priceUsd'
          AND data_type = 'numeric'
          AND numeric_scale < 3
      ) THEN
        ALTER TABLE "maintenance_item"
          ALTER COLUMN "priceUsd" TYPE numeric(11, 3)
          USING "priceUsd"::numeric(11, 3);
      END IF;
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'maintenance_item'
          AND column_name = 'priceKhr'
          AND data_type = 'numeric'
          AND numeric_scale < 3
      ) THEN
        ALTER TABLE "maintenance_item"
          ALTER COLUMN "priceKhr" TYPE numeric(17, 3)
          USING "priceKhr"::numeric(17, 3);
      END IF;
    END
  $$`,
  'CREATE INDEX IF NOT EXISTS "vehicle_user_idx" ON "vehicle" ("userId")',
  'CREATE INDEX IF NOT EXISTS "maintenance_record_user_vehicle_date_idx" ON "maintenance_record" ("userId", "vehicleId", "serviceDate")',
  'CREATE INDEX IF NOT EXISTS "maintenance_item_record_idx" ON "maintenance_item" ("maintenanceRecordId")',
]

export async function initializeDatabase() {
  for (const statement of statements) {
    await pool.query(statement)
  }
}
