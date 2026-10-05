/**
 * Image processing utilities for client-side compression and conversion.
 * Resizes images to max dimensions (default 600px) and converts to optimized Data URI (JPEG ~85%).
 * Keeps images lightweight (~30-50KB), ensuring instant loading in POS grids and lightweight database storage.
 */

export const compressImageFile = (
  file: File,
  maxDimension = 600,
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = (event) => {
      const result = event.target?.result as string
      if (!result) {
        reject(new Error('Empty image result.'))
        return
      }

      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image element.'))
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Downscale while preserving aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(result)
          return
        }

        // Draw smooth image
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(dataUrl)
        } catch {
          resolve(result)
        }
      }

      img.src = result
    }

    reader.readAsDataURL(file)
  })
}

/** Check if file is a supported image */
export const isValidImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  return validTypes.includes(file.type.toLowerCase())
}
