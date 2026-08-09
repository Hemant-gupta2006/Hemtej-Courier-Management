import ExcelJS from "exceljs";
import { formatWeight } from "@/lib/utils";

export interface BillingExcelParams {
  entries: any[];
  billNo: string;
  invoiceDate: Date;
  businessSnapshot: {
    businessName: string;
    businessAddress: string;
    businessContact: string;
    businessGst: string;
  };
  partySnapshot: {
    officialInvoiceName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pincode: string;
    contactNumber: string;
    gstNumber: string;
  };
  billingPartyName: string;
}

export async function generateBillingExcel({
  entries,
  billNo,
  invoiceDate,
  businessSnapshot,
  partySnapshot,
  billingPartyName,
}: BillingExcelParams): Promise<Buffer> {
  const { businessName, businessAddress, businessContact, businessGst } = businessSnapshot;
  const { addressLine1, addressLine2, city, state, pincode, contactNumber: partyContact, gstNumber: partyGst } = partySnapshot;

  const businessAddressLines = businessAddress.split(',').map(s => s.trim());
  const line1 = businessAddressLines.slice(0, 2).join(', ');
  const line2 = businessAddressLines.slice(2, 5).join(', ');
  const line3 = businessAddressLines.slice(5).join(', ');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Account Billing", {
    pageSetup: { paperSize: 9, orientation: 'portrait' }
  });

  worksheet.columns = [
    { header: "S.L. NO.", key: "sl", width: 8 },
    { header: "DATE", key: "date", width: 14 },
    { header: "AWB NO.", key: "awb", width: 25 },
    { header: "DESTINATION", key: "dest", width: 25 },
    { header: "WEIGHT", key: "weight", width: 12 },
    { header: "AMOUNT", key: "amount", width: 12 },
  ];

  worksheet.mergeCells('A1:F1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'TAX INVOICE';
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  const setHeaderCell = (cell: string, label: string, value: string = "", isBoldValue: boolean = false) => {
    const c = worksheet.getCell(cell);
    c.value = label + value;
    c.font = { bold: isBoldValue, size: 10 };
    c.border = borderStyle;
  };

  worksheet.mergeCells('A2:C2');
  worksheet.mergeCells('D2:F2');
  setHeaderCell('A2', 'Bill No :- ', billNo);
  setHeaderCell('D2', 'DATE : ', invoiceDate.toLocaleDateString('en-GB'), true);

  worksheet.mergeCells('A3:C3');
  worksheet.mergeCells('D3:F3');
  setHeaderCell('A3', 'Bill From:');
  setHeaderCell('D3', 'Bill To :');

  worksheet.mergeCells('A4:C4');
  worksheet.mergeCells('D4:F4');
  setHeaderCell('A4', businessName, "", true);
  setHeaderCell('D4', billingPartyName || "", "", true);

  worksheet.mergeCells('A5:C5');
  worksheet.mergeCells('D5:F5');
  setHeaderCell('A5', line1 || "Shop no.04, Dave Chawl, Near Kamu");
  setHeaderCell('D5', addressLine1 || "");

  worksheet.mergeCells('A6:C6');
  worksheet.mergeCells('D6:F6');
  setHeaderCell('A6', line2 || "Baba, SV Road, Opp. Patker College");
  setHeaderCell('D6', addressLine2 || "");

  worksheet.mergeCells('A7:C7');
  worksheet.mergeCells('D7:F7');
  setHeaderCell('A7', line3 || "Goregaon West, Mumbai 400104");
  setHeaderCell('D7', `${city || ''}${(city && state) ? ', ' : ''}${state || ''} ${pincode || ''}`.trim());

  worksheet.mergeCells('A8:C8');
  worksheet.mergeCells('D8:F8');
  setHeaderCell('A8', 'Contact no. ' + businessContact);
  setHeaderCell('D8', partyContact ? 'Contact no. ' + partyContact : '');

  worksheet.mergeCells('A9:C9');
  worksheet.mergeCells('D9:F9');
  setHeaderCell('A9', 'GST NO : ' + businessGst, "", true);
  setHeaderCell('D9', partyGst ? 'GST NO : ' + partyGst : "", "", !!partyGst);

  const tableHeaderRow = worksheet.getRow(10);
  tableHeaderRow.values = ["S.L. NO.", "DATE", "AWB NO.", "DESTINATION", "WEIGHT", "AMOUNT"];
  tableHeaderRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10 };
    cell.border = borderStyle;
    cell.alignment = { horizontal: 'center' };
  });

  let currentRow = 11;
  const startDataRow = currentRow;

  entries.forEach((entry, index) => {
    const row = worksheet.getRow(currentRow);
    row.values = [
      index + 1,
      new Date(entry.date).toLocaleDateString('en-GB'),
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

  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  const inWordsLabel = worksheet.getCell(`A${currentRow}`);
  inWordsLabel.value = "IN WORDS:-";
  inWordsLabel.font = { bold: true, size: 10 };
  inWordsLabel.alignment = { vertical: 'top' };
  inWordsLabel.border = { left: { style: 'thin' }, top: { style: 'thin' } };

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

  const lastSummaryRow = currentRow - 1;
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
    const cell = worksheet.getCell(`${col}${lastSummaryRow}`);
    cell.border = { ...cell.border, bottom: { style: 'thin' } };
  });
  for (let r = endDataRow + 1; r <= lastSummaryRow; r++) {
    worksheet.getCell(`A${r}`).border = { ...worksheet.getCell(`A${r}`).border, left: { style: 'thin' } };
    worksheet.getCell(`D${r}`).border = { ...worksheet.getCell(`D${r}`).border, right: { style: 'thin' } };
  }

  const notesTitleRow = worksheet.getRow(currentRow);
  notesTitleRow.values = ["Notes :"];
  notesTitleRow.font = { bold: true, size: 10 };

  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col, index) => {
    const cell = worksheet.getCell(`${col}${currentRow}`);
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      ...(index === 0 && { left: { style: 'thin' } }),
      ...(index === 5 && { right: { style: 'thin' } }),
    };
  });

  currentRow++;

  const setNote = (num: number, text: string) => {
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

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
