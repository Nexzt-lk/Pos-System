import dayjs from 'dayjs'

/**
 * Formats a numeric value into Sri Lankan Rupees (LKR / Rs.)
 * Example: 3800 -> "Rs. 3,800.00"
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rs. 0.00'
  }
  return `Rs. ${amount.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/**
 * Formats a date string into readable POS receipt date/time
 * Example: "2026-08-17T17:45:00" -> "17 Aug 2026, 05:45 PM"
 */
export const formatDateTime = (dateStr?: string | Date): string => {
  if (!dateStr) return ''
  return dayjs(dateStr).format('DD MMM YYYY, hh:mm A')
}

/**
 * Formats a date string for daily report headings
 * Example: "2026-08-17" -> "Monday, 17 August 2026"
 */
export const formatDateLong = (dateStr?: string | Date): string => {
  if (!dateStr) return ''
  return dayjs(dateStr).format('dddd, DD MMMM YYYY')
}

/**
 * Generates a collision-proof Multi-Terminal Order Number
 * Format: {BRANCH_CODE}-{TERMINAL_ID}-{YYYYMMDD}-{SEQ:0000}
 * Example: "B1-T1-20260817-0001"
 */
export const generateOrderNumber = (
  branchCode: string,
  terminalId: string,
  seq: number,
  customDate?: Date
): string => {
  const datePart = dayjs(customDate || new Date()).format('YYYYMMDD')
  const seqPart = seq.toString().padStart(4, '0')
  return `${branchCode}-${terminalId}-${datePart}-${seqPart}`
}
