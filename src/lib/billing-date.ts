/**
 * Utility functions for calculating GST bill / invoice dates according to courier billing rules:
 * Rule 1: If generated within the billing month itself (billingMonth == currentMonth && billingYear == currentYear)
 *         -> use current real date.
 * Rule 2: If generated after the billing month has ended
 *         -> use the last calendar day of the billing month.
 */

export function calculateGstBillDate(
  billingMonth: number,
  billingYear: number,
  referenceDate: Date = new Date()
): Date {
  const currentMonth = referenceDate.getMonth() + 1;
  const currentYear = referenceDate.getFullYear();

  if (billingMonth === currentMonth && billingYear === currentYear) {
    return referenceDate;
  }

  // Determine the last day of the billing month
  // In JavaScript Date constructor, passing day 0 of month M (1-indexed) returns the last day of month M.
  const lastDay = new Date(billingYear, billingMonth, 0).getDate();
  // Using 12:00:00 (midday) local time prevents timezone shifts across UTC boundaries
  return new Date(billingYear, billingMonth - 1, lastDay, 12, 0, 0);
}

export function calculateGstBillDateString(
  billingMonth: number,
  billingYear: number,
  referenceDate: Date = new Date()
): string {
  const currentMonth = referenceDate.getMonth() + 1;
  const currentYear = referenceDate.getFullYear();

  if (billingMonth === currentMonth && billingYear === currentYear) {
    const y = referenceDate.getFullYear();
    const m = String(referenceDate.getMonth() + 1).padStart(2, "0");
    const d = String(referenceDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const lastDay = new Date(billingYear, billingMonth, 0).getDate();
  const y = billingYear;
  const m = String(billingMonth).padStart(2, "0");
  const d = String(lastDay).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolveBillingMonthYear(params: {
  billingMonth?: number | string | null;
  billingYear?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
}): { billingMonth: number; billingYear: number } {
  if (params.billingMonth && params.billingYear) {
    const m = parseInt(params.billingMonth.toString(), 10);
    const y = parseInt(params.billingYear.toString(), 10);
    if (!isNaN(m) && !isNaN(y) && m >= 1 && m <= 12) {
      return { billingMonth: m, billingYear: y };
    }
  }

  // Fallback to extracting from startDate or endDate (e.g. YYYY-MM-DD)
  const targetDateStr = params.startDate || params.endDate;
  if (targetDateStr) {
    const parts = targetDateStr.split("-");
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        return { billingMonth: m, billingYear: y };
      }
    }
  }

  const now = new Date();
  return {
    billingMonth: now.getMonth() + 1,
    billingYear: now.getFullYear(),
  };
}
