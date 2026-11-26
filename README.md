# Project Specification: Multi-User Motor & Vehicle Maintenance Tracker

## 1. Project Overview & Tech Stack
A multi-user full-stack web application to capture, manage, and visualize maintenance history for motorbikes and vehicles. Users manage their own vehicles and maintenance logs with strict row-level data isolation.

- **Framework:** Next.js 15+ (App Router, Server Actions, Route Handlers)
- **Language:** TypeScript
- **Package Manager:** pnpm
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** Auth.js (NextAuth v5) — Credentials (Email/Password) and/or Google OAuth
- **Styling & UI:** Tailwind CSS, Shadcn UI, Lucide React Icons
- **PDF Export:** `@react-pdf/renderer` (or browser `@media print` clean table stylesheet)
- **Validation:** Zod + React Hook Form

---

## 2. System Architecture & Data Flow

```text
+-------------------------------------------------------------------+
|                        Client (Browser)                           |
|  - Vehicle Selector & Master-Detail Maintenance Form              |
|  - Bottom-to-Top Vertical Timeline View (Interactive)             |
|  - Print / Export Table PDF View                                  |
+---------------------------------+---------------------------------+
                                  | HTTPS (Server Actions / API)
                                  v
+-------------------------------------------------------------------+
|                   Next.js App Router (Server)                     |
|  +-------------------------------------------------------------+  |
|  | Auth.js Middleware & Session Guard (`auth()`)               |  |
|  | Extracts `session.user.id` -> Rejects unauthenticated reqs  |  |
|  +------------------------------+------------------------------+  |
|                                 | Verified `userId`                |
|                                 v                                 |
|  +-------------------------------------------------------------+  |
|  | Data Access / Service Layer (Prisma Client)                 |  |
|  | Enforces `WHERE userId = session.user.id` on EVERY query    |  |
|  +------------------------------+------------------------------+  |
+---------------------------------+---------------------------------+
                                  | SQL (Parameterized Queries)
                                  v
+-------------------------------------------------------------------+
|                      PostgreSQL Database                          |
|  [User] 1---* [Vehicle] 1---* [MaintenanceRecord] 1---* [Item]    |
+-------------------------------------------------------------------+
```

### Security & Multi-Tenant Isolation Rules
1. **Never trust client-supplied `userId`:** Always resolve `userId` on the server via `const session = await auth()`.
2. **Ownership Verification on Mutations:** Before updating or deleting a `Vehicle` or `MaintenanceRecord`, verify that the record exists AND `record.userId === session.user.id`.
3. **Atomic Master-Detail Writes:** Use `prisma.$transaction()` when creating or updating a maintenance record and its child detail items so partial writes never occur.

---

## 3. Project Initialization Script

Run the following commands in your terminal to scaffold the project and install dependencies:

```bash
# 1. Create Next.js project with TypeScript, Tailwind CSS, ESLint, and App Router
pnpm create next-app@latest vehicle-maintenance-tracker \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm

cd vehicle-maintenance-tracker

# 2. Install core dependencies (Prisma, Auth.js, Validation, Icons, PDF)
pnpm add @prisma/client next-auth@beta @auth/prisma-adapter bcryptjs zod react-hook-form @hookform/resolvers lucide-react @react-pdf/renderer

# 3. Install dev dependencies
pnpm add -D prisma @types/bcryptjs

# 4. Initialize Prisma with PostgreSQL
pnpm dlx prisma init --datasource-provider postgresql

# 5. Initialize Shadcn UI (accept defaults, choose Neutral/Zinc theme)
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add button input label card dialog select table badge separator toast
```

### Environment Variables (`.env`)
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/vehicle_tracker?schema=public"
AUTH_SECRET="replace-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"
```

---

## 4. Database Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String              @id @default(cuid())
  name          String?
  email         String              @unique
  passwordHash  String?
  image         String?
  vehicles      Vehicle[]
  records       MaintenanceRecord[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

model Vehicle {
  id          String              @id @default(cuid())
  userId      String
  user        User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String              // e.g., "Honda Dream 2017"
  plateNumber String?             // Optional identifier
  notes       String?
  records     MaintenanceRecord[]
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  @@index([userId])
}

model MaintenanceRecord {
  id          String            @id @default(cuid())
  userId      String
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  vehicleId   String
  vehicle     Vehicle           @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  serviceDate DateTime          // Master: Pickup / Service Date (e.g., 2026-10-26)
  odometerKm  Int?              // Optional: Mileage at service
  items       MaintenanceItem[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([userId, vehicleId, serviceDate])
}

model MaintenanceItem {
  id                  String            @id @default(cuid())
  maintenanceRecordId String
  maintenanceRecord   MaintenanceRecord @relation(fields: [maintenanceRecordId], references: [id], onDelete: Cascade)
  remark              String            // Detail: e.g., "Change oil", "Replace rear tire"
  priceUsd            Decimal           @default(0) @db.Decimal(10, 2)
  priceKhr            Decimal           @default(0) @db.Decimal(14, 0)
  createdAt           DateTime          @default(now())

  @@index([maintenanceRecordId])
}
```

