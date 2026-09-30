import React, { useState, useEffect } from 'react'
import { ProductGrid } from './ProductGrid'
import { Cart } from './Cart'
import { PaymentModal } from './PaymentModal'
import { ReceiptModal } from './ReceiptModal'
import { DiscountModal } from './DiscountModal'
import { ProductQuantityModal } from './ProductQuantityModal'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { Product, Category, normalizeProduct, normalizeCategory } from '../../types/product'
import { productsApi } from '../../api/productsApi'
import { categoriesApi } from '../../api/categoriesApi'
import { useCartStore, CartItem as CartItemType } from '../../store/cartStore'
import { useAppStore } from '../../store/appStore'
import { message } from 'antd'

export const POSPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const addItem = useCartStore((state) => state.addItem)
  const clearCart = useCartStore((state) => state.clearCart)
  const cartItems = useCartStore((state) => state.items)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Quantity / Weight modal state
  const [isQtyModalOpen, setIsQtyModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedInitialQty, setSelectedInitialQty] = useState<number>(0)

  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isDiscountOpen, setIsDiscountOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<any | null>(null)

  // Fetch local products & categories on load or branch change
  const loadMenuData = async () => {
    if (!currentShop) return
    setIsLoading(true)
    try {
      const [rawProds, rawCats] = await Promise.all([
        productsApi.getAll(false).catch(() => []),
        categoriesApi.getAll().catch(() => [])
      ])

      const cats = rawCats.map((c) => normalizeCategory(c, currentShop.id))
      const catMap = new Map(cats.map((c) => [c.id, c]))

      const prods = rawProds.map((p) => {
        const norm = normalizeProduct(p, currentShop.id)
        if (norm.category_id && catMap.has(norm.category_id)) {
          const cat = catMap.get(norm.category_id)!
          norm.category_name = cat.name
          norm.category_color = cat.color
        }
        return norm
      })

      setProducts(prods)
      setCategories(cats)
    } catch (err) {
      console.error('Failed to load menu:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMenuData()
  }, [currentShop?.id])

  // Open quantity/weight selection dialog when user clicks or scans an item
  const handleProductSelect = (product: Product) => {
    if (product.track_inventory && (product.current_stock ?? 0) <= 0) {
      message.error(`"${product.name}" store එකේ තොග අවසන් (Out of stock)!`)
      return
    }
    const existingInCart = cartItems.find((i) => i.product_id === product.id)
    setSelectedProduct(product)
    setSelectedInitialQty(existingInCart ? existingInCart.quantity : 0)
    setIsQtyModalOpen(true)
  }

  // Open quantity/weight selection when user clicks a cart item to edit
  const handleEditCartItem = (item: CartItemType) => {
    const matchedProduct = products.find((p) => p.id === item.product_id) || {
      id: item.product_id,
      shop_id: item.shop_id,
      name: item.product_name,
      price: item.unit_price,
      cost_price: item.cost_price,
      unit: item.unit || 'pcs',
      track_inventory: item.track_inventory ?? false,
      is_active: true,
      current_stock: item.current_stock,
      image_path: item.image_path,
      barcode: item.barcode
    }
    setSelectedProduct(matchedProduct)
    setSelectedInitialQty(item.quantity)
    setIsQtyModalOpen(true)
  }

  // On quantity/weight/price confirmed from modal
  const handleConfirmQuantity = (product: Product, quantity: number, customSubtotal?: number) => {
    // Replace quantity in cart with the confirmed value and optional exact subtotal
    addItem(product, quantity, true, customSubtotal)
  }

  // Global POS Keyboard Shortcuts (F1: Help, F2: Search, F3: Discount, F4: Pay, F9: Clear Cart)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger global actions if sub-modals are open
      if (isQtyModalOpen || isPaymentOpen || isDiscountOpen || isReceiptOpen || isShortcutsOpen) {
        return
      }

      const activeTag = (document.activeElement?.tagName || '').toLowerCase()
      const isInputActive = activeTag === 'input' || activeTag === 'textarea'

      // F1 or Ctrl+H: Help & Shortcuts Guide
      if (e.key === 'F1' || (e.ctrlKey && (e.key === 'h' || e.key === 'H')) || (!isInputActive && e.key === '?')) {
        e.preventDefault()
        setIsShortcutsOpen(true)
      } 
      // F2 or Ctrl+K: Focus Product Search
      else if (e.key === 'F2' || (e.ctrlKey && (e.key === 'k' || e.key === 'K'))) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('pos:focus-search'))
      } 
      // F3 or Ctrl+D or Alt+D: Discount
      else if (e.key === 'F3' || (e.ctrlKey && (e.key === 'd' || e.key === 'D')) || (e.altKey && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault()
        if (cartItems.length > 0) {
          setIsDiscountOpen(true)
        } else {
          message.warning('Please add items to cart before applying discount.')
        }
      } 
      // F4 or Alt+P or Alt+C or Ctrl+Enter: Pay & Checkout
      else if (e.key === 'F4' || (e.altKey && (e.key === 'p' || e.key === 'P')) || (e.altKey && (e.key === 'c' || e.key === 'C')) || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault()
        if (cartItems.length > 0) {
          const stockViolations = cartItems.filter(
            (i) => i.track_inventory && i.current_stock !== undefined && i.quantity > i.current_stock
          )
          if (stockViolations.length > 0) {
            message.error('Store එකේ තොගයට වඩා වැඩි භාණ්ඩ cart එකේ ඇති බැවින් checkout කළ නොහැක!')
            return
          }
          setIsPaymentOpen(true)
        } else {
          message.warning('Cart is empty. Please select or add items before checkout.')
        }
      } 
      // F9 or Ctrl+Delete or Alt+X or Ctrl+Backspace: Clear Cart
      else if (e.key === 'F9' || (e.ctrlKey && e.key === 'Delete') || (e.altKey && (e.key === 'x' || e.key === 'X')) || (e.ctrlKey && e.key === 'Backspace')) {
        e.preventDefault()
        if (cartItems.length > 0) {
          clearCart()
          message.info('Cart cleared.')
        } else {
          message.info('Cart is already empty.')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isQtyModalOpen, isPaymentOpen, isDiscountOpen, isReceiptOpen, isShortcutsOpen, cartItems, clearCart])

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* 🍰 Left Product Catalog Grid */}
      <ProductGrid
        products={products}
        categories={categories}
        onAddToCart={handleProductSelect}
        isLoading={isLoading}
      />

      {/* 🧾 Right Active Bill Cart Panel */}
      <Cart
        onOpenPaymentModal={() => setIsPaymentOpen(true)}
        onOpenDiscountModal={() => setIsDiscountOpen(true)}
        onEditItem={handleEditCartItem}
      />

      {/* ⚖️ Interactive Weight & Quantity Dialog */}
      <ProductQuantityModal
        isOpen={isQtyModalOpen}
        product={selectedProduct}
        currentCartQuantity={selectedInitialQty}
        onClose={() => {
          setIsQtyModalOpen(false)
          setSelectedProduct(null)
        }}
        onConfirm={handleConfirmQuantity}
      />

      {/* 🏷️ Quick Discount Modal */}
      <DiscountModal
        isOpen={isDiscountOpen}
        onClose={() => setIsDiscountOpen(false)}
      />

      {/* 💳 Payment & Checkout Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onOrderCompleted={(order) => {
          setCompletedOrder(order)
          setIsReceiptOpen(true)
          loadMenuData() // Refresh stock count
        }}
      />

      {/* 🧾 Thermal Receipt Preview Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        orderData={completedOrder}
      />

      {/* ⌨️ Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  )
}
