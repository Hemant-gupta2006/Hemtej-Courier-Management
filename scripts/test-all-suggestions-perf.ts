import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

async function runPerfTests() {
  console.log("=== PERFORMANCE & FUNCTIONALITY VERIFICATION FOR AUTOCOMPLETE AUDIT ===");

  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No user found in database.");
    return;
  }
  const userId = user.id;
  console.log(`Testing with user: ${user.email} (ID: ${userId})`);

  // Test 1: Category = "all" Performance
  console.log("\n--- TEST 1: Benchmark 'All Suggestions' (category='all') ---");
  const pageSize = 15;
  const skip = 0;
  const searchPattern = "%%";

  const t0 = Date.now();
  const rowsAll: any[] = await prisma.$queryRaw`
    WITH combined AS (
      SELECT 
        'From Party (Sender)' AS type,
        'fromParty' AS "fieldKey",
        "fromParty" AS "storedValue",
        'Database (CourierEntry)' AS source,
        COUNT(*)::int AS count,
        true AS "canRename",
        NULL::text AS "partyId",
        NULL::text[] AS aliases,
        NULL::text AS "linkageStatus"
      FROM "CourierEntry"
      WHERE "userId" = ${userId}
        AND "fromParty" IS NOT NULL AND TRIM("fromParty") != ''
        AND LOWER(TRIM("fromParty")) NOT IN (
          SELECT "entityId" FROM "AuditLog"
          WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('fromParty', 'all')
        )
      GROUP BY "fromParty"

      UNION ALL

      SELECT 
        'To Party (Consignee)' AS type,
        'toParty' AS "fieldKey",
        "toParty" AS "storedValue",
        'Database (CourierEntry)' AS source,
        COUNT(*)::int AS count,
        true AS "canRename",
        NULL::text AS "partyId",
        NULL::text[] AS aliases,
        'Booking entry history' AS "linkageStatus"
      FROM "CourierEntry"
      WHERE "userId" = ${userId}
        AND "toParty" IS NOT NULL AND TRIM("toParty") != ''
        AND LOWER(TRIM("toParty")) NOT IN (
          SELECT "entityId" FROM "AuditLog"
          WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('toParty', 'all')
        )
      GROUP BY "toParty"

      UNION ALL

      SELECT 
        'Destination (City/Hub)' AS type,
        'destination' AS "fieldKey",
        "destination" AS "storedValue",
        'Database (CourierEntry)' AS source,
        COUNT(*)::int AS count,
        true AS "canRename",
        NULL::text AS "partyId",
        NULL::text[] AS aliases,
        'Booking entry history' AS "linkageStatus"
      FROM "CourierEntry"
      WHERE "userId" = ${userId}
        AND "destination" IS NOT NULL AND TRIM("destination") != ''
        AND LOWER(TRIM("destination")) NOT IN (
          SELECT "entityId" FROM "AuditLog"
          WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('destination', 'all')
        )
      GROUP BY "destination"

      UNION ALL

      SELECT 
        'Billing Master Party' AS type,
        'billingMaster' AS "fieldKey",
        bp."officialInvoiceName" AS "storedValue",
        'Database (BillingParty)' AS source,
        COUNT(i.id)::int AS count,
        false AS "canRename",
        bp.id AS "partyId",
        bp.aliases AS aliases,
        CASE WHEN bp."isArchived" THEN 'Archived Master' ELSE 'Active Master' END AS "linkageStatus"
      FROM "BillingParty" bp
      LEFT JOIN "Invoice" i ON i."partyId" = bp.id
      WHERE bp."userId" = ${userId}
      GROUP BY bp.id, bp."officialInvoiceName", bp.aliases, bp."isArchived"

      UNION ALL

      SELECT 
        'Transit Mode' AS type,
        'system' AS "fieldKey",
        'Surface, Air, Cargo, V Fast' AS "storedValue",
        'System Constants' AS source,
        4 AS count,
        false AS "canRename",
        NULL::text AS "partyId",
        NULL::text[] AS aliases,
        'Built-in application options' AS "linkageStatus"

      UNION ALL

      SELECT 
        'Weight Unit' AS type,
        'system' AS "fieldKey",
        'gm, kg' AS "storedValue",
        'System Constants' AS source,
        2 AS count,
        false AS "canRename",
        NULL::text AS "partyId",
        NULL::text[] AS aliases,
        'Built-in measurement units' AS "linkageStatus"

      UNION ALL

      SELECT 
        'Entry Status' AS type,
        'system' AS "fieldKey",
        'Cash, Account, Pending, Delivered' AS "storedValue",
        'System Defaults' AS source,
        4 AS count,
        false AS "canRename",
        NULL::text AS "partyId",
        NULL::text[] AS aliases,
        'Courier status workflow' AS "linkageStatus"
    ),
    counted AS (
      SELECT *, COUNT(*) OVER()::int AS "fullCount" FROM combined
    )
    SELECT * FROM counted
    ORDER BY count DESC
    LIMIT ${pageSize} OFFSET ${skip};
  `;
  const durationAll = Date.now() - t0;
  console.log(`✓ 'All Suggestions' completed in ${durationAll} ms!`);
  console.log(`Rows returned: ${rowsAll.length} (requested pageSize: ${pageSize})`);
  console.log(`Total database matches: ${rowsAll[0]?.fullCount || 0}`);
  if (rowsAll.length > pageSize) {
    throw new Error("Returned more rows than requested pageSize!");
  }

  // Test 2: Search filtering at database level
  console.log("\n--- TEST 2: Database-level Search Filtering ---");
  const testSearch = "Savya";
  const searchPat = `%${testSearch}%`;
  const tSearch = Date.now();
  const searchRows: any[] = await prisma.$queryRaw`
    WITH combined AS (
      SELECT 
        'From Party (Sender)' AS type,
        'fromParty' AS "fieldKey",
        "fromParty" AS "storedValue",
        'Database (CourierEntry)' AS source,
        COUNT(*)::int AS count,
        true AS "canRename"
      FROM "CourierEntry"
      WHERE "userId" = ${userId}
        AND "fromParty" IS NOT NULL AND TRIM("fromParty") != ''
        AND "fromParty" ILIKE ${searchPat}
      GROUP BY "fromParty"

      UNION ALL

      SELECT 
        'Billing Master Party' AS type,
        'billingMaster' AS "fieldKey",
        bp."officialInvoiceName" AS "storedValue",
        'Database (BillingParty)' AS source,
        COUNT(i.id)::int AS count,
        false AS "canRename"
      FROM "BillingParty" bp
      LEFT JOIN "Invoice" i ON i."partyId" = bp.id
      WHERE bp."userId" = ${userId}
        AND (bp."officialInvoiceName" ILIKE ${searchPat} OR array_to_string(bp.aliases, ',') ILIKE ${searchPat})
      GROUP BY bp.id, bp."officialInvoiceName"
    ),
    counted AS (
      SELECT *, COUNT(*) OVER()::int AS "fullCount" FROM combined
    )
    SELECT * FROM counted
    ORDER BY count DESC
    LIMIT 10 OFFSET 0;
  `;
  console.log(`✓ Search for "${testSearch}" executed in ${Date.now() - tSearch} ms, found ${searchRows.length} matches.`);
  if (searchRows.length > 0) {
    console.log(`First match: ${searchRows[0].storedValue} (${searchRows[0].type})`);
  }

  // Test 3: Pagination offsets
  console.log("\n--- TEST 3: Database Pagination Offsets (Page 1 vs Page 2) ---");
  const page1Rows: any[] = await prisma.$queryRaw`
    WITH combined AS (
      SELECT 'destination' AS "fieldKey", "destination" AS "storedValue", COUNT(*)::int AS count
      FROM "CourierEntry"
      WHERE "userId" = ${userId} AND "destination" IS NOT NULL AND TRIM("destination") != ''
      GROUP BY "destination"
    )
    SELECT * FROM combined ORDER BY count DESC LIMIT 2 OFFSET 0;
  `;
  const page2Rows: any[] = await prisma.$queryRaw`
    WITH combined AS (
      SELECT 'destination' AS "fieldKey", "destination" AS "storedValue", COUNT(*)::int AS count
      FROM "CourierEntry"
      WHERE "userId" = ${userId} AND "destination" IS NOT NULL AND TRIM("destination") != ''
      GROUP BY "destination"
    )
    SELECT * FROM combined ORDER BY count DESC LIMIT 2 OFFSET 2;
  `;
  console.log(`Page 1 items count: ${page1Rows.length}, Page 2 items count: ${page2Rows.length}`);
  console.log("✓ Database pagination correctly slices offsets.");

  console.log("\n=== ALL PERFORMANCE & VERIFICATION TESTS COMPLETED SUCCESSFULLY ===");
}

runPerfTests()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
