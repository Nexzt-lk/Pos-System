import { app, dialog, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import { pathToFileURL } from 'url'

export const setupImageProtocol = () => {
  // Register custom protocol: app-images:///products/abc.jpg -> AppData/CakeShopPOS/images/products/abc.jpg
  protocol.handle('app-images', (request) => {
    const url = request.url.replace(/^app-images:\/\/\/?/, '')
    const decodedUrl = decodeURIComponent(url)
    
    // Check multiple candidate locations
    const candidatePaths = [
      path.join(app.getPath('userData'), 'images', decodedUrl),
      path.join(app.getPath('userData'), decodedUrl),
      path.join(process.resourcesPath || '', 'images', decodedUrl),
      path.join(process.resourcesPath || '', decodedUrl),
      path.join(path.dirname(process.execPath || ''), 'resources', 'images', decodedUrl),
      path.join(path.dirname(process.execPath || ''), 'resources', decodedUrl),
      path.join(process.cwd(), 'public', 'images', decodedUrl),
      path.join(process.cwd(), 'public', decodedUrl),
      path.join(__dirname, '../../public/images', decodedUrl),
      path.join(__dirname, '../../public', decodedUrl),
      path.join(app?.getAppPath ? app.getAppPath() : '', 'public', 'images', decodedUrl),
      path.join(app?.getAppPath ? app.getAppPath() : '', 'public', decodedUrl)
    ]

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return net.fetch(pathToFileURL(p).href)
      }
    }

    console.warn(`[ImageService] Requested image not found for url: ${decodedUrl}`)
    return new Response('Not Found', { status: 404 })
  })
}

export const imageService = {
  selectImageDialog: async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  },

  saveProductImage: (sourcePath: string): { success: boolean; relativePath?: string; error?: string } => {
    try {
      const imagesDir = path.join(app.getPath('userData'), 'images', 'products')
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true })
      }

      const ext = path.extname(sourcePath).toLowerCase() || '.jpg'
      const filename = `cake_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`
      const destination = path.join(imagesDir, filename)

      fs.copyFileSync(sourcePath, destination)
      const relativePath = `products/${filename}`

      console.log(`[ImageService] Saved product image to ${destination}`)
      return { success: true, relativePath }
    } catch (err: any) {
      console.error('[ImageService] Failed to save image:', err)
      return { success: false, error: err.message }
    }
  },

  saveBase64Image: (base64Data: string, prefix: string = 'product'): { success: boolean; relativePath?: string; error?: string } => {
    try {
      const imagesDir = path.join(app.getPath('userData'), 'images', 'products')
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true })
      }

      let ext = '.jpg'
      let rawBase64 = base64Data

      const match = base64Data.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/)
      if (match) {
        const format = match[1].toLowerCase()
        ext = format === 'jpeg' ? '.jpg' : format === 'svg+xml' ? '.svg' : `.${format}`
        rawBase64 = match[2]
      }

      const cleanPrefix = (prefix || 'product').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) || 'product'
      const filename = `${cleanPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`
      const destination = path.join(imagesDir, filename)
      const buffer = Buffer.from(rawBase64, 'base64')
      fs.writeFileSync(destination, buffer)

      const relativePath = `products/${filename}`
      console.log(`[ImageService] Saved base64 product image to ${destination} (${buffer.length} bytes)`)
      return { success: true, relativePath }
    } catch (err: any) {
      console.error('[ImageService] Failed to save base64 image:', err)
      return { success: false, error: err.message }
    }
  }
}