Run migration after saving the schema:
```bash
pnpm dlx prisma migrate dev --name init_vehicle_maintenance
```

---

## 5. Folder Structure

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Auth check + Navbar
│   │   ├── page.tsx                    # Vehicle list & quick summary
│   │   └── vehicles/
│   │       └── [vehicleId]/
│   │           ├── page.tsx            # Bottom-to-top Timeline + Add/Edit Modal
│   │           └── print/page.tsx      # Clean tabular report view for PDF export
│   └── api/
│       └── auth/[...nextauth]/route.ts
├── actions/
│   ├── auth.actions.ts                 # User registration
│   ├── vehicle.actions.ts              # CRUD Vehicles (scoped by userId)
│   └── maintenance.actions.ts          # Atomic Master-Detail CRUD (scoped by userId)
├── components/
│   ├── vehicles/
│   │   └── vehicle-dialog.tsx          # Create/Edit Vehicle modal
│   ├── maintenance/
│   │   ├── maintenance-form-dialog.tsx # Master (Date, Vehicle) + Dynamic Detail Rows (Remark, USD, KHR)
│   │   └── timeline-view.tsx           # Bottom-to-Top single-line vertical timeline
│   └── pdf/
│       └── vehicle-report-pdf.tsx      # @react-pdf/renderer table export component
├── lib/
│   ├── auth.ts                         # Auth.js configuration
│   ├── prisma.ts                       # Prisma singleton client
│   └── validations.ts                  # Zod schemas for Master-Detail forms
└── middleware.ts                       # Route protection for /dashboard & /vehicles
```

---

## 6. Key Functional Requirements & UI Specifications

### A. Master-Detail Maintenance Form (`maintenance-form-dialog.tsx`)
- **Master Fields:**
  - `vehicleId`: Dropdown pre-populated from the logged-in user's `Vehicle` table (with a quick "+ New Vehicle" button).
  - `serviceDate`: Date picker (stored as `DateTime`, formatted as `DD-MM-YYYY`).
- **Detail Fields (Dynamic Array via `useFieldArray`):**
  - Users can click **"+ Add Item"** to attach multiple remarks to a single service visit.
  - Each row contains:
    - `remark` (Text input, required — e.g., `"Change oil"`, `"Change air filter"`, `"Replace rear tire"`)
    - `priceUsd` (Number input, default `0.00`)
    - `priceKhr` (Number input, default `0`)
    - Remove row button (`Trash2` icon, minimum 1 row required).
  - Live footer calculation showing **Visit Subtotal USD** and **Visit Subtotal KHR**.
- **Edit & Delete Behavior:**
  - **Edit:** Opens the same dialog pre-filled with the master record and all existing detail rows. On save, runs a Prisma transaction that updates the master `serviceDate`/`vehicleId`, deletes removed items, updates existing items, and creates newly added items.
  - **Delete:** Confirmation dialog before deleting the `MaintenanceRecord` (cascades to `MaintenanceItem`).

### B. Timeline Visualization: Bottom-to-Top (`timeline-view.tsx`) & UX Recommendation
- **Requested Bottom-to-Top Single-Line Timeline:**
  - Query records ordered by `serviceDate ASC` (oldest at the bottom, newest at the top — achieved via `flex-col-reverse` on the container or sorting `serviceDate DESC` so the top node is the latest service and the vertical line connects downward to the oldest service at the bottom).
  - **Visual Structure:**
    - A continuous vertical line (`border-l-2 border-primary`) running along the left side with circular milestone nodes at each `serviceDate`.
    - Each node displays the **Date Badge** (`26-11-2026`), a card listing every **Remark** alongside its **USD** and **KHR** prices, the **Visit Total**, and **Edit / Delete** action buttons.
- **Recommended UX Enhancements (Best Practice):**
  1. **Top Summary KPI Bar:** Above the timeline, show 3 compact cards: *Total Service Visits*, *Total Spent (USD)*, and *Total Spent (KHR)* for that vehicle.
  2. **Search / Part Filter:** A quick filter input (e.g., typing `"oil"` or `"tire"`) that filters the timeline nodes so the user can immediately see when a specific part was last replaced and how many days ago it happened.
  3. **Newest-on-Top with Bottom-to-Top Growth Visual:** Keep the newest date (`26-11-2026`) at the top of the screen so users don't have to scroll past years of history to see their latest maintenance, while styling the vertical connector line with an upward arrow (`↑`) indicating chronological progression from bottom (oldest: `26-10-2026`) to top (latest: `26-11-2026`).

### C. Tabular PDF Export (`vehicle-report-pdf.tsx` & `/vehicles/[vehicleId]/print`)
- Triggered via an **"Export PDF"** button on the vehicle detail page.
- Renders a formal, structured **Table List** (instead of the timeline UI) containing:
  - **Header:** Vehicle Name (e.g., `Honda Dream 2017`), Plate Number, Export Date, and Owner Name.
  - **Table Columns:** `#` | `Date (DD-MM-YYYY)` | `Maintenance Remark / Part` | `USD ($)` | `KHR (៛)`
  - Multi-item visits group cleanly by date (showing the date on the first row or spanning rows) with a subtotal per visit and a **Grand Total (USD & KHR)** row at the bottom of the table.

