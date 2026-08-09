import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import ExcelJS from "exceljs";
import { formatWeight } from "@/lib/utils";
import { recordActivity } from "@/lib/activityLog";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const partyId = searchParams.get("partyId") || undefined;
    const partyNames = searchParams.getAll("partyName").map(p => p.trim()).filter(Boolean);
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    // Advanced Details
    const billNo = searchParams.get("billNo") || "";
    const invoiceDateStr = searchParams.get("invoiceDate") || new Date().toISOString().split('T')[0];
    const partyAddress1 = searchParams.get("partyAddress1") || "";
    const partyAddress2 = searchParams.get("partyAddress2") || "";
    const partyCity = searchParams.get("partyCity") || "";
    const partyState = searchParams.get("partyState") || "";
    const partyPincode = searchParams.get("partyPincode") || "";
    const partyContact = searchParams.get("partyContact") || "";
    const partyGst = searchParams.get("partyGst") || "";
    const businessName = searchParams.get("businessName") || "SEETARAM ENTERPRISE";
    const businessAddress = searchParams.get("businessAddress") || "Shop no.04, Dave Chawl, Near Kamu, Baba, SV Road, Opp. Patker College, Goregaon West, Mumbai 400104";
    const businessContact = searchParams.get("businessContact") || "+91 9892796228";
    const businessGst = searchParams.get("businessGst") || "27AYDPG0955B1ZV";

    // Split business address into lines for the header
    const businessAddressLines = businessAddress.split(',').map(s => s.trim());
    const line1 = businessAddressLines.slice(0, 2).join(', ');
    const line2 = businessAddressLines.slice(2, 5).join(', ');
    const line3 = businessAddressLines.slice(5).join(', ');
    const billingPartyName = searchParams.get("billingPartyName") || partyNames[0] || "";

    const where: any = {
      userId: (session.user as any).id,
    };

    if (partyNames.length > 0) {
      where.OR = partyNames.map(name => ({
        fromParty: { equals: name, mode: "insensitive" }
      }));
    }

    if (startDateStr || endDateStr) {
      where.date = {};
      if (startDateStr) where.date.gte = new Date(startDateStr);
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const entries = await prisma.courierEntry.findMany({
      where,
      orderBy: { date: "asc" },
    });

    if (entries.length === 0) {
      return new NextResponse("No billing entries found", { status: 404 });
    }

    const rawGrossAmount = entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const grossAmount = Number(rawGrossAmount.toFixed(2));
    const cgst = Number((grossAmount * 0.09).toFixed(2));
    const sgst = Number((grossAmount * 0.09).toFixed(2));
    const igst = 0;
    
    const netAmount = Number((grossAmount + cgst + sgst + igst).toFixed(2));

    let invoiceId: string | undefined;

    if (partyId) {
      const party = await prisma.billingParty.findUnique({ where: { id: partyId } });
      if (party) {
        const partySnapshot = {
          officialInvoiceName: party.officialInvoiceName,
          addressLine1: partyAddress1 || party.addressLine1,
          addressLine2: partyAddress2 || party.addressLine2,
          city: partyCity || party.city,
          state: partyState || party.state,
          pincode: partyPincode || party.pincode,
          contactNumber: partyContact || party.contactNumber,
          gstNumber: partyGst || party.gstNumber,
        };

        const businessSnapshot = {
          businessName,
          businessAddress,
          businessContact,
          businessGst
        };

        const newInvoice = await prisma.invoice.create({
          data: {
            userId: (session.user as any).id,
            billNo: billNo || null,
            invoiceDate: new Date(invoiceDateStr),
            partyId,
            partySnapshot,
            businessSnapshot,
            entriesCount: entries.length,
            grossAmount,
            cgst,
            sgst,
            igst,
            netAmount,
          }
        });

        invoiceId = newInvoice.id;

        await prisma.courierEntry.updateMany({
          where: { id: { in: entries.map(e => e.id) } },
          data: { invoiceId }
        });
      }
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Account Billing", {
      pageSetup: { paperSize: 9, orientation: 'portrait' }
    });

    // ───────────────────────────────────────────
    // Column Configuration
    // ───────────────────────────────────────────
    worksheet.columns = [
      { header: "S.L. NO.", key: "sl", width: 8 },
      { header: "DATE", key: "date", width: 14 },
      { header: "AWB NO.", key: "awb", width: 25 },
      { header: "DESTINATION", key: "dest", width: 25 },
      { header: "WEIGHT", key: "weight", width: 12 },
      { header: "AMOUNT", key: "amount", width: 12 },
    ];

    // ───────────────────────────────────────────
    // Header Section
    // ───────────────────────────────────────────

    // Row 1: TAX INVOICE
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'TAX INVOICE';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Common styling for header labels
    const headerFont = { bold: true, size: 10 };
    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Helper to set cell value and style
    const setHeaderCell = (cell: string, label: string, value: string = "", isBoldValue: boolean = false) => {
      const c = worksheet.getCell(cell);
      c.value = label + value;
      c.font = { bold: isBoldValue, size: 10 };
      c.border = borderStyle;
    };

    // Row 2
    worksheet.mergeCells('A2:C2');
    worksheet.mergeCells('D2:F2');
    setHeaderCell('A2', 'Bill No :- ', billNo);
    setHeaderCell('D2', 'DATE : ', new Date(invoiceDateStr).toLocaleDateString('en-GB'), true);

    // Row 3
    worksheet.mergeCells('A3:C3');
    worksheet.mergeCells('D3:F3');
    setHeaderCell('A3', 'Bill From:');
    setHeaderCell('D3', 'Bill To :');

    // Row 4
    worksheet.mergeCells('A4:C4');
    worksheet.mergeCells('D4:F4');
    setHeaderCell('A4', businessName, "", true);
    setHeaderCell('D4', billingPartyName || "", "", true);

    // Row 5
    worksheet.mergeCells('A5:C5');
    worksheet.mergeCells('D5:F5');
    setHeaderCell('A5', line1 || "Shop no.04, Dave Chawl, Near Kamu");
    setHeaderCell('D5', partyAddress1);

    // Row 6
    worksheet.mergeCells('A6:C6');
    worksheet.mergeCells('D6:F6');
    setHeaderCell('A6', line2 || "Baba, SV Road, Opp. Patker College");
    setHeaderCell('D6', partyAddress2);

    // Row 7
    worksheet.mergeCells('A7:C7');
    worksheet.mergeCells('D7:F7');
    setHeaderCell('A7', line3 || "Goregaon West, Mumbai 400104");
    setHeaderCell('D7', `${partyCity}${partyCity && partyState ? ', ' : ''}${partyState} ${partyPincode}`.trim());

    // Row 8
    worksheet.mergeCells('A8:C8');
    worksheet.mergeCells('D8:F8');
    setHeaderCell('A8', 'Contact no. ' + businessContact);
    setHeaderCell('D8', partyContact ? 'Contact no. ' + partyContact : '');

    // Row 9
    worksheet.mergeCells('A9:C9');
    worksheet.mergeCells('D9:F9');
    setHeaderCell('A9', 'GST NO : ' + businessGst, "", true);
    setHeaderCell('D9', 'GST NO : ' + partyGst, "", !!partyGst);

    // ───────────────────────────────────────────
    // Table Header (Row 10)
    // ───────────────────────────────────────────
    const tableHeaderRow = worksheet.getRow(10);
    tableHeaderRow.values = ["S.L. NO.", "DATE", "AWB NO.", "DESTINATION", "WEIGHT", "AMOUNT"];
    tableHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.border = borderStyle;
      cell.alignment = { horizontal: 'center' };
    });

    // ───────────────────────────────────────────
    // Data Population
    // ───────────────────────────────────────────
    let currentRow = 11;
    const startDataRow = currentRow;

    entries.forEach((entry, index) => {
      const row = worksheet.getRow(currentRow);
      row.values = [
        index + 1,
        entry.date.toLocaleDateString('en-GB'),
        entry.challanNo,
        entry.destination,
        formatWeight(entry.weightValue, entry.weightUnit),
        entry.amount || 0
      ];
      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.font = { size: 10 };
        if (colNumber === 1 || colNumber === 2) cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (colNumber === 6) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0';
        }
        if (colNumber >= 3 && colNumber <= 5) cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      });
      row.height = 20;
      currentRow++;
    });

    const endDataRow = currentRow - 1;

    // ───────────────────────────────────────────
    // GST Calculations Section (Dynamic Formulas)
    // ───────────────────────────────────────────

    // In Words row
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    const inWordsLabel = worksheet.getCell(`A${currentRow}`);
    inWordsLabel.value = "IN WORDS:-";
    inWordsLabel.font = { bold: true, size: 10 };
    inWordsLabel.alignment = { vertical: 'top' };
    inWordsLabel.border = { left: { style: 'thin' }, top: { style: 'thin' } };

    // Summary Labels and Values
    const addSummaryRow = (label: string, formula: string, isFinal: boolean = false, forceDecimals: boolean = false) => {
      const labelCell = worksheet.getCell(`E${currentRow}`);
      labelCell.value = label;
      labelCell.font = { bold: true, size: 10, color: label.includes('@') ? { argb: 'FF2563EB' } : undefined };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      labelCell.border = borderStyle;

      const valueCell = worksheet.getCell(`F${currentRow}`);
      valueCell.value = { formula, date1904: false };
      valueCell.font = { bold: true, size: 10 };
      valueCell.alignment = { horizontal: 'right', vertical: 'middle' };
      valueCell.border = borderStyle;
      valueCell.numFmt = forceDecimals ? '#,##0.00' : '#,##0';

      // Ensure the "IN WORDS" area has borders on the left
      if (currentRow > endDataRow + 1) {
        worksheet.getCell(`A${currentRow}`).border = { left: { style: 'thin' } };
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
      }

      worksheet.getRow(currentRow).height = 20;
      currentRow++;
    };

    const range = `F${startDataRow}:F${endDataRow}`;
    addSummaryRow("Gross Amount", `SUM(${range})`, false, false);
    addSummaryRow("CGST @ 9%", `ROUND(F${currentRow - 1}*0.09, 2)`, false, true);
    addSummaryRow("SGST @ 9%", `ROUND(F${currentRow - 2}*0.09, 2)`, false, true);
    addSummaryRow("IGST @ 18%", `0`, false, true);
    addSummaryRow("Net Amount", `ROUND(F${currentRow - 4}+F${currentRow - 3}+F${currentRow - 2}+F${currentRow - 1}, 2)`, true, true);

    // Bottom border for the "IN WORDS" and Totals area
    const lastSummaryRow = currentRow - 1;
    // Apply bottom border only to the relevant cells A-F of the last summary row
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
      const cell = worksheet.getCell(`${col}${lastSummaryRow}`);
      cell.border = { ...cell.border, bottom: { style: 'thin' } };
    });
    // Ensure the IN WORDS box (A-D) has left and right borders correctly
    for (let r = endDataRow + 1; r <= lastSummaryRow; r++) {
      worksheet.getCell(`A${r}`).border = { ...worksheet.getCell(`A${r}`).border, left: { style: 'thin' } };
      worksheet.getCell(`D${r}`).border = { ...worksheet.getCell(`D${r}`).border, right: { style: 'thin' } };
    }

    // ───────────────────────────────────────────
    // Notes Section
    // ───────────────────────────────────────────
    const notesTitleRow = worksheet.getRow(currentRow);
    notesTitleRow.values = ["Notes :"];
    notesTitleRow.font = { bold: true, size: 10 };

    // Apply clean invoice-style borders
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col, index) => {
      const cell = worksheet.getCell(`${col}${currentRow}`);

      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },

        // Only first cell gets left border
        ...(index === 0 && {
          left: { style: 'thin' }
        }),

        // Only last cell gets right border
        ...(index === 5 && {
          right: { style: 'thin' }
        }),
      };
    });



    currentRow++;

    const setNote = (num: number, text: string, colCRange: string = "C") => {
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const numCell = worksheet.getCell(`A${currentRow}`);
      numCell.value = num;
      numCell.font = { bold: true, size: 9 };
      numCell.alignment = { horizontal: 'center', vertical: 'middle' };
      numCell.border = borderStyle;

      worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
      const textCell = worksheet.getCell(`C${currentRow}`);
      textCell.value = text;
      textCell.font = { bold: true, size: 9 };
      textCell.alignment = { vertical: 'middle', indent: 1 };
      textCell.border = borderStyle;
      worksheet.getRow(currentRow).height = 18;
      currentRow++;
    };

    setNote(1, "The above rates inclusive of GST @ 18 %");
    setNote(2, `GST No : ${businessGst}`);
    setNote(3, `Cheque to be made in favour of M/S ${businessName.toUpperCase()}`);

    let currentNoteIndex = 4;

    // Bank details
    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    const bankNumCell = worksheet.getCell(`A${currentRow}`);
    bankNumCell.value = currentNoteIndex;
    bankNumCell.font = { bold: true, size: 9 };
    bankNumCell.alignment = { horizontal: 'center', vertical: 'middle' };
    bankNumCell.border = borderStyle;

    worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
    const bankLabelCell = worksheet.getCell(`C${currentRow}`);
    bankLabelCell.value = "Bank Detail : Bharat Co operative Bank - Goregaon West Branch";
    bankLabelCell.font = { bold: true, size: 9 };
    bankLabelCell.alignment = { vertical: 'middle', indent: 1 };
    bankLabelCell.border = borderStyle;
    worksheet.getRow(currentRow).height = 18;
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
    worksheet.getCell(`A${currentRow}`).border = borderStyle;
    worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
    const bankDetailsCell = worksheet.getCell(`C${currentRow}`);
    bankDetailsCell.value = "A/C No: 003612100017821    IFSC Code : BCBM0000037";
    bankDetailsCell.font = { bold: true, size: 9 };
    bankDetailsCell.alignment = { horizontal: 'center', vertical: 'middle' };
    bankDetailsCell.border = borderStyle;
    worksheet.getRow(currentRow).height = 18;

    // ───────────────────────────────────────────
    // Final Polish
    // ───────────────────────────────────────────

    // ───────────────────────────────────────────
    // Export
    // ───────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = billingPartyName
      ? `Invoice_${billingPartyName.replace(/\s+/g, '_')}.xlsx`
      : `Tax_Invoice_${new Date().toISOString().split('T')[0]}.xlsx`;

    const sessionUser = session.user as any;
    await recordActivity({
      userId: sessionUser.id,
      userName: sessionUser.name || sessionUser.email || "Staff",
      role: sessionUser.role || "Staff",
      action: "INVOICE_DOWNLOAD",
      entity: "Invoice",
      entityId: invoiceId || billingPartyName || "All",
      newValue: JSON.stringify({ invoiceId, billNo, billingPartyName, partyNames, entriesCount: entries.length, netAmount }),
      req
    });

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[BILLING_REPORT_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
