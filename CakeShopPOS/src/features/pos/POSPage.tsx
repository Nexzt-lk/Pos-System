import React, { useState, useEffect } from 'react'
import { ProductGrid } from './ProductGrid'
import { Cart } from './Cart'
import { PaymentModal } from './PaymentModal'
import { ReceiptModal } from './ReceiptModal'
import { Product, Category } from '../../types/product'
import { useCartStore } from '../../store/cartStore'
import { useAppStore } from '../../store/appStore'

export const POSPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const addItem = useCartStore((state) => state.addItem)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<any | null>(null)

  // Fetch local products & categories on load or branch change
  const loadMenuData = async () => {
    if (!currentShop) return
    setIsLoading(true)
    try {
      if (window.electronAPI) {
        const [prods, cats] = await Promise.all([
          window.electronAPI.dbQuery('db:get-products', currentShop.id),
          window.electronAPI.dbQuery('db:get-categories', currentShop.id)
        ])
        setProducts(prods || [])
        setCategories(cats || [])
      } else {
        // Fallback default sample menu for browser preview
        setCategories([
          { id: 'c1', shop_id: currentShop.id, name: 'Signature Cakes', color: '#ec4899', sort_order: 1, is_active: true },
          { id: 'c2', shop_id: currentShop.id, name: 'Pastries & Savories', color: '#f59e0b', sort_order: 2, is_active: true },
          { id: 'c3', shop_id: currentShop.id, name: 'Desserts & Cupcakes', color: '#8b5cf6', sort_order: 3, is_active: true },
          { id: 'c4', shop_id: currentShop.id, name: 'Beverages & Coffee', color: '#06b6d4', sort_order: 4, is_active: true }
        ])
        setProducts([
          { id: 'p1', shop_id: currentShop.id, category_id: 'c1', name: 'Black Forest Cake 1kg', price: 3800, barcode: '4790001001', unit: 'pcs', current_stock: 12, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p2', shop_id: currentShop.id, category_id: 'c1', name: 'Red Velvet Gateau 1kg', price: 4200, barcode: '4790001002', unit: 'pcs', current_stock: 8, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p3', shop_id: currentShop.id, category_id: 'c1', name: 'Ribbon Butter Cake 500g', price: 1650, barcode: '4790001003', unit: 'pcs', current_stock: 20, track_inventory: true, is_active: true, category_name: 'Signature Cakes', category_color: '#ec4899' },
          { id: 'p4', shop_id: currentShop.id, category_id: 'c2', name: 'Spicy Chicken Pastry', price: 220, barcode: '4790001004', unit: 'pcs', current_stock: 35, track_inventory: true, is_active: true, category_name: 'Pastries & Savories', category_color: '#f59e0b' },
          { id: 'p5', shop_id: currentShop.id, category_id: 'c2', name: 'Fish Bun (Seeni Sambol)', price: 150, barcode: '4790001005', unit: 'pcs', current_stock: 40, track_inventory: true, is_active: true, category_name: 'Pastries & Savories', category_color: '#f59e0b' },
          { id: 'p6', shop_id: currentShop.id, category_id: 'c3', name: 'Choco Fudge Cupcake', price: 280, barcode: '4790001006', unit: 'pcs', current_stock: 25, track_inventory: true, is_active: true, category_name: 'Desserts & Cupcakes', category_color: '#8b5cf6' },
          { id: 'p7', shop_id: currentShop.id, category_id: 'c4', name: 'Iced Caramel Latte', price: 750, barcode: '4790001008', unit: 'pcs', current_stock: 50, track_inventory: false, is_active: true, category_name: 'Beverages & Coffee', category_color: '#06b6d4' }
        ])
      }
    } catch (err) {
      console.error('Failed to load menu:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMenuData()
  }, [currentShop?.id])

  // Keyboard Shortcuts (F4 to pay, F2 to search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault()
        setIsPaymentOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* 🍰 Left Product Catalog Grid */}
      <ProductGrid
        products={products}
        categories={categories}
        onAddToCart={addItem}
        isLoading={isLoading}
      />

      {/* 🧾 Right Active Bill Cart Panel */}
      <Cart
        onOpenPaymentModal={() => setIsPaymentOpen(true)}
        onOpenDiscountModal={() => {}}
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
    </div>
  )
}
