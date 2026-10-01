import { BrowserWindow } from 'electron'

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
    quantity: number | string
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

export interface ExpenseVoucherPrintData {
  shopName?: string
  branchName?: string
  address?: string
  phone?: string
  voucherNo: string
  dateTime: string
  category: string
  description: string
  amount: number
  addedBy?: string
  footerNote?: string
}

export const printService = {
  getPrinters: async (win?: BrowserWindow): Promise<any[]> => {
    try {
      if (win && !win.isDestroyed()) {
        return await win.webContents.getPrintersAsync()
      }
      const tempWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
      const printers = await tempWin.webContents.getPrintersAsync()
      tempWin.close()
      return printers
    } catch (e) {
      console.error('[PrintService] Failed to retrieve system printers:', e)
      return []
    }
  },

  printReceipt: async (data: ReceiptPrintData, preferredPrinter?: string): Promise<{ success: boolean; message?: string; printerUsed?: string }> => {
    try {
      console.log(`[PrintService] Initiating thermal print for order #${data.orderNo}...`)

      // Format line items: Name on line 1, Qty x Price and Total on line 2
      const itemsHtml = (data.items || []).map((item) => {
        const qty = item.quantity
        const unitPrice = Number(item.unitPrice) || 0
        const subtotal = Number(item.subtotal) || 0
        return `
          <div class="item-block">
            <div class="item-title bold">${item.name}</div>
            <div class="item-sub-row">
              <span class="item-calc">${qty} &times; Rs. ${unitPrice.toFixed(2)}</span>
              <span class="item-subtotal bold">Rs. ${subtotal.toFixed(2)}</span>
            </div>
          </div>
        `
      }).join('')

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt ${data.orderNo}</title>
          <style>
            @page {
              margin: 0;
              size: 80mm auto;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 4px 6px 14px 6px;
              font-family: 'Courier New', Courier, 'Noto Sans Sinhala', monospace, sans-serif;
              font-size: 13px;
              line-height: 1.35;
              color: #000;
              background: #fff;
              width: 76mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .title {
              font-size: 18px;
              font-weight: 900;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            .subtitle {
              font-size: 12px;
              color: #222;
              margin-bottom: 2px;
            }
            .divider {
              border-bottom: 1px dashed #000;
              margin: 6px 0;
            }
            .double-divider {
              border-bottom: 2px solid #000;
              margin: 6px 0;
            }
            .row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 3px;
            }
            .item-block {
              margin-bottom: 6px;
              padding-bottom: 2px;
            }
            .item-title {
              font-size: 13px;
              word-break: break-word;
              line-height: 1.3;
            }
            .item-sub-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              color: #111;
              padding-left: 6px;
              margin-top: 1px;
            }
            .item-calc {
              color: #222;
            }
            .item-subtotal {
              font-size: 13px;
              text-align: right;
            }
            .total-banner {
              display: flex;
              justify-content: space-between;
              font-size: 17px;
              font-weight: 900;
              padding: 3px 0;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              margin-top: 10px;
              line-height: 1.4;
            }
            .footer-note {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 4px;
            }
            .branding {
              margin-top: 10px;
              padding-top: 6px;
              border-top: 1px solid #000;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${(data.shopName || 'Wasana Cake - Katugastota').toUpperCase()}</div>
            ${data.branchName ? `<div class="subtitle">${data.branchName}</div>` : ''}
            ${data.address ? `<div class="subtitle">${data.address}</div>` : '<div class="subtitle">Horana Wasana Bakers Galagedara Road Katugastota</div>'}
            ${data.phone ? `<div class="subtitle">Tel: ${data.phone}</div>` : '<div class="subtitle">Tel: 071-1172201</div>'}
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Receipt #:</span>
            <span class="bold">${data.orderNo}</span>
          </div>
          <div class="row">
            <span>Date:</span>
            <span>${data.dateTime}</span>
          </div>
          ${data.cashierName ? `<div class="row"><span>Cashier:</span><span class="bold">${data.cashierName}</span></div>` : ''}

          <div class="divider"></div>
          <div class="row bold" style="font-size: 11px; text-transform: uppercase;">
            <span>PRODUCT / QTY &times; PRICE</span>
            <span>TOTAL (LKR)</span>
          </div>
          <div class="divider"></div>

          ${itemsHtml}

          <div class="divider"></div>

          <div class="row">
            <span>Subtotal:</span>
            <span>Rs. ${Number(data.subtotal).toFixed(2)}</span>
          </div>

          ${Number(data.discountAmount) > 0 ? `
            <div class="row">
              <span>Discount:</span>
              <span>-Rs. ${Number(data.discountAmount).toFixed(2)}</span>
            </div>
          ` : ''}

          ${Number(data.taxAmount) > 0 ? `
            <div class="row">
              <span>Tax:</span>
              <span>Rs. ${Number(data.taxAmount).toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="double-divider"></div>

          <div class="total-banner">
            <span>NET TOTAL:</span>
            <span>Rs. ${Number(data.totalAmount).toFixed(2)}</span>
          </div>

          <div class="double-divider"></div>

          <div class="row">
            <span>Payment (${data.paymentMethod || 'CASH'}):</span>
            <span class="bold">Rs. ${Number(data.totalAmount).toFixed(2)}</span>
          </div>

          ${Number(data.cashGiven) > 0 ? `
            <div class="row">
              <span>Cash Tendered:</span>
              <span>Rs. ${Number(data.cashGiven).toFixed(2)}</span>
            </div>
          ` : ''}

          ${Number(data.changeGiven) > 0 ? `
            <div class="row bold">
              <span>Change Returned:</span>
              <span>Rs. ${Number(data.changeGiven).toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="divider"></div>

          <div class="footer">
            <div class="footer-note">${data.footerNote || 'Thank you for visiting Wasana Cake! 🎂'}</div>
            <div>Please retain this receipt for warranty / queries.</div>
            <div class="branding">Software By Nexzt.lk</div>
          </div>
        </body>
        </html>
      `

      // 2. Create Hidden Offscreen Window
      const printWin = new BrowserWindow({
        width: 320,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      // 3. Detect System Printer
      const systemPrinters = await printWin.webContents.getPrintersAsync()
      let deviceName = preferredPrinter

      if (!deviceName) {
        // Look for thermal printer match: xp, pos, receipt, thermal
        const thermalMatch = systemPrinters.find(p => /xp|pos|thermal|receipt|bixolon|epson/i.test(p.name))
        if (thermalMatch) {
          deviceName = thermalMatch.name
        } else {
          const defaultPrinter = systemPrinters.find(p => p.isDefault)
          if (defaultPrinter) {
            deviceName = defaultPrinter.name
          }
        }
      }

      console.log(`[PrintService] Selected target printer: "${deviceName || 'System Default'}" (Total printers found: ${systemPrinters.length})`)

      return new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: deviceName || undefined,
            margins: { marginType: 'none' }
          },
          (success, failureReason) => {
            try {
              if (!printWin.isDestroyed()) printWin.close()
            } catch (_) {}

            if (success) {
              console.log(`[PrintService] ✅ Successfully printed receipt to: ${deviceName || 'Default'}`)
              resolve({ success: true, printerUsed: deviceName || 'Default' })
            } else {
              console.warn(`[PrintService] ⚠️ Print completed with notice:`, failureReason)
              resolve({ success: false, message: failureReason || 'Printer error', printerUsed: deviceName })
            }
          }
        )
      })
    } catch (err: any) {
      console.error('[PrintService] Error executing print:', err)
      return { success: false, message: err.message }
    }
  },

  testPrint: async (targetPrinter?: string): Promise<{ success: boolean; message?: string; printerUsed?: string }> => {
    return printService.printReceipt({
      shopName: 'Wasana Cake - Katugastota',
      branchName: 'Katugastota, Kandy — Test Print',
      orderNo: 'B1-TEST-' + Math.floor(1000 + Math.random() * 9000),
      dateTime: new Date().toLocaleString(),
      items: [
        { name: 'Chocolate Fudge Cake 1kg', quantity: 1, unitPrice: 3800, subtotal: 3800 },
        { name: 'Spicy Chicken Pastry', quantity: 2, unitPrice: 200, subtotal: 400 },
        { name: 'Vanilla Eclair', quantity: 3, unitPrice: 260, subtotal: 780 }
      ],
      subtotal: 4980,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 4980,
      paymentMethod: 'CASH',
      cashGiven: 5000,
      changeGiven: 20,
      footerNote: 'TEST PRINT SUCCESSFUL — PRINTER CONNECTED! ✅'
    }, targetPrinter)
  },

  printExpenseVoucher: async (
    data: ExpenseVoucherPrintData,
    preferredPrinter?: string
  ): Promise<{ success: boolean; message?: string; printerUsed?: string }> => {
    try {
      console.log(`[PrintService] Printing petty cash voucher #${data.voucherNo}...`)

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Expense Voucher ${data.voucherNo}</title>
          <style>
            @page {
              margin: 0;
              size: 80mm auto;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              padding: 6px 8px 16px 8px;
              font-family: 'Courier New', Courier, 'Noto Sans Sinhala', monospace, sans-serif;
              font-size: 13px;
              line-height: 1.35;
              color: #000;
              background: #fff;
              width: 76mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .title {
              font-size: 16px;
              font-weight: 900;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .badge-voucher {
              display: inline-block;
              border: 1.5px solid #000;
              padding: 2px 8px;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 1px;
              margin: 5px 0;
            }
            .divider {
              border-bottom: 1px dashed #000;
              margin: 6px 0;
            }
            .double-divider {
              border-bottom: 2px solid #000;
              margin: 6px 0;
            }
            .row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 4px;
            }
            .amount-box {
              border: 1.5px solid #000;
              padding: 6px 8px;
              margin: 8px 0;
              text-align: center;
            }
            .amount-title {
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .amount-val {
              font-size: 18px;
              font-weight: 900;
              margin-top: 2px;
            }
            .sign-area {
              margin-top: 20px;
              padding-top: 4px;
            }
            .sign-line {
              border-bottom: 1px solid #000;
              height: 22px;
              margin-bottom: 3px;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              margin-top: 12px;
              color: #333;
            }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${data.shopName || 'Wasana Cake - Katugastota'}</div>
            ${data.branchName ? `<div style="font-size: 11px;">${data.branchName}</div>` : ''}
            ${data.address ? `<div style="font-size: 10px; color: #222;">${data.address}</div>` : ''}
            ${data.phone ? `<div style="font-size: 10px; color: #222;">Tel: ${data.phone}</div>` : ''}
            <div><span class="badge-voucher">PETTY CASH VOUCHER</span></div>
          </div>

          <div class="divider"></div>

          <div class="row">
            <span>Voucher No:</span>
            <span class="bold">#${data.voucherNo}</span>
          </div>
          <div class="row">
            <span>Date & Time:</span>
            <span>${data.dateTime}</span>
          </div>
          <div class="row">
            <span>Category:</span>
            <span class="bold">${data.category}</span>
          </div>
          <div class="row">
            <span>Paid By / Staff:</span>
            <span>${data.addedBy || 'Counter Cashier'}</span>
          </div>

          <div class="divider"></div>

          <div style="font-size: 11px; font-weight: bold; margin-bottom: 2px;">EXPENSE PURPOSE / DESCRIPTION:</div>
          <div style="font-size: 13px; font-weight: 600; padding: 4px 0; word-break: break-word;">
            ${data.description}
          </div>

          <div class="amount-box">
            <div class="amount-title">PAID AMOUNT (LKR)</div>
            <div class="amount-val">Rs. ${Number(data.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size: 10px; color: #333; margin-top: 2px;">Paid From: Counter Cash Drawer</div>
          </div>

          <div class="sign-area">
            <div class="row" style="align-items: flex-end;">
              <div style="width: 46%;">
                <div class="sign-line"></div>
                <div style="font-size: 10px; text-align: center;">Cashier Signature</div>
              </div>
              <div style="width: 46%;">
                <div class="sign-line"></div>
                <div style="font-size: 10px; text-align: center;">Recipient / Approved</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <div>${data.footerNote || 'Wasana Cake Katugastota · POS Cash Drawer Outflow'}</div>
            <div style="font-size: 9px; color: #666; margin-top: 3px;">Printed: ${new Date().toLocaleTimeString()}</div>
          </div>
        </body>
        </html>
      `

      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      const printers = await printWin.webContents.getPrintersAsync()
      let deviceName = ''

      if (preferredPrinter && preferredPrinter !== 'default') {
        const found = printers.find(
          (p) => p.name.toLowerCase() === preferredPrinter.toLowerCase() || p.displayName?.toLowerCase() === preferredPrinter.toLowerCase()
        )
        if (found) deviceName = found.name
      }

      if (!deviceName) {
        const defaultPrinter = printers.find((p) => p.isDefault)
        if (defaultPrinter) deviceName = defaultPrinter.name
      }

      return new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: deviceName || undefined,
            margins: { marginType: 'none' }
          },
          (success, failureReason) => {
            try {
              printWin.close()
            } catch (_) {}

            if (success) {
              resolve({ success: true, printerUsed: deviceName || 'Default' })
            } else {
              resolve({ success: false, message: failureReason || 'Printer error', printerUsed: deviceName })
            }
          }
        )
      })
    } catch (err: any) {
      console.error('[PrintService] Error printing expense voucher:', err)
      return { success: false, message: err.message }
    }
  }
}
