import React, { useState, useEffect } from 'react'
import { ProductGrid } from './ProductGrid'
import { Cart } from './Cart'
import { PaymentModal } from './PaymentModal'
import { ReceiptModal } from './ReceiptModal'
import { DiscountModal } from './DiscountModal'
import { ProductQuantityModal } from './ProductQuantityModal'
import { Product, Category } from '../../types/product'
import { useCartStore, CartItem as CartItemType } from '../../store/cartStore'
import { useAppStore } from '../../store/appStore'

export const POSPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const addItem = useCartStore((state) => state.addItem)
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
          { id: 'p1', shop_id: currentShop.id, category_id: 'c1', name: 'Black Forest Gateau', price: 3800, barcode: '4790001001', unit: 'kg', current_stock: 12, track_inventory: true, is_active: true, category_name: 'Signature Cakes', image_path: 'products/black_forest.jpg' },
          { id: 'p2', shop_id: currentShop.id, category_id: 'c1', name: 'Red Velvet Cake', price: 4200, barcode: '4790001002', unit: 'kg', current_stock: 8, track_inventory: true, is_active: true, category_name: 'Signature Cakes', image_path: 'products/red_velvet.jpg' },
          { id: 'p3', shop_id: currentShop.id, category_id: 'c1', name: 'Ribbon Butter Cake', price: 3300, barcode: '4790001003', unit: 'kg', current_stock: 20, track_inventory: true, is_active: true, category_name: 'Signature Cakes', image_path: 'products/ribbon_butter.jpg' },
          { id: 'p4', shop_id: currentShop.id, category_id: 'c2', name: 'Spicy Chicken Pastry', price: 220, barcode: '4790001004', unit: 'pcs', current_stock: 35, track_inventory: true, is_active: true, category_name: 'Pastries & Savories', image_path: 'products/spicy_chicken.jpg' },
          { id: 'p5', shop_id: currentShop.id, category_id: 'c2', name: 'Fish Bun (Seeni Sambol)', price: 150, barcode: '4790001005', unit: 'pcs', current_stock: 40, track_inventory: true, is_active: true, category_name: 'Pastries & Savories', image_path: 'products/fish_bun.jpg' },
          { id: 'p6', shop_id: currentShop.id, category_id: 'c3', name: 'Choco Fudge Cupcake', price: 280, barcode: '4790001006', unit: 'pcs', current_stock: 25, track_inventory: true, is_active: true, category_name: 'Desserts & Cupcakes', image_path: 'products/choco_fudge_cupcake.jpg' },
          { id: 'p7', shop_id: currentShop.id, category_id: 'c3', name: 'Vanilla Eclair', price: 260, barcode: '4790001007', unit: 'pcs', current_stock: 30, track_inventory: true, is_active: true, category_name: 'Desserts & Cupcakes', image_path: 'products/vanilla_eclair.jpg' },
          { id: 'p8', shop_id: currentShop.id, category_id: 'c4', name: 'Iced Caramel Latte', price: 750, barcode: '4790001008', unit: 'pcs', current_stock: 50, track_inventory: false, is_active: true, category_name: 'Beverages & Coffee', image_path: 'products/iced_caramel_latte.jpg' }
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

  // Open quantity/weight selection dialog when user clicks or scans an item
  const handleProductSelect = (product: Product) => {
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
      track_inventory: false,
      is_active: true,
      current_stock: item.current_stock,
      image_path: item.image_path,
      barcode: item.barcode
    }
    setSelectedProduct(matchedProduct)
    setSelectedInitialQty(item.quantity)
    setIsQtyModalOpen(true)
  }

  // On quantity/weight confirmed from modal
  const handleConfirmQuantity = (product: Product, quantity: number) => {
    // Replace quantity in cart with the confirmed value
    addItem(product, quantity, true)
  }

  // Keyboard Shortcuts (F4 to pay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4' && !isQtyModalOpen) {
        e.preventDefault()
        setIsPaymentOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isQtyModalOpen])

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
    </div>
  )
}
