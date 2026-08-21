/**
 * Resolves product image paths for Electron, Web Dev Server, and Production bundle.
 */
export const getProductImageSrc = (path?: string): string | null => {
  if (!path) return null
  
  // Remote URLs or Data URIs
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }

  // Clean leading slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path

  // Running inside Electron desktop environment
  if (window.electronAPI) {
    return `app-images:///${cleanPath}`
  }

  // Running inside browser / Vite dev server
  if (cleanPath.startsWith('images/')) {
    return `/${cleanPath}`
  }
  return `/images/${cleanPath}`
}
