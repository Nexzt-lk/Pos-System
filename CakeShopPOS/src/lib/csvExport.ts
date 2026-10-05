import dayjs from 'dayjs'

export type CsvCell = string | number | boolean | null | undefined
export type CsvRow = CsvCell[]

/** Format a number cleanly to 2 decimal places as a string (e.g. 1250.00) */
export const money = (value: unknown): string => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.00'
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2)
}

/** Format quantity (integer or up to 2 decimal places if fractional) */
export const qty = (value: unknown): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Format percentage string with 1 decimal (e.g. "45.0%") */
export const pct = (value: unknown): string => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.0%'
  return `${(Math.round((n + Number.EPSILON) * 10) / 10).toFixed(1)}%`
}

/** Safely coerce any value to a finite number (0 when missing / invalid). */
export const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Format ISO date-time into clean readable date e.g. "2026-10-05" */
export const csvDate = (value?: string | null): string => {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD') : String(value).slice(0, 10)
}

/** Format ISO date-time into 12-hour or 24-hour time e.g. "11:30 AM" */
export const csvTime = (value?: string | null): string => {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('hh:mm A') : ''
}

/** Format ISO date-time into standard combined format e.g. "2026-10-05 11:30:00" */
export const csvDateTime = (value?: string | null): string => {
  if (!value) return ''
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(value)
}

const escapeCell = (value: CsvCell): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : ''
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'

  let s = String(value)
  // Neutralise formula injection for text cells (keep plain numeric strings untouched)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) {
    s = `'${s}`
  }
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export const buildCsv = (rows: CsvRow[]): string =>
  rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')

const safeFilename = (name: string): string => {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_')
  return cleaned.toLowerCase().endsWith('.csv') ? cleaned : `${cleaned}.csv`
}

/**
 * Downloads a proper, spreadsheet-ready CSV file.
 * Automatically adds UTF-8 BOM (\uFEFF) so Excel and third-party tools
 * open Unicode and Sinhala characters cleanly without encoding glitches.
 */
export const downloadCsv = (filename: string, rows: CsvRow[]): void => {
  const csv = '\uFEFF' + buildCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeFilename(filename)
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
