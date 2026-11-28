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
    "priceUsd" numeric(30, 6) NOT NULL DEFAULT '0',
    "priceKhr" numeric(30, 6) NOT NULL DEFAULT '0',
    "createdAt" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS "maintenance_remark" (
    "id" text PRIMARY KEY,
    "userId" text NOT NULL,
    "name" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
  )`,
  'ALTER TABLE "maintenance_remark" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp with time zone NOT NULL DEFAULT now()',
  `DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'maintenance_item'
          AND column_name = 'quantity'
      ) THEN
        ALTER TABLE "maintenance_item"
          ALTER COLUMN "priceUsd" TYPE numeric(30, 6)
          USING ("priceUsd" * "quantity")::numeric(30, 6);
        ALTER TABLE "maintenance_item"
          ALTER COLUMN "priceKhr" TYPE numeric(30, 6)
          USING ("priceKhr" * "quantity")::numeric(30, 6);
        ALTER TABLE "maintenance_item" DROP COLUMN "quantity";
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
          AND (
            data_type <> 'numeric'
            OR numeric_scale IS DISTINCT FROM 6
            OR numeric_precision IS DISTINCT FROM 30
          )
      ) THEN
        ALTER TABLE "maintenance_item"
          ALTER COLUMN "priceUsd" TYPE numeric(30, 6)
          USING "priceUsd"::numeric(30, 6);
      END IF;
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'maintenance_item'
          AND column_name = 'priceKhr'
          AND (
            data_type <> 'numeric'
            OR numeric_scale IS DISTINCT FROM 6
            OR numeric_precision IS DISTINCT FROM 30
          )
      ) THEN
        ALTER TABLE "maintenance_item"
          ALTER COLUMN "priceKhr" TYPE numeric(30, 6)
          USING "priceKhr"::numeric(30, 6);
      END IF;
    END
  $$`,
  'CREATE INDEX IF NOT EXISTS "vehicle_user_idx" ON "vehicle" ("userId")',
  'CREATE INDEX IF NOT EXISTS "maintenance_record_user_vehicle_date_idx" ON "maintenance_record" ("userId", "vehicleId", "serviceDate")',
  'CREATE INDEX IF NOT EXISTS "maintenance_item_record_idx" ON "maintenance_item" ("maintenanceRecordId")',
  'CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_remark_user_name_unique" ON "maintenance_remark" ("userId", lower("name"))',
  `INSERT INTO "maintenance_remark" ("id", "userId", "name")
    SELECT DISTINCT ON (record."userId", lower(btrim(item."remark")))
      gen_random_uuid()::text,
      record."userId",
      btrim(item."remark")
    FROM "maintenance_item" AS item
    INNER JOIN "maintenance_record" AS record
      ON record."id" = item."maintenanceRecordId"
    WHERE btrim(item."remark") <> ''
    ORDER BY record."userId", lower(btrim(item."remark")), btrim(item."remark")
    ON CONFLICT DO NOTHING`,
]

export async function initializeDatabase() {
  for (const statement of statements) {
    await pool.query(statement)
  }
}
