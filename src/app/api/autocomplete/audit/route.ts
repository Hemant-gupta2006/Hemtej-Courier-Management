import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export interface AutocompleteAuditItem {
  type: string;
  fieldKey: string;
  storedValue: string;
  source: string;
  count: number;
  linkageStatus: string;
  matchedMasterId?: string | null;
  matchedMasterName?: string | null;
  canRename: boolean;
  aliases?: string[];
  partyId?: string;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "all";
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "15", 10) || 15));
    const skip = (page - 1) * pageSize;

    const searchPattern = `%${search}%`;

    // -------------------------------------------------------------
    // CATEGORY: System Enums
    // -------------------------------------------------------------
    if (category === "system") {
      const systemDefaults: AutocompleteAuditItem[] = [
        { type: "Transit Mode", fieldKey: "system", storedValue: "Surface, Air, Cargo, V Fast", source: "System Constants", count: 4, linkageStatus: "Built-in application options", canRename: false },
        { type: "Weight Unit", fieldKey: "system", storedValue: "gm, kg", source: "System Constants", count: 2, linkageStatus: "Built-in measurement units", canRename: false },
        { type: "Entry Status", fieldKey: "system", storedValue: "Cash, Account, Pending, Delivered", source: "System Defaults", count: 4, linkageStatus: "Courier status workflow", canRename: false },
      ];

      const filtered = search
        ? systemDefaults.filter(
            (s) =>
              s.storedValue.toLowerCase().includes(search.toLowerCase()) ||
              s.type.toLowerCase().includes(search.toLowerCase())
          )
        : systemDefaults;

      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + pageSize);

      return NextResponse.json({
        success: true,
        data: {
          items: paginated,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
          },
          summary: {
            totalReturned: paginated.length,
            totalMatches: total,
            category,
            search,
          },
        },
      });
    }

    // -------------------------------------------------------------
    // CATEGORY: Billing Masters
    // -------------------------------------------------------------
    if (category === "billingMaster") {
      const where: any = { userId };
      if (search) {
        where.OR = [
          { officialInvoiceName: { contains: search, mode: "insensitive" } },
          { aliases: { hasSome: [search] } },
          { gstNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, parties] = await Promise.all([
        prisma.billingParty.count({ where }),
        prisma.billingParty.findMany({
          where,
          select: {
            id: true,
            officialInvoiceName: true,
            aliases: true,
            isArchived: true,
            _count: { select: { invoices: true } },
          },
          orderBy: { officialInvoiceName: "asc" },
          skip,
          take: pageSize,
        }),
      ]);

      const items: AutocompleteAuditItem[] = parties.map((p) => ({
        type: "Billing Master Party",
        fieldKey: "billingMaster",
        storedValue: p.officialInvoiceName,
        source: "Database (BillingParty)",
        count: p._count.invoices,
        aliases: p.aliases,
        linkageStatus: p.isArchived ? "Archived Master" : "Active Master",
        partyId: p.id,
        canRename: false,
      }));

      return NextResponse.json({
        success: true,
        data: {
          items,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
          },
          summary: {
            totalReturned: items.length,
            totalMatches: total,
            category,
            search,
          },
        },
      });
    }

    // -------------------------------------------------------------
    // CATEGORIES: All Suggestions, From Party, To Party, Destination
    // Optimized single database aggregation via SQL CTE
    // -------------------------------------------------------------
    let rows: any[] = [];

    if (category === "all") {
      rows = await prisma.$queryRaw`
        WITH combined AS (
          -- 1. fromParty
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
            ${search ? Prisma.sql`AND "fromParty" ILIKE ${searchPattern}` : Prisma.empty}
            AND LOWER(TRIM("fromParty")) NOT IN (
              SELECT "entityId" FROM "AuditLog"
              WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('fromParty', 'all')
            )
          GROUP BY "fromParty"

          UNION ALL

          -- 2. toParty
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
            ${search ? Prisma.sql`AND "toParty" ILIKE ${searchPattern}` : Prisma.empty}
            AND LOWER(TRIM("toParty")) NOT IN (
              SELECT "entityId" FROM "AuditLog"
              WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('toParty', 'all')
            )
          GROUP BY "toParty"

          UNION ALL

          -- 3. destination
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
            ${search ? Prisma.sql`AND "destination" ILIKE ${searchPattern}` : Prisma.empty}
            AND LOWER(TRIM("destination")) NOT IN (
              SELECT "entityId" FROM "AuditLog"
              WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('destination', 'all')
            )
          GROUP BY "destination"

          UNION ALL

          -- 4. billingMaster
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
            ${search ? Prisma.sql`AND (bp."officialInvoiceName" ILIKE ${searchPattern} OR array_to_string(bp.aliases, ',') ILIKE ${searchPattern})` : Prisma.empty}
          GROUP BY bp.id, bp."officialInvoiceName", bp.aliases, bp."isArchived"

          UNION ALL

          -- 5. system constants
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
          WHERE 'Surface, Air, Cargo, V Fast' ILIKE ${searchPattern} OR 'Transit Mode' ILIKE ${searchPattern}

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
          WHERE 'gm, kg' ILIKE ${searchPattern} OR 'Weight Unit' ILIKE ${searchPattern}

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
          WHERE 'Cash, Account, Pending, Delivered' ILIKE ${searchPattern} OR 'Entry Status' ILIKE ${searchPattern}
        ),
        counted AS (
          SELECT *, COUNT(*) OVER()::int AS "fullCount" FROM combined
        )
        SELECT * FROM counted
        ORDER BY count DESC
        LIMIT ${pageSize} OFFSET ${skip};
      `;
    } else if (category === "fromParty") {
      rows = await prisma.$queryRaw`
        WITH grouped AS (
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
            ${search ? Prisma.sql`AND "fromParty" ILIKE ${searchPattern}` : Prisma.empty}
            AND LOWER(TRIM("fromParty")) NOT IN (
              SELECT "entityId" FROM "AuditLog"
              WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('fromParty', 'all')
            )
          GROUP BY "fromParty"
        ),
        counted AS (
          SELECT *, COUNT(*) OVER()::int AS "fullCount" FROM grouped
        )
        SELECT * FROM counted
        ORDER BY count DESC
        LIMIT ${pageSize} OFFSET ${skip};
      `;
    } else if (category === "toParty") {
      rows = await prisma.$queryRaw`
        WITH grouped AS (
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
            ${search ? Prisma.sql`AND "toParty" ILIKE ${searchPattern}` : Prisma.empty}
            AND LOWER(TRIM("toParty")) NOT IN (
              SELECT "entityId" FROM "AuditLog"
              WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('toParty', 'all')
            )
          GROUP BY "toParty"
        ),
        counted AS (
          SELECT *, COUNT(*) OVER()::int AS "fullCount" FROM grouped
        )
        SELECT * FROM counted
        ORDER BY count DESC
        LIMIT ${pageSize} OFFSET ${skip};
      `;
    } else if (category === "destination") {
      rows = await prisma.$queryRaw`
        WITH grouped AS (
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
            ${search ? Prisma.sql`AND "destination" ILIKE ${searchPattern}` : Prisma.empty}
            AND LOWER(TRIM("destination")) NOT IN (
              SELECT "entityId" FROM "AuditLog"
              WHERE action = 'EXCLUDED_SUGGESTION' AND "oldValue" = ${userId} AND entity IN ('destination', 'all')
            )
          GROUP BY "destination"
        ),
        counted AS (
          SELECT *, COUNT(*) OVER()::int AS "fullCount" FROM grouped
        )
        SELECT * FROM counted
        ORDER BY count DESC
        LIMIT ${pageSize} OFFSET ${skip};
      `;
    }

    // Determine total and totalPages directly from SQL window function
    const total = rows.length > 0 ? rows[0].fullCount : 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // Master linkage resolution ONLY for fromParty items on the requested page (max pageSize items)
    const fromPartyValuesOnPage = rows
      .filter((r) => r.fieldKey === "fromParty")
      .map((r) => r.storedValue);

    const partyLinkageMap = new Map<
      string,
      { status: string; id: string | null; name: string | null }
    >();

    if (fromPartyValuesOnPage.length > 0) {
      const matchedParties = await prisma.billingParty.findMany({
        where: {
          userId,
          OR: [
            { officialInvoiceName: { in: fromPartyValuesOnPage, mode: "insensitive" } },
            { aliases: { hasSome: fromPartyValuesOnPage } },
          ],
        },
        select: { id: true, officialInvoiceName: true, aliases: true },
      });

      for (const name of fromPartyValuesOnPage) {
        const lower = name.toLowerCase();
        const directMatch = matchedParties.find(
          (p) => p.officialInvoiceName.toLowerCase() === lower
        );
        const aliasMatch = matchedParties.find((p) =>
          p.aliases.some((a) => a.toLowerCase() === lower)
        );

        if (directMatch) {
          partyLinkageMap.set(lower, {
            status: "Official Master Name",
            id: directMatch.id,
            name: directMatch.officialInvoiceName,
          });
        } else if (aliasMatch) {
          partyLinkageMap.set(lower, {
            status: `Alias of "${aliasMatch.officialInvoiceName}"`,
            id: aliasMatch.id,
            name: aliasMatch.officialInvoiceName,
          });
        } else {
          partyLinkageMap.set(lower, {
            status: "Unlinked booking name",
            id: null,
            name: null,
          });
        }
      }
    }

    // Map rows into client-friendly AutocompleteAuditItem format
    const items: AutocompleteAuditItem[] = rows.map((r) => {
      if (r.fieldKey === "fromParty") {
        const link = partyLinkageMap.get(r.storedValue.toLowerCase()) || {
          status: "Unlinked booking name",
          id: null,
          name: null,
        };
        return {
          type: r.type,
          fieldKey: r.fieldKey,
          storedValue: r.storedValue,
          source: r.source,
          count: Number(r.count),
          linkageStatus: link.status,
          matchedMasterId: link.id,
          matchedMasterName: link.name,
          canRename: Boolean(r.canRename),
          aliases: r.aliases || undefined,
          partyId: r.partyId || undefined,
        };
      }

      return {
        type: r.type,
        fieldKey: r.fieldKey,
        storedValue: r.storedValue,
        source: r.source,
        count: Number(r.count),
        linkageStatus: r.linkageStatus,
        matchedMasterId: null,
        matchedMasterName: null,
        canRename: Boolean(r.canRename),
        aliases: r.aliases || undefined,
        partyId: r.partyId || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
        summary: {
          totalReturned: items.length,
          totalMatches: total,
          category,
          search,
        },
      },
    });
  } catch (error) {
    console.error("[AUTOCOMPLETE_AUDIT_ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
