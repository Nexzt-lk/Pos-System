import { useEffect, useRef } from 'react'

/**
 * Listens for hardware USB / Bluetooth Barcode Scanners (rapid keyboard keystrokes ending with Enter)
 */
export const useBarcodeScanner = (onScan: (barcode: string) => void) => {
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes inside standard text input fields
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTimeRef.current

      // Scanners type characters rapidly (< 50ms per key)
      if (timeDiff > 80) {
        bufferRef.current = ''
      }

      lastKeyTimeRef.current = currentTime

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          onScan(bufferRef.current)
          bufferRef.current = ''
          e.preventDefault()
        }
      } else if (e.key.length === 1) {
        bufferRef.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan])
}
