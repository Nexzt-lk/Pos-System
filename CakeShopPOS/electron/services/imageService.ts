import { app, dialog, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'

export const setupImageProtocol = () => {
  // Register custom protocol: app-images:///products/abc.jpg -> AppData/CakeShopPOS/images/products/abc.jpg
  protocol.handle('app-images', (request) => {
    const url = request.url.replace('app-images:///', '')
    const decodedUrl = decodeURIComponent(url)
    const baseDir = path.join(app.getPath('userData'), 'images')
    const fullPath = path.join(baseDir, decodedUrl)

    if (fs.existsSync(fullPath)) {
      return net.fetch(`file://${fullPath}`)
    } else {
      console.warn(`[ImageService] Requested image not found at: ${fullPath}`)
      return new Response('Not Found', { status: 404 })
    }
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
  }
}
