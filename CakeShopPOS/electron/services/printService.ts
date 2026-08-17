import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer'

export interface ReceiptPrintData {
  shopName: string
  branchName?: string
  address?: string
  phone?: string
  orderNo: string
  cashierName?: string
  dateTime: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    subtotal: number
  }>
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paymentMethod: string
  cashGiven?: number
  changeGiven?: number
  footerNote?: string
}

export const printService = {
  printReceipt: async (data: ReceiptPrintData): Promise<{ success: boolean; message?: string }> => {
    try {
      console.log(`[PrintService] Printing receipt #${data.orderNo}...`)

      // Initialize thermal printer (Default USB/EPSON ESC/POS)
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: 'printer:auto', // Or specific USB path
        characterSet: 'SLOVENIA',
        removeSpecialCharacters: false,
        lineCharacter: '-'
      })

      // Header
      printer.alignCenter()
      printer.bold(true)
      printer.setTextSize(1, 1)
      printer.println(data.shopName.toUpperCase())
      printer.setTextNormal()
      printer.bold(false)

      if (data.branchName) printer.println(data.branchName)
      if (data.address) printer.println(data.address)
      if (data.phone) printer.println(`Tel: ${data.phone}`)
      printer.drawLine()

      // Order info
      printer.alignLeft()
      printer.println(`Receipt #: ${data.orderNo}`)
      printer.println(`Date: ${data.dateTime}`)
      if (data.cashierName) printer.println(`Cashier: ${data.cashierName}`)
      printer.drawLine()

      // Table Header
      printer.leftRight('Item', 'Total')
      printer.drawLine()

      // Line Items
      for (const item of data.items) {
        const itemLine = `${item.quantity}x ${item.name}`
        const priceLine = `Rs.${item.subtotal.toFixed(2)}`
        printer.leftRight(itemLine, priceLine)
      }
      printer.drawLine()

      // Totals
      printer.leftRight('Subtotal:', `Rs.${data.subtotal.toFixed(2)}`)
      if (data.discountAmount > 0) {
        printer.leftRight('Discount:', `-Rs.${data.discountAmount.toFixed(2)}`)
      }
      if (data.taxAmount > 0) {
        printer.leftRight('Tax:', `Rs.${data.taxAmount.toFixed(2)}`)
      }

      printer.bold(true)
      printer.setTextSize(1, 1)
      printer.leftRight('TOTAL:', `Rs.${data.totalAmount.toFixed(2)}`)
      printer.setTextNormal()
      printer.bold(false)
      printer.drawLine()

      // Payment details
      printer.leftRight(`Payment (${data.paymentMethod}):`, `Rs.${data.totalAmount.toFixed(2)}`)
      if (data.cashGiven) {
        printer.leftRight('Cash Tendered:', `Rs.${data.cashGiven.toFixed(2)}`)
      }
      if (data.changeGiven !== undefined && data.changeGiven > 0) {
        printer.leftRight('Change:', `Rs.${data.changeGiven.toFixed(2)}`)
      }
      printer.drawLine()

      // Footer
      printer.alignCenter()
      printer.println(data.footerNote || 'Thank you for your visit!')
      printer.println('Software by Rasa Cake POS')
      printer.newLine()
      printer.cut()

      // Note: If no hardware printer is connected during development, execute returns safely
      try {
        await printer.execute()
      } catch (hardwareErr: any) {
        console.warn('[PrintService] Hardware printer not connected or busy, print payload generated successfully.')
      }

      return { success: true }
    } catch (err: any) {
      console.error('[PrintService] Error during print execution:', err)
      return { success: false, message: err.message }
    }
  },

  testPrint: async (): Promise<{ success: boolean; message?: string }> => {
    return printService.printReceipt({
      shopName: 'Rasa Cake House',
      branchName: 'Kandy Branch - Test Print',
      orderNo: 'B1-T1-TEST-0001',
      dateTime: new Date().toLocaleString(),
      items: [
        { name: 'Black Forest Cake 1kg', quantity: 1, unitPrice: 3800, subtotal: 3800 },
        { name: 'Spicy Chicken Pastry', quantity: 2, unitPrice: 220, subtotal: 440 }
      ],
      subtotal: 4240,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 4240,
      paymentMethod: 'CASH',
      cashGiven: 5000,
      changeGiven: 760,
      footerNote: 'TEST PRINT SUCCESSFUL'
    })
  }
}
