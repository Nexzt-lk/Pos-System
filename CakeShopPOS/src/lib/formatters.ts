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

/**
 * Formats stock quantities cleanly without float precision bugs
 * Example: 196.80900000000003, 'kg' -> "196.81 kg"
 * Example: 12, 'pcs' -> "12 pcs"
 */
export const formatStockQty = (qty: number | undefined | null, unit: string = 'pcs'): string => {
  if (qty === undefined || qty === null || isNaN(qty)) return `0 ${unit}`
  const num = Number(qty)
  if (unit === 'pcs' || Number.isInteger(num)) {
    return `${Math.round(num)} ${unit}`
  }
  // For kg or float quantities, round to 2 decimals
  const rounded = parseFloat(num.toFixed(2))
  return `${rounded} ${unit}`
}

/**
 * Formats order/cart item quantity nicely, showing grams or kg intuitively
 * Examples:
 * 0.25, 'kg' -> "250g"
 * 0.5, 'kg' -> "500g"
 * 1.5, 'kg' -> "1.5 kg"
 * 250, 'g' -> "250g"
 * 2, 'pcs' -> "2 pcs"
 */
export const formatQuantityWithUnit = (qty: number, unit?: string): string => {
  const u = unit?.toLowerCase() || 'pcs'
  if (u === 'kg') {
    if (qty < 1) {
      return `${Math.round(qty * 1000)}g`
    }
    return `${parseFloat(qty.toFixed(3))} kg`
  }
  if (u === 'g') {
    return `${Math.round(qty)}g`
  }
  return `${qty} ${unit || 'pcs'}`
}