---

## 7. Server Action Reference Implementation (`src/actions/maintenance.actions.ts`)

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maintenanceSchema, MaintenanceInput } from "@/lib/validations";

export async function upsertMaintenanceRecord(
  data: MaintenanceInput,
  recordId?: string
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;
  const parsed = maintenanceSchema.parse(data);

  // 1. Verify vehicle belongs to current user
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: parsed.vehicleId, userId },
  });
  if (!vehicle) {
    throw new Error("Vehicle not found or access denied");
  }

  // 2. Atomic Master-Detail transaction
  await prisma.$transaction(async (tx) => {
    if (recordId) {
      const existing = await tx.maintenanceRecord.findFirst({
        where: { id: recordId, userId },
      });
      if (!existing) throw new Error("Record not found or access denied");

      await tx.maintenanceItem.deleteMany({
        where: { maintenanceRecordId: recordId },
      });

      await tx.maintenanceRecord.update({
        where: { id: recordId },
        data: {
          vehicleId: parsed.vehicleId,
          serviceDate: new Date(parsed.serviceDate),
          items: {
            create: parsed.items.map((item) => ({
              remark: item.remark,
              priceUsd: item.priceUsd ?? 0,
              priceKhr: item.priceKhr ?? 0,
            })),
          },
        },
      });
    } else {
      await tx.maintenanceRecord.create({
        data: {
          userId,
          vehicleId: parsed.vehicleId,
          serviceDate: new Date(parsed.serviceDate),
          items: {
            create: parsed.items.map((item) => ({
              remark: item.remark,
              priceUsd: item.priceUsd ?? 0,
              priceKhr: item.priceKhr ?? 0,
            })),
          },
        },
      });
    }
  });

  revalidatePath(`/vehicles/${parsed.vehicleId}`); }  export async function deleteMaintenanceRecord(recordId: string) { const session = await auth(); if (!session?.user?.id) { throw new Error("Unauthorized"); }  const existing = await prisma.maintenanceRecord.findFirst({ where: { id: recordId, userId: session.user.id }, }); if (!existing) { throw new Error("Record not found or access denied"); }  await prisma.maintenanceRecord.delete({ where: { id: recordId }, });  revalidatePath(`/vehicles/${existing.vehicleId}`);
}
```

---

## 8. Development Timeline & Execution Phases

| Phase | Duration | Deliverables & Milestones |
| :--- | :--- | :--- |
| **Phase 1: Setup & Database** | Day 1 | Run initialization script, configure PostgreSQL connection, apply `prisma/schema.prisma` migrations, and set up Shadcn UI components. |
| **Phase 2: Authentication & Isolation** | Day 2 | Configure Auth.js (`login` & `register`), protect routes via `middleware.ts`, and verify strict `userId` session scoping across queries. |
| **Phase 3: Vehicle Management** | Day 3 | Build vehicle creation, editing, listing, and deletion (`vehicle.actions.ts`) so users can register vehicles (e.g., *Honda Dream 2017*). |
| **Phase 4: Master-Detail CRUD** | Days 4–5 | Build `maintenance-form-dialog.tsx` with dynamic remark/USD/KHR rows, live subtotals, transactional create/edit, and delete confirmation. |
| **Phase 5: Timeline View & UX** | Day 6 | Implement the bottom-to-top vertical timeline (`timeline-view.tsx`), KPI summary cards (Total USD/KHR), and keyword filter for parts/remarks. |
| **Phase 6: Tabular PDF Export & QA** | Day 7 | Implement `@react-pdf/renderer` tabular export per vehicle with grand totals, test multi-user isolation (User A cannot access User B), and deploy. |