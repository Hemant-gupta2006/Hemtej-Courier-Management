# Courier Management System - Project Architecture

> **This is the living technical documentation for the Courier Management System.**
> It must be updated whenever a new feature is successfully implemented or an architectural decision changes.

---

## 1. Project Overview

The Courier Management System is a specialized operational application designed for managing dispatch logs, Excel synchronization, and monthly billing for a courier business. 

**Real-world Problem:** Multiple physical/logical working registers are used to log outbound/inbound courier entries during the month. These registers are ultimately consolidated, exported to Excel for specialized offline editing (specifically for assigning final freight amounts), and then imported back to synchronize the database before generating final customer bills.

**What this system is NOT:**
- This is NOT a multi-industry ERP.
- This is NOT a generic restaurant, inventory, or medical application.
- It is tightly coupled to the exact workflow of this specific courier management lifecycle.

---

## 2. Current Technology Stack

The application is built on a modern full-stack TypeScript architecture:

- **Framework**: Next.js 16 (App Router)
- **Frontend**: React 19, TailwindCSS v4, Framer Motion
- **UI Components**: custom `shadcn/ui`, `lucide-react` icons
- **Data Tables**: `@tanstack/react-table`
- **Backend**: Next.js API Routes (Serverless architecture)
- **Database**: PostgreSQL
- **ORM**: Prisma Client v6
- **Authentication**: NextAuth.js (v4) with Prisma Adapter
- **Excel Handling**: `xlsx` (parsing/reading), `exceljs` (writing/formatting)

---

## 3. High-Level Architecture

```text
Browser (React / Tailwind)
  ↓ (HTTP / JSON)
Next.js App Router (API Routes / Server Actions)
  ↓ (Prisma Client)
Prisma ORM
  ↓ (TCP / PostgreSQL Protocol)
PostgreSQL Database
```

**Deployment Assumption**: The application is built using a serverless architecture pattern via Next.js. State is strictly persisted in the PostgreSQL database. There are no stateful background processes or in-memory shared states between requests.

---

## 4. Repository Structure

- `src/app/` - Next.js App Router. Contains page layouts and API routes.
  - `api/` - Backend endpoints (couriers, auth, reports, billing).
  - `dashboard/` - Protected application UI.
- `src/components/` - Reusable UI components (Sidebar, Modals, Forms).
  - `ui/` - Low-level UI primitives (shadcn).
- `src/lib/` - Shared utilities (Prisma client instance, NextAuth config, formatting).
- `src/context/` - React Context providers (Register management).
- `prisma/` - Database schema and migrations.
- `docs/` - Project documentation (this file).

---

## 5. Database Architecture

The system uses a highly relational PostgreSQL schema accessed via Prisma.

### Core Models:

- **`User`**: System administrators/staff.
- **`CourierRegister`**: A logical collection of entries belonging to a specific user, month, and year. 
  - *Fields*: `name`, `month`, `year`, `status` ("Active", "Locked", "Archived").
  - *Cascade*: Deleting a Register cascade-deletes all its Entries.
- **`CourierEntry`**: The central record representing a single physical shipment/dispatch.
  - *Fields*: `srNo`, `challanNo`, `fromParty`, `toParty`, `date`, `amount`, `weightValue`, `weightUnit`.
  - *Identity*: Enforces `@@unique([challanNo, userId])`.
  - *Relation*: Belongs to one `CourierRegister`.
- **`AuditLog`**: Stores JSON strings of destructive or bulk actions (Imports, Merges) for traceability.

---

## 6. CourierEntry Identity Rules

### SR.No (Serial Number)
- **What it represents**: A chronologically incrementing display number for the UI.
- **Scope**: Globally sequential **per user**, across all registers.
- **Generation**: Created automatically during record insertion (`Math.max(srNo) + 1` for the user).
- **Rule**: It must **never** be renumbered or recalculated once assigned. It remains completely static during physical register merges and Excel imports.

### Challan No
- **What it represents**: The physical receipt/waybill number.
- **Uniqueness**: Globally unique per user `@@unique([challanNo, userId])`. It is strictly impossible for two registers to share a Challan No.
- **Excel Sync**: `challanNo` is the absolute primary key used to match rows during Excel Import.

### registerId
- **What it represents**: The physical grouping for the entry.
- **Mutability**: `registerId` can be safely changed to move a record between registers (e.g., during a Physical Merge) without breaking the record's identity or affecting billing.

---

## 7. Register Lifecycle

Registers group records for operational sanity.
- **Active**: Normal working register.
- **Archived**: Read-only, historical, or emptied source registers.

### Physical Register Merge
When two or more registers are combined, it is a **Physical Merge**, not a virtual view.
- **Validation**: All source registers must belong to the authenticated user, be "Active", and share the exact same `month` and `year`.
- **Execution**: A strict Prisma `$transaction` verifies the exact `expectedEntryCount`, creates a new combined register, explicitly updates `registerId` on all matching entries, and then marks the source registers as "Archived".
- **Preservation**: `srNo`, `challanNo`, and all business data remain byte-identical.

---

## 8. Courier Entry Workflow

1. **Create**: User adds a record manually or via `NEW_IN_EXCEL` import.
2. **Assign Identity**: System validates `challanNo` uniqueness and assigns the next global `srNo`.
3. **Save**: Record is bound to the active `registerId`.
4. **Edit**: Quick-edit amount via optimized table component, or full edit modal.
5. **Export**: Exported to Excel for offline batch processing.
6. **Import**: Modified Excel is re-imported.
7. **Billing**: Finalized records are queried by date range for customer invoices.

---

## 9. Excel Export Workflow

- **Endpoint**: `GET /api/couriers/export`
- **Behavior**: Retrieves records based on applied UI filters (e.g., specific register, specific dates, or global).
- **Formatting**: Uses `exceljs` to apply specialized color coding, column widths, and strict date formatting.
- **Scope limitation**: The exported file may represent a *subset* of the total database, which strictly informs how the Import logic detects missing records.

---

## 10. Excel Import / Synchronization Architecture

This is the most dangerous and critical workflow in the application.

1. **Upload & Parse**: Frontend parses `.xlsx` and sends a JSON payload to `POST /api/couriers/import-preview`.
2. **Matching**: The API fetches all existing database records within the dataset's date range and matches rows strictly by `challanNo`.
3. **Normalization**:
   - *Dates*: Excel serial dates are converted to exact `YYYY-MM-DD` strings before comparison. Timezone shifting is strictly prevented.
   - *Weights*: Formatted aggressively (e.g., "100 gm") to match string comparisons.
4. **Diff Engine**: Determines `UNCHANGED`, `CHANGED` (field-level granularity), `NEW_IN_EXCEL`, or `MISSING_FROM_EXCEL`.
5. **Safety**: `MISSING_FROM_EXCEL` is only calculated if the upload is assumed to be a complete snapshot, preventing accidental deletions from filtered exports.
6. **Execution**: User confirms the diff. `POST /api/couriers/import` runs a massive Prisma `$transaction` applying all authorized updates and inserts, generating a single `AuditLog`.

**Protected Fields**: System fields (`srNo`, `registerId`, `createdAt`) cannot be mutated via Excel import.

---

## 11. NEW_IN_EXCEL Behavior

If the Excel import contains a `Challan No` not present in the database:
- **Detection**: Marked as `NEW_IN_EXCEL`.
- **Action**: The UI displays it in a dedicated tab. The user can explicitly select "Add to Database".
- **Insertion**: The backend safely creates the record, assigning a fresh global `srNo`, and places it in the currently active `registerId`.

---

## 12. Import Preview UI

The React component (`ImportPreviewModal.tsx`) acts as the safety buffer before data mutation.
- Categorized tabs: Summary, Changes, New, Missing, Errors.
- Visual side-by-side field diffs highlighting exactly what changed.
- Granular checkboxes allowing partial import commits.

---

## 13. Bill Generation Workflow

- **Endpoint**: `POST /api/reports/billing`
- **Mechanism**: Generates invoices for a specific `fromParty` across a strict `date` range.
- **Register Independence**: Billing queries `CourierEntry` directly using `where: { userId, fromParty, date: { gte, lte } }`. It completely ignores `registerId`.

---

## 14. Authentication & Authorization

- Uses `NextAuth.js`.
- Every API endpoint requires `getServerSession`.
- **Enforcement**: Almost every Prisma query enforces ownership by inherently requiring `userId` in the `where` clause (e.g., `where: { challanNo, userId }`).

---

## 15. API Map

| API | Method | Purpose | Important Inputs |
|---|---|---|---|
| `/api/couriers/import-preview` | POST | Dry-run Excel sync | Parsed Excel JSON |
| `/api/couriers/import` | POST | Commit Excel sync | Authorized diff payload |
| `/api/couriers/registers/combine` | POST | Physical merge | `sourceRegisterIds`, `newRegisterName` |
| `/api/reports/billing` | POST | Generate bill data | `fromParty`, `startDate`, `endDate` |

---

## 16. Frontend Architecture

- **State**: The `RegisterContext` tracks the global `activeRegister` and triggers refetches across the application.
- **Tables**: Built on TanStack Table for headless virtualization and sorting.

---

## 17. Existing Performance Optimizations

### Amount Entry Lag Fix
**Problem**: Typing into the "Amount" field caused the entire data table to re-render on every keystroke, resulting in severe typing lag.
**Solution**: The Amount cell utilizes local React component state. Keystrokes only update local state. The backend Prisma mutation is only dispatched on `onBlur` or `Enter` keypress. This optimization must not be removed.

---

## 18. Audit & Data Safety

- `Prisma.$transaction` is strictly used for any operation modifying more than one record (Merges, Imports).
- Destructive operations generate a JSON payload stored in the `AuditLog` table for disaster recovery tracking.

---

## 19. Critical Business Rules
### DO NOT BREAK THESE RULES

- **SR.No immutability**: Once assigned, an SR.No must never be recalculated or shifted.
- **Challan Uniqueness**: Enforced unconditionally per user.
- **Billing Independence**: Bills rely on Dates and Parties, never on Register IDs.
- **Date Normalization**: All incoming Excel dates must be canonicalized to `YYYY-MM-DD` string matching the DB format.
- **Transaction Atomicity**: Complex bulk updates must entirely succeed or completely roll back.

---

## 20. Architectural Decisions

### Decision: Physical Register Merge
*Decision*: Merging registers performs a physical database move (updating `registerId`), rather than rendering a virtual SQL union.
*Reason*: The business workflow relies heavily on exporting a physical snapshot to Excel, handing it off for offline editing, and re-importing. Keeping the dataset bound to a single physical register keeps the Export/Import logic simple and predictable.
*Consequences*: Source registers become empty and are archived.

---

## 21. Completed Features

- **Courier Register System** (Core)
- **Excel Export** with formatted dates/weights
- **Excel Import / Diff Engine** (Multi-field change detection)
- **Amount Entry Performance Optimization** (Local state blur-commit)
- **NEW_IN_EXCEL Insertion** logic
- **Physical Register Merge** (August 9, 2026) - Safe transactional `registerId` migration.

---

## 22. Known Limitations

- Excel importing currently assumes a relatively strict column layout based on the app's own export format. Heavily malformed external vendor sheets will fail validation.
- Billing is tightly coupled to `fromParty` exact string matches.

---

## 23. Technical Debt

- **Low Risk**: The React Context for registers causes minor prop-drilling in certain deep modal components.
- **Medium Risk**: Excel date parsing relies on hardcoded Excel serial decimal math rather than native library Date object conversions in some edge cases.

---

## 24. Dangerous Areas
### Areas Future Features Must Inspect Before Modification

- **Excel Import (`api/couriers/import-preview/route.ts`)**: Modifying the comparison logic here risks creating false-positive diffs, leading to catastrophic accidental overwrites.
- **CourierEntry Schema**: Changing `challanNo` or `srNo` rules will instantly break the Excel importer and the display logic.
- **Amount Input Component**: Adding global context updates to this component will reintroduce the severe typing lag.

---

## 25. Feature Development Protocol

**INSTRUCTIONS FOR ANTIGRAVITY AGENTS:**

Whenever a new feature is requested:
1. **READ THIS FILE FIRST.**
2. Inspect the current implementation relevant to the feature.
3. Identify which existing workflows (Excel, Billing, Registers) could be affected.
4. Identify database and API dependencies.
5. Before coding, write a brief implementation plan explaining:
   - Required behavior
   - Files likely affected
   - What must remain strictly unchanged
6. Implement the smallest safe change. Do NOT casually refactor working code.
7. Manually verify existing workflows affected by the change.
8. **UPDATE THIS DOCUMENT** after the feature is successfully implemented.

This document must be treated as a LIVING DOCUMENT representing the exact current state of the application.
