import React, { useState, useEffect, useMemo } from 'react'
import {
  Package,
  Package2,
  PlusCircle,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Barcode,
  Banknote,
  Scale,
  Truck,
  ArrowRight,
  ArrowLeft,
  Check,
  DollarSign,
  RotateCcw,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Modal, Form, Select, InputNumber, Input, Segmented, Switch, message } from 'antd'
import { Product, Category, normalizeProduct, normalizeCategory } from '../../types/product'
import { productsApi } from '../../api/productsApi'
import { categoriesApi } from '../../api/categoriesApi'
import { inventoryApi, StockPurchaseRecord } from '../../api/inventoryApi'
import { suppliersApi, SupplierDto } from '../../api/suppliersApi'
import { RefreshButton } from '../../components/RefreshButton'
import { InventoryFilters } from './InventoryFilters'
import { StockPurchasesLedger } from './StockPurchasesLedger'
import { AddSupplierModal } from './AddSupplierModal'
import { useAppStore } from '../../store/appStore'
import { useStockAlertStore } from '../../store/stockAlertStore'
import { formatCurrency, formatStockQty } from '../../lib/formatters'
import { generateCategoryItemCode } from '../../lib/skuGenerator'
import { getAutoMatchedProductImage, getProductImageSrc } from '../../lib/imageHelper'
import { ProductImagePicker } from '../products/ProductImagePicker'

export const InventoryPage: React.FC = () => {
  const currentShop = useAppStore((state) => state.currentShop)
  const currentUser = useAppStore((state) => state.currentUser)

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'price_asc'>('stock_asc')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [entryMode, setEntryMode] = useState<'EXISTING' | 'NEW'>('EXISTING')
  const [movementWeightMode, setMovementWeightMode] = useState<'kg' | 'g'>('kg')
  const [newProductWeightMode, setNewProductWeightMode] = useState<'kg' | 'g'>('kg')
  const [movementEntryMode, setMovementEntryMode] = useState<'weight' | 'amount'>('weight')
  const [priceBasis, setPriceBasis] = useState<'selling' | 'cost'>('selling')
  const [newProductEntryMode, setNewProductEntryMode] = useState<'weight' | 'amount'>('weight')
  const [isLoading, setIsLoading] = useState(false)

  // Suppliers & Stock Purchases State
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [stockPurchases, setStockPurchases] = useState<StockPurchaseRecord[]>([])
  const [activeInventoryTab, setActiveInventoryTab] = useState<'inventory' | 'purchases'>('inventory')
  const [modalStep, setModalStep] = useState<0 | 1>(0)
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false)

  const [form] = Form.useForm()

  const loadData = async () => {
    if (!currentShop) return
    setIsLoading(true)
    try {
      const [rawProds, rawCats, sups, purchases] = await Promise.all([
        productsApi.getAll(true, currentShop.id).catch(() => []),
        categoriesApi.getAll().catch(() => []),
        suppliersApi.getAll().catch(() => []),
        inventoryApi.getStockPurchases().catch(() => [])
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
      setSuppliers(sups)
      setStockPurchases(purchases)
    } catch (err) {
      console.error('Failed to load inventory:', err)
      message.error('Failed to load inventory from server')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentShop?.id])

  const handleOpenMovementModal = (product?: Product) => {
    form.resetFields()
    setModalStep(0)
    setMovementEntryMode('weight')
    setPriceBasis('selling')
    if (product) {
      setEntryMode('EXISTING')
      const isBaseGram = product.unit?.toLowerCase() === 'g'

      const defaultMode = isBaseGram ? 'g' : 'kg'
      setMovementWeightMode(defaultMode)

      const defKg = isBaseGram ? 0 : 1
      const defG = isBaseGram ? 500 : 0
      const initialQty = isBaseGram ? 500 : 1
      const p = product.price || 0
      const initialStockVal = Math.round(initialQty * p * 100) / 100

      form.setFieldsValue({
        product_id: product.id,
        type: 'IN',
        weight_kg: defKg,
        weight_g: defG,
        quantity: initialQty,
        stock_value: initialStockVal > 0 ? initialStockVal : undefined,
        note: '',
        price: product.price,
        cost_price: product.cost_price || 0
      })
    } else {
      setEntryMode('EXISTING')
      const firstTracked = products.find(p => p.track_inventory)
      const isBaseGram = firstTracked?.unit?.toLowerCase() === 'g'
      setMovementWeightMode(isBaseGram ? 'g' : 'kg')

      const defKg = isBaseGram ? 0 : 1
      const defG = isBaseGram ? 500 : 0
      const initialQty = isBaseGram ? 500 : 1
      const p = firstTracked?.price || 0
      const initialStockVal = Math.round(initialQty * p * 100) / 100

      form.setFieldsValue({
        product_id: firstTracked?.id || undefined,
        type: 'IN',
        weight_kg: defKg,
        weight_g: defG,
        quantity: initialQty,
        stock_value: initialStockVal > 0 ? initialStockVal : undefined,
        note: '',
        price: firstTracked?.price || 0,
        cost_price: firstTracked?.cost_price || 0
      })
    }
    setIsModalOpen(true)
  }

  const handleProductSelectInMovementModal = (productId: string) => {
    const selectedProd = products.find((p) => p.id === productId)
    if (selectedProd) {
      const isBaseGram = selectedProd.unit?.toLowerCase() === 'g'
      setMovementWeightMode(isBaseGram ? 'g' : 'kg')
      form.setFieldsValue({
        price: selectedProd.price,
        cost_price: selectedProd.cost_price || 0
      })

      const isWeight = selectedProd.unit?.toLowerCase() === 'kg' || selectedProd.unit?.toLowerCase() === 'g'
      const curVal = Number(form.getFieldValue('stock_value')) || 0
      const effectivePrice = (priceBasis === 'cost' && selectedProd.cost_price) ? selectedProd.cost_price : (selectedProd.price || 0)

      if (movementEntryMode === 'amount' && curVal > 0 && effectivePrice > 0) {
        if (isWeight) {
          if (isBaseGram) {
            const totalG = Math.round(curVal / effectivePrice)
            form.setFieldsValue({ weight_kg: Math.floor(totalG / 1000), weight_g: Math.round(totalG % 1000), quantity: totalG })
          } else {
            const totalKg = curVal / effectivePrice
            const totalG = Math.round(totalKg * 1000)
            form.setFieldsValue({ weight_kg: Math.floor(totalG / 1000), weight_g: Math.round(totalG % 1000), quantity: Math.round(totalKg * 1000) / 1000 })
          }
        } else {
          form.setFieldsValue({ quantity: Math.round((curVal / effectivePrice) * 100) / 100 })
        }
      } else {
        const curKg = Number(form.getFieldValue('weight_kg')) || 0
        const curG = Number(form.getFieldValue('weight_g')) || 0
        const curQty = isWeight ? (isBaseGram ? curKg * 1000 + curG : curKg + curG / 1000) : (Number(form.getFieldValue('quantity')) || 1)
        const calcVal = Math.round(curQty * effectivePrice * 100) / 100
        form.setFieldsValue({ stock_value: calcVal > 0 ? calcVal : undefined })
      }
    }
  }

  const handleMoneyAmountChange = (val: number | null, overrideBasis?: 'selling' | 'cost') => {
    const amount = Number(val) || 0
    const pId = form.getFieldValue('product_id')
    const selectedProd = tracked.find((p) => p.id === pId)
    if (!selectedProd) return

    const isWeight = selectedProd.unit?.toLowerCase() === 'kg' || selectedProd.unit?.toLowerCase() === 'g'
    const isBaseGram = selectedProd.unit?.toLowerCase() === 'g'

    const activeBasis = overrideBasis || priceBasis
    const curSellingPrice = Number(form.getFieldValue('price')) || selectedProd.price || 0
    const curCostPrice = Number(form.getFieldValue('cost_price')) || selectedProd.cost_price || 0
    const unitPrice = activeBasis === 'cost' && curCostPrice > 0 ? curCostPrice : curSellingPrice

    if (unitPrice <= 0 || amount <= 0) {
      if (isWeight) {
        form.setFieldsValue({ weight_kg: 0, weight_g: 0, quantity: 0 })
      } else {
        form.setFieldsValue({ quantity: 0 })
      }
      return
    }

    if (isWeight) {
      if (isBaseGram) {
        const totalG = Math.round(amount / unitPrice)
        const k = Math.floor(totalG / 1000)
        const g = Math.round(totalG % 1000)
        form.setFieldsValue({ weight_kg: k, weight_g: g, quantity: totalG })
      } else {
        const totalKg = amount / unitPrice
        const totalG = Math.round(totalKg * 1000)
        const k = Math.floor(totalG / 1000)
        const g = Math.round(totalG % 1000)
        const cleanKg = Math.round(totalKg * 1000) / 1000
        form.setFieldsValue({ weight_kg: k, weight_g: g, quantity: cleanKg })
      }
    } else {
      const pcs = Math.round((amount / unitPrice) * 100) / 100
      form.setFieldsValue({ quantity: pcs })
    }
  }

  const updateStockValueFromWeights = (kg: number, g: number) => {
    const pId = form.getFieldValue('product_id')
    const selectedProd = tracked.find((p) => p.id === pId)
    if (!selectedProd) return
    const isBaseGram = selectedProd.unit?.toLowerCase() === 'g'
    const curSellingPrice = Number(form.getFieldValue('price')) || selectedProd.price || 0
    const curCostPrice = Number(form.getFieldValue('cost_price')) || selectedProd.cost_price || 0
    const unitPrice = priceBasis === 'cost' && curCostPrice > 0 ? curCostPrice : curSellingPrice
    const totalQty = isBaseGram ? (kg * 1000 + g) : (kg + g / 1000)
    const val = Math.round(totalQty * unitPrice * 100) / 100
    form.setFieldsValue({ stock_value: val > 0 ? val : undefined })
  }

  const updateStockValueFromQty = (qty: number) => {
    const pId = form.getFieldValue('product_id')
    const selectedProd = tracked.find((p) => p.id === pId)
    if (!selectedProd) return
    const curSellingPrice = Number(form.getFieldValue('price')) || selectedProd.price || 0
    const curCostPrice = Number(form.getFieldValue('cost_price')) || selectedProd.cost_price || 0
    const unitPrice = priceBasis === 'cost' && curCostPrice > 0 ? curCostPrice : curSellingPrice
    const val = Math.round(qty * unitPrice * 100) / 100
    form.setFieldsValue({ stock_value: val > 0 ? val : undefined })
  }

  const handleNewProductMoneyAmountChange = (val: number | null) => {
    const amount = Number(val) || 0
    const chosenUnit = form.getFieldValue('new_unit') || 'pcs'
    const isNewWeight = chosenUnit === 'kg' || chosenUnit === 'g'
    const isBaseGram = chosenUnit === 'g'
    const curSellingPrice = Number(form.getFieldValue('new_price')) || 0
    const curCostPrice = Number(form.getFieldValue('new_cost_price')) || 0
    const unitPrice = curSellingPrice > 0 ? curSellingPrice : (curCostPrice > 0 ? curCostPrice : 0)

    if (unitPrice <= 0 || amount <= 0) {
      if (isNewWeight) {
        form.setFieldsValue({ new_weight_kg: 0, new_weight_g: 0, new_quantity: 0 })
      } else {
        form.setFieldsValue({ new_quantity: 0 })
      }
      return
    }

    if (isNewWeight) {
      if (isBaseGram) {
        const totalG = Math.round(amount / unitPrice)
        form.setFieldsValue({
          new_weight_kg: Math.floor(totalG / 1000),
          new_weight_g: Math.round(totalG % 1000),
          new_quantity: totalG
        })
      } else {
        const totalKg = amount / unitPrice
        const totalG = Math.round(totalKg * 1000)
        form.setFieldsValue({
          new_weight_kg: Math.floor(totalG / 1000),
          new_weight_g: Math.round(totalG % 1000),
          new_quantity: Math.round(totalKg * 1000) / 1000
        })
      }
    } else {
      form.setFieldsValue({ new_quantity: Math.round((amount / unitPrice) * 100) / 100 })
    }
  }

  const handleCategorySelectForNewItem = (categoryId: string) => {
    const chosenCat = categories.find((c) => c.id === categoryId)
    const autoCode = generateCategoryItemCode(chosenCat, products)
    form.setFieldsValue({ new_barcode: autoCode })
  }

  const handleRegenerateNewItemCode = () => {
    const curCatId = form.getFieldValue('new_category_id') || categories[0]?.id
    const chosenCat = categories.find((c) => c.id === curCatId)
    const autoCode = generateCategoryItemCode(chosenCat, products)
    form.setFieldsValue({ new_barcode: autoCode })
    message.success(`Generated code: ${autoCode}`)
  }

  const handleNextStep = async () => {
    try {
      if (entryMode === 'EXISTING') {
        await form.validateFields(['product_id', 'type', 'price'])
        const values = form.getFieldsValue()
        const selectedProd = tracked.find((p) => p.id === values.product_id)
        if (!selectedProd) {
          message.error('Please select a valid product')
          return
        }

        const isWeight = selectedProd.unit?.toLowerCase() === 'kg' || selectedProd.unit?.toLowerCase() === 'g'
        const isBaseGram = selectedProd.unit?.toLowerCase() === 'g'

        let qty = Number(values.quantity) || 0
        if (isWeight) {
          const kg = Number(values.weight_kg) || 0
          const g = Number(values.weight_g) || 0
          qty = isBaseGram ? (kg * 1000 + g) : (kg + g / 1000)
        }

        if (qty <= 0) {
          message.error('Please enter a valid stock quantity greater than 0')
          return
        }

        const costP = Number(values.cost_price) || selectedProd?.cost_price || 0
        const autoCost = Math.round(qty * costP * 100) / 100

        const curTotalCost = form.getFieldValue('total_stock_cost')
        if (curTotalCost === undefined || curTotalCost === null) {
          form.setFieldsValue({ total_stock_cost: autoCost > 0 ? autoCost : undefined })
        }

        if (!form.getFieldValue('supplier_id') && suppliers.length > 0) {
          form.setFieldsValue({
            supplier_id: suppliers[0].id,
            supplier_name: suppliers[0].name
          })
        }

        if (form.getFieldValue('record_expense') === undefined) {
          form.setFieldsValue({ record_expense: true })
        }
        if (!form.getFieldValue('payment_method')) {
          form.setFieldsValue({ payment_method: 'CASH' })
        }

        setModalStep(1)
      } else {
        await form.validateFields(['new_name', 'new_category_id', 'new_price'])
        const values = form.getFieldsValue()
        const chosenUnit = values.new_unit || 'pcs'
        const isNewWeight = chosenUnit === 'kg' || chosenUnit === 'g'
        const isNewBaseGram = chosenUnit === 'g'

        let qty = Number(values.new_quantity) || 0
        if (isNewWeight) {
          const kg = Number(values.new_weight_kg) || 0
          const g = Number(values.new_weight_g) || 0
          qty = isNewBaseGram ? (kg * 1000 + g) : (kg + g / 1000)
        }

        const costP = Number(values.new_cost_price) || 0
        const autoCost = Math.round(qty * costP * 100) / 100

        const curTotalCost = form.getFieldValue('total_stock_cost')
        if (curTotalCost === undefined || curTotalCost === null) {
          form.setFieldsValue({ total_stock_cost: autoCost > 0 ? autoCost : undefined })
        }

        if (!form.getFieldValue('supplier_id') && suppliers.length > 0) {
          form.setFieldsValue({
            supplier_id: suppliers[0].id,
            supplier_name: suppliers[0].name
          })
        }
        if (form.getFieldValue('record_expense') === undefined) {
          form.setFieldsValue({ record_expense: true })
        }
        if (!form.getFieldValue('payment_method')) {
          form.setFieldsValue({ payment_method: 'CASH' })
        }

        setModalStep(1)
      }
    } catch (err) {
      // validation error in form
    }
  }

  const handleSaveMovement = async (values: any) => {
    if (!currentShop) return

    try {
      if (entryMode === 'EXISTING') {
        if (!values.product_id) {
          message.error('Please select a product')
          return
        }

        const selectedProd = tracked.find((p) => p.id === values.product_id)
        if (!selectedProd) {
          message.error('Product not found in inventory')
          return
        }
        const isWeight = selectedProd.unit?.toLowerCase() === 'kg' || selectedProd.unit?.toLowerCase() === 'g'
        const isBaseGram = selectedProd.unit?.toLowerCase() === 'g'

        let finalQty = Number(values.quantity)
        if (isWeight) {
          if (values.weight_kg !== undefined || values.weight_g !== undefined) {
            const kg = Number(values.weight_kg) || 0
            const g = Number(values.weight_g) || 0
            finalQty = isBaseGram ? (kg * 1000 + g) : (kg + g / 1000)
          } else if (isBaseGram) {
            finalQty = movementWeightMode === 'kg' ? finalQty * 1000 : finalQty
          } else {
            // Base unit is kg
            finalQty = movementWeightMode === 'g' ? Math.round((finalQty / 1000) * 1000) / 1000 : finalQty
          }
        }

        const noteExtra = movementEntryMode === 'amount' && values.stock_value
          ? `[Rs. ${Number(values.stock_value).toLocaleString()} (${priceBasis === 'cost' ? 'Cost' : 'Selling'} Price)]`
          : ''
        const finalNote = values.note
          ? `${values.note.trim()} ${noteExtra}`.trim()
          : (noteExtra || '')

        const selectedSupplier = suppliers.find((s) => s.id === values.supplier_id)
        const supplierName = values.supplier_name || selectedSupplier?.name || (values.supplier_id ? 'Direct Supplier' : undefined)
        const totalStockCost = values.total_stock_cost !== undefined && values.total_stock_cost !== null
          ? Number(values.total_stock_cost)
          : undefined

        await inventoryApi.recordMovement({
          productId: values.product_id,
          type: values.type,
          quantity: finalQty,
          note: finalNote,
          costPerUnit: values.cost_price !== undefined ? Number(values.cost_price) : undefined,
          doneBy: currentUser?.name || currentUser?.role || 'Owner',
          supplierId: values.supplier_id,
          supplierName: supplierName,
          totalCost: totalStockCost,
          invoiceNo: values.invoice_no ? values.invoice_no.trim() : undefined,
          paymentMethod: values.payment_method || 'CASH',
          recordExpense: values.record_expense !== false
        }, currentShop.id)

        // Check if selling price or cost price was edited, and update product catalog
        const newSellingPrice = Number(values.price)
        const newCostPrice = Number(values.cost_price) || 0
        const priceChanged = !isNaN(newSellingPrice) && newSellingPrice > 0 && newSellingPrice !== selectedProd.price
        const costChanged = !isNaN(newCostPrice) && newCostPrice !== (selectedProd.cost_price || 0)

        if (priceChanged || costChanged) {
          await productsApi.update(selectedProd.id, {
            shopId: currentShop?.id,
            shop_id: currentShop?.id,
            categoryId: selectedProd.category_id,
            name: selectedProd.name,
            description: selectedProd.description,
            price: priceChanged ? newSellingPrice : selectedProd.price,
            costPrice: costChanged ? newCostPrice : (selectedProd.cost_price || 0),
            barcode: selectedProd.barcode,
            unit: selectedProd.unit,
            trackInventory: Boolean(selectedProd.track_inventory),
            isActive: true
          })
          message.success(`Stock recorded & prices updated for "${selectedProd.name}"!`)
        } else {
          const costMsg = totalStockCost && totalStockCost > 0 ? ` (Cost: ${formatCurrency(totalStockCost)})` : ''
          const supMsg = supplierName ? ` from ${supplierName}` : ''
          message.success(`Stock movement recorded${supMsg}${costMsg}!`)
        }
      } else {
        // NEW ITEM MODE via Backend API
        const selectedCat = categories.find((c) => c.id === values.new_category_id)
        const itemCode = values.new_barcode ? values.new_barcode.trim() : generateCategoryItemCode(selectedCat, products)
        const isNewWeight = values.new_unit?.toLowerCase() === 'kg' || values.new_unit?.toLowerCase() === 'g'
        const isNewBaseGram = values.new_unit?.toLowerCase() === 'g'

        let finalNewStock = Number(values.new_quantity) || 0
        if (isNewWeight) {
          if (values.new_weight_kg !== undefined || values.new_weight_g !== undefined) {
            const kg = Number(values.new_weight_kg) || 0
            const g = Number(values.new_weight_g) || 0
            finalNewStock = isNewBaseGram ? (kg * 1000 + g) : (kg + g / 1000)
          } else if (isNewBaseGram) {
            finalNewStock = newProductWeightMode === 'kg' ? finalNewStock * 1000 : finalNewStock
          } else {
            finalNewStock = newProductWeightMode === 'g' ? Math.round((finalNewStock / 1000) * 1000) / 1000 : finalNewStock
          }
        }

        const createdProd = await productsApi.create({
          categoryId: values.new_category_id,
          name: values.new_name.trim(),
          description: values.new_description || '',
          price: Number(values.new_price) || 0,
          costPrice: Number(values.new_cost_price) || 0,
          barcode: itemCode,
          unit: values.new_unit || 'pcs',
          trackInventory: true,
          initialStock: finalNewStock,
          imagePath: values.new_image_path || getAutoMatchedProductImage(values.new_name, selectedCat?.name),
          minStockAlert: 5,
          shopId: currentShop?.id,
          shop_id: currentShop?.id
        })

        // Also record supplier details and expense for the initial stock batch if stock > 0
        if (finalNewStock > 0 && createdProd?.id) {
          const selectedSupplier = suppliers.find((s) => s.id === values.supplier_id)
          const supplierName = values.supplier_name || selectedSupplier?.name || 'Initial Supplier'
          const totalStockCost = values.total_stock_cost !== undefined && values.total_stock_cost !== null
            ? Number(values.total_stock_cost)
            : Math.round(finalNewStock * (Number(values.new_cost_price) || 0) * 100) / 100

          await inventoryApi.recordMovement({
            productId: createdProd.id,
            type: 'IN',
            quantity: finalNewStock,
            note: values.new_note || 'Initial stock receipt',
            costPerUnit: Number(values.new_cost_price) || 0,
            doneBy: currentUser?.name || currentUser?.role || 'Owner',
            supplierId: values.supplier_id,
            supplierName: supplierName,
            totalCost: totalStockCost,
            invoiceNo: values.invoice_no ? values.invoice_no.trim() : undefined,
            paymentMethod: values.payment_method || 'CASH',
            recordExpense: values.record_expense !== false
          }, currentShop.id)
        }

        message.success(`New item "${values.new_name}" created & initial stock recorded!`)
      }

      setIsModalOpen(false)
      setModalStep(0)
      await loadData()
      if (currentShop?.id) {
        useStockAlertStore.getState().fetchStockAlerts(currentShop.id, false)
      }
    } catch (err: any) {
      console.error('Failed to save stock movement:', err)
      message.error(err.message || 'Failed to save movement')
    }
  }

  const tracked = useMemo(() => products.filter((p) => p.track_inventory), [products])
  const inStockCount = useMemo(() => tracked.filter((p) => (p.current_stock ?? 0) > 5).length, [tracked])
  const lowStockCount = useMemo(() => tracked.filter((p) => (p.current_stock ?? 0) <= 5 && (p.current_stock ?? 0) > 0).length, [tracked])
  const outOfStockCount = useMemo(() => tracked.filter((p) => (p.current_stock ?? 0) <= 0).length, [tracked])

  // Category counts for tracked inventory
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    tracked.forEach((p) => {
      const catId = p.category_id || 'uncategorized'
      counts[catId] = (counts[catId] || 0) + 1
    })
    return counts
  }, [tracked])

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return tracked
      .filter((p) => {
        const matchSearch =
          searchQuery === '' ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.category_name && p.category_name.toLowerCase().includes(searchQuery.toLowerCase()))

        const matchCat = selectedCategory === 'all' || p.category_id === selectedCategory

        let matchStock = true
        if (stockFilter === 'in_stock') {
          matchStock = (p.current_stock ?? 0) > 5
        } else if (stockFilter === 'low_stock') {
          matchStock = (p.current_stock ?? 0) <= 5 && (p.current_stock ?? 0) > 0
        } else if (stockFilter === 'out_of_stock') {
          matchStock = (p.current_stock ?? 0) <= 0
        }

        return matchSearch && matchCat && matchStock
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name)
        if (sortBy === 'stock_asc') return (a.current_stock ?? 0) - (b.current_stock ?? 0)
        if (sortBy === 'stock_desc') return (b.current_stock ?? 0) - (a.current_stock ?? 0)
        if (sortBy === 'price_desc') return b.price - a.price
        if (sortBy === 'price_asc') return a.price - b.price
        return 0
      })
  }, [tracked, searchQuery, selectedCategory, stockFilter, sortBy])

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 50

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedCategory, stockFilter, sortBy])

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredProducts, currentPage])
  
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)

  return (
    <div className="page-container" style={{ padding: '18px 24px', gap: 16 }}>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ minWidth: 260, flex: '1 1 auto' }}>
          <div className="page-title" style={{ fontSize: 20 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                border: '1px solid #bfdbfe'
              }}
            >
              <Package size={20} />
            </div>
            <span>Stock & Inventory Ledger</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#1e40af',
                background: '#eff6ff',
                border: '1px solid #dbeafe',
                padding: '2px 8px',
                borderRadius: 99,
                marginLeft: 4
              }}
            >
              {tracked.length} Items Tracked
            </span>
          </div>
          <div className="page-subtitle" style={{ marginTop: 4 }}>
            Monitor real-time on-hand stock quantities, stock arrivals, wastage, and inventory levels ·{' '}
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{currentShop?.name || 'Main Branch'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'nowrap' }}>
          <Segmented
            value={activeInventoryTab}
            onChange={(val) => setActiveInventoryTab(val as 'inventory' | 'purchases')}
            options={[
              {
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '3px 8px' }}>
                    <Package size={15} />
                    <span>On-Hand Stock</span>
                  </div>
                ),
                value: 'inventory'
              },
              {
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, padding: '3px 8px' }}>
                    <Truck size={15} />
                    <span>Stock Purchases & GRN ({stockPurchases.length})</span>
                  </div>
                ),
                value: 'purchases'
              }
            ]}
          />

          <RefreshButton onClick={loadData} isLoading={isLoading} />

          <button
            onClick={() => handleOpenMovementModal()}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.92'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(22, 163, 74, 0.3)'
            }}
          >
            <PlusCircle size={16} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>Record Stock Movement</span>
          </button>
        </div>
      </div>

      {activeInventoryTab === 'purchases' ? (
        <StockPurchasesLedger
          purchases={stockPurchases}
          suppliers={suppliers}
          isLoading={isLoading}
          onRefresh={loadData}
        />
      ) : (
        <>
          {/* ── KPI Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flexShrink: 0 }}>
        {/* Total Tracked */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tracked Items
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
              {tracked.length}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
              Active stock SKUs
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#eff6ff',
              border: '1px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6'
            }}
          >
            <Package2 size={22} />
          </div>
        </div>

        {/* In Good Stock */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Healthy Stock
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 2 }}>
              {inStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>
              Over 5 units available
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a'
            }}
          >
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Low Stock Items */}
        <div
          style={{
            background: lowStockCount > 0 ? '#fffbeb' : '#ffffff',
            border: lowStockCount > 0 ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Low Stock Alert
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#b45309', marginTop: 2 }}>
              {lowStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 1 }}>
              Re-stock recommended
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fef3c7',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706'
            }}
          >
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Out of Stock */}
        <div
          style={{
            background: outOfStockCount > 0 ? '#fef2f2' : '#ffffff',
            border: outOfStockCount > 0 ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Out of Stock
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', marginTop: 2 }}>
              {outOfStockCount}
            </div>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 1 }}>
              0 units on shelf
            </div>
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626'
            }}
          >
            <AlertOctagon size={22} />
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <InventoryFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        categoryCounts={categoryCounts}
        trackedCount={tracked.length}
        inStockCount={inStockCount}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
      />

      {/* ── Inventory Table ── */}
      <div
        className="data-table"
        style={{
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          background: '#ffffff'
        }}
      >
        <div style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="table-wrap" style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '13px 18px', width: '30%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Product Name
                  </th>
                  <th style={{ padding: '13px 16px', width: '16%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Category
                  </th>
                  <th style={{ padding: '13px 16px', width: '14%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Item Code / Barcode
                  </th>
                  <th style={{ padding: '13px 16px', width: '14%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Selling Price
                  </th>
                  <th style={{ padding: '13px 16px', width: '12%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Cost Price
                  </th>
                  <th style={{ padding: '13px 16px', width: '14%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Stock
                  </th>
                  <th style={{ padding: '13px 18px', textAlign: 'right', width: '12%', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Update Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => {
                  const stockNum = product.current_stock ?? 0
                  const isLow = stockNum <= 5 && stockNum > 0
                  const isOut = stockNum <= 0
                  const catColor = product.category_color || '#16a34a'

                  return (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.12s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      {/* Product Name + Icon */}
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: `${catColor}15`,
                              border: `1px solid ${catColor}30`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: catColor,
                              fontWeight: 800,
                              fontSize: 14,
                              flexShrink: 0,
                              overflow: 'hidden',
                              position: 'relative'
                            }}
                          >
                            <img
                              src={getProductImageSrc(product.image_path || (product as any).imagePath, product.name, product.category_name)}
                              alt={product.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                const imgPath = product.image_path || (product as any).imagePath
                                const clean = imgPath?.replace(/^\/+/, '') || ''
                                const cached = typeof window !== 'undefined' ? localStorage.getItem(`pos_img_${clean}`) : null
                                if (cached && e.currentTarget.src !== cached) {
                                  e.currentTarget.src = cached
                                } else {
                                  e.currentTarget.style.display = 'none'
                                }
                              }}
                            />
                            <Package size={18} style={{ position: 'absolute', zIndex: 0, opacity: 0.7 }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: '#64748b',
                                fontWeight: 600,
                                fontSize: 13.5,
                                lineHeight: 1.3
                              }}
                            >
                              {product.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                                Unit: <strong>{product.unit}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                          {product.category_name || 'General'}
                        </span>
                      </td>

                      {/* Barcode / SKU */}
                      <td style={{ padding: '12px 16px' }}>
                        {product.barcode ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Barcode size={14} style={{ color: '#94a3b8' }} />
                            <span
                              style={{
                                fontFamily: 'monospace',
                                color: '#64748b',
                                fontSize: 13
                              }}
                            >
                              {product.barcode}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#64748b', fontSize: 12.5 }}>
                          {formatCurrency(product.price)}
                        </div>
                      </td>

                      {/* Cost Price */}
                      <td style={{ padding: '12px 16px' }}>
                        {product.cost_price ? (
                          <span style={{ color: '#64748b', fontWeight: 600, fontSize: 12.5 }}>
                            {formatCurrency(product.cost_price)}
                          </span>
                        ) : (
                          <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* On-Hand Stock */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 10px',
                            borderRadius: 99,
                            fontSize: 11.5,
                            fontWeight: 700,
                            background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4',
                            color: isOut ? '#991b1b' : isLow ? '#92400e' : '#166534',
                            border: `1px solid ${isOut ? '#fecaca' : isLow ? '#fde68a' : '#bbf7d0'}`
                          }}
                        >
                          {isOut ? 'Out of Stock' : formatStockQty(product.current_stock, product.unit)}
                        </span>
                      </td>

                      {/* Quick Action */}
                      <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOpenMovementModal(product)}
                            title="Record Stock Movement / Update Stock"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: '1px solid #bbf7d0',
                              background: '#f0fdf4',
                              color: '#15803d',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: '0 1px 2px rgba(22, 163, 74, 0.08)',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#16a34a'
                              e.currentTarget.style.color = '#ffffff'
                              e.currentTarget.style.borderColor = '#16a34a'
                              e.currentTarget.style.boxShadow = '0 3px 8px rgba(22, 163, 74, 0.25)'
                              e.currentTarget.style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#f0fdf4'
                              e.currentTarget.style.color = '#15803d'
                              e.currentTarget.style.borderColor = '#bbf7d0'
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(22, 163, 74, 0.08)'
                              e.currentTarget.style.transform = 'none'
                            }}
                          >
                            <PlusCircle size={14} />
                            <span>+ Restock</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 16,
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 12px',
                          color: '#94a3b8'
                        }}
                      >
                        <Package2 size={28} />
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        No Inventory Records Found
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 360, margin: '4px auto 16px' }}>
                        {searchQuery
                          ? `No inventory items matching "${searchQuery}".`
                          : 'No tracked items found for this selection.'}
                      </div>
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('')
                            setSelectedCategory('all')
                            setStockFilter('all')
                          }}
                          style={{
                            padding: '7px 18px',
                            borderRadius: 8,
                            border: '1px solid #bbf7d0',
                            background: '#f0fdf4',
                            color: '#16a34a',
                            fontWeight: 700,
                            fontSize: 12.5,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#16a34a'
                            e.currentTarget.style.color = '#ffffff'
                            e.currentTarget.style.borderColor = '#16a34a'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f0fdf4'
                            e.currentTarget.style.color = '#16a34a'
                            e.currentTarget.style.borderColor = '#bbf7d0'
                          }}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} items
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: currentPage === 1 ? '#e2e8f0' : '#cbd5e1',
                    background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                    color: currentPage === 1 ? '#94a3b8' : '#334155',
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: currentPage === 1 ? 'none' : '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.borderColor = '#94a3b8'
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.color = '#0f172a'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.borderColor = '#cbd5e1'
                      e.currentTarget.style.background = '#ffffff'
                      e.currentTarget.style.color = '#334155'
                    }
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: currentPage === totalPages ? '#e2e8f0' : '#cbd5e1',
                    background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
                    color: currentPage === totalPages ? '#94a3b8' : '#334155',
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: currentPage === totalPages ? 'none' : '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.borderColor = '#94a3b8'
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.color = '#0f172a'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.borderColor = '#cbd5e1'
                      e.currentTarget.style.background = '#ffffff'
                      e.currentTarget.style.color = '#334155'
                    }
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* ── Movement Modal ── */}
      <Modal
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setModalStep(0)
        }}
        title={
          modalStep === 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 6 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.12) 0%, rgba(22, 163, 74, 0.04) 100%)',
                border: '1.5px solid rgba(22, 163, 74, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#15803d',
                flexShrink: 0
              }}>
                <Truck size={22} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Step 2: Supplier & Purchase Expense (සැපයුම්කරු හා වියදම් විස්තර)
                </div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 1 }}>
                  Select supplier, verify auto-calculated or manual stock cost, and record store expense
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 6 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: entryMode === 'NEW' 
                  ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0.04) 100%)'
                  : 'linear-gradient(135deg, rgba(238, 77, 45, 0.12) 0%, rgba(238, 77, 45, 0.04) 100%)',
                border: `1.5px solid ${entryMode === 'NEW' ? 'rgba(37, 99, 235, 0.25)' : 'rgba(238, 77, 45, 0.25)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: entryMode === 'NEW' ? '#2563eb' : 'var(--primary)',
                flexShrink: 0
              }}>
                {entryMode === 'NEW' ? <PlusCircle size={22} /> : <Package2 size={22} />}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  {entryMode === 'NEW' ? 'Receive & Register New Cake Item' : 'Inventory Stock Update (තොග යාවත්කාලීන කිරීම)'}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 1 }}>
                  {entryMode === 'NEW' ? 'Add new item to catalog and receive initial stock balance' : 'Step 1: Set quantities, weights, money amounts, or pricing'}
                </div>
              </div>
            </div>
          )
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
            <div>
              {modalStep === 1 ? (
                <button
                  type="button"
                  onClick={() => setModalStep(0)}
                  style={{
                    height: 42,
                    padding: '0 20px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff' }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Quantities (ආපසු)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setModalStep(0)
                  }}
                  style={{
                    height: 42,
                    padding: '0 20px',
                    borderRadius: 10,
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#334155' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#64748b' }}
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              {modalStep === 0 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  style={{
                    height: 42,
                    padding: '0 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.28)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
                >
                  <span>Next: Supplier & Cost Details (ඊළඟ පියවර)</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => form.submit()}
                  style={{
                    height: 42,
                    padding: '0 26px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none' }}
                >
                  <Check size={17} />
                  <span>Confirm & Update Stock (තොගය සටහන් කරන්න)</span>
                </button>
              )}
            </div>
          </div>
        }
        style={{ top: 20, maxWidth: '96vw', paddingBottom: 20 }}
        styles={{
          body: {
            maxHeight: 'calc(88vh - 90px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '20px 24px',
            background: '#f8fafc'
          }
        }}
        width="min(1040px, 96vw)"
      >
        {/* Step Indicator Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 18,
          padding: 4,
          background: '#e2e8f0',
          borderRadius: 12
        }}>
          <div
            onClick={() => setModalStep(0)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 10,
              background: modalStep === 0 ? '#ffffff' : 'transparent',
              boxShadow: modalStep === 0 ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: modalStep === 0 ? 'var(--primary)' : '#16a34a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12
            }}>
              {modalStep > 0 ? <Check size={16} /> : '1'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: modalStep === 0 ? '#0f172a' : '#475569' }}>
                1. Product & Quantities (අයිතමය හා ප්‍රමාණය)
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Item selection, weights, prices & live stock preview
              </div>
            </div>
          </div>

          <div
            onClick={() => {
              if (modalStep === 0) handleNextStep()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 10,
              background: modalStep === 1 ? '#ffffff' : 'transparent',
              boxShadow: modalStep === 1 ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: modalStep === 1 ? 'var(--primary)' : '#cbd5e1',
              color: modalStep === 1 ? '#ffffff' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12
            }}>
              2
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: modalStep === 1 ? '#0f172a' : '#94a3b8' }}>
                2. Supplier & Cost Details (සැපයුම්කරු හා වියදම්)
              </div>
              <div style={{ fontSize: 11, color: modalStep === 1 ? '#64748b' : '#94a3b8' }}>
                Supplier, invoice #, auto/manual total cost & expense
              </div>
            </div>
          </div>
        </div>

        {/* Mode Switcher - Only in Step 0 */}
        {modalStep === 0 && (
          <div style={{ marginBottom: 16 }}>
            <Segmented
              block
              size="large"
              value={entryMode}
              onChange={(val) => {
                const mode = val as 'EXISTING' | 'NEW'
                setEntryMode(mode)
                if (mode === 'NEW') {
                  const initCat = categories[0]
                  const autoCode = generateCategoryItemCode(initCat, products)
                  form.setFieldsValue({
                    new_unit: 'pcs',
                    new_category_id: initCat?.id || undefined,
                    new_barcode: autoCode,
                    new_quantity: 10,
                    new_price: 0,
                    new_cost_price: 0,
                    new_note: 'Initial stock receipt'
                  })
                } else {
                  form.setFieldsValue({
                    type: 'IN',
                    quantity: 1
                  })
                }
              }}
              options={[
                {
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '4px 0', fontWeight: 700, fontSize: 13.5 }}>
                      <Package size={17} />
                      <span>Existing Item Restock (දැනට ඇති අයිතමයක්)</span>
                    </div>
                  ),
                  value: 'EXISTING'
                },
                {
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '4px 0', fontWeight: 700, fontSize: 13.5 }}>
                      <PlusCircle size={17} />
                      <span>+ New Item Registration (අලුත් අයිතමයක්)</span>
                    </div>
                  ),
                  value: 'NEW'
                }
              ]}
            />
          </div>
        )}

        <Form form={form} layout="vertical" onFinish={handleSaveMovement} style={{ paddingTop: 4 }}>
          {/* ══════════════════════════════════════════════════════════════ */}
          {/* STEP 1: ITEM & QUANTITY DETAILS */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <div style={{ display: modalStep === 0 ? 'block' : 'none' }}>
            {entryMode === 'EXISTING' ? (
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) =>
                prev.product_id !== cur.product_id ||
                prev.type !== cur.type ||
                prev.quantity !== cur.quantity ||
                prev.weight_kg !== cur.weight_kg ||
                prev.weight_g !== cur.weight_g ||
                prev.stock_value !== cur.stock_value ||
                prev.price !== cur.price ||
                prev.cost_price !== cur.cost_price
              }
            >
              {({ getFieldValue }) => {
                const pId = getFieldValue('product_id')
                const selectedProd = tracked.find((p) => p.id === pId)
                const isWeight = selectedProd?.unit?.toLowerCase() === 'kg' || selectedProd?.unit?.toLowerCase() === 'g'
                const isBaseGram = selectedProd?.unit?.toLowerCase() === 'g'
                const currentQty = Number(getFieldValue('quantity')) || 0
                const kgPart = Number(getFieldValue('weight_kg')) || 0
                const gPart = Number(getFieldValue('weight_g')) || 0
                const mType = getFieldValue('type') || 'IN'
                const sellP = Number(getFieldValue('price')) || selectedProd?.price || 0
                const costP = Number(getFieldValue('cost_price')) || selectedProd?.cost_price || 0
                const profit = sellP - costP
                const margin = sellP > 0 && costP > 0 ? Math.round((profit / sellP) * 100) : null

                // Calculate normalized change in product base unit
                let normalizedChange = currentQty
                if (isWeight) {
                  const totalKg = kgPart + gPart / 1000
                  normalizedChange = isBaseGram ? (kgPart * 1000 + gPart) : totalKg
                }

                const currentStock = selectedProd?.current_stock ?? 0
                let projectedStock = currentStock
                if (mType === 'IN' || mType === 'RETURN') {
                  projectedStock = currentStock + normalizedChange
                } else if (mType === 'DAMAGE') {
                  projectedStock = Math.max(0, currentStock - normalizedChange)
                } else if (mType === 'ADJUST') {
                  projectedStock = normalizedChange
                }

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                    gap: 16,
                    alignItems: 'start'
                  }}>
                    {/* ──── LEFT COLUMN: Target Product & Pricing ──── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* 1. Target Product */}
                      <div className="form-section" style={{ margin: 0 }}>
                        <div className="form-section-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#2563eb'
                            }}>
                              <Package size={15} />
                            </div>
                            <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                              1. Target Product (අයිතමය තෝරන්න)
                            </span>
                          </div>
                        </div>

                        <Form.Item
                          name="product_id"
                          label={<span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>Select Item from Catalog</span>}
                          rules={[{ required: true, message: 'Please select a product' }]}
                          style={{ marginBottom: selectedProd ? 12 : 0 }}
                        >
                          <Select
                            placeholder="Choose or search product by name, barcode..."
                            showSearch
                            size="large"
                            style={{ borderRadius: 8, width: '100%' }}
                            onChange={handleProductSelectInMovementModal}
                            optionFilterProp="children"
                            filterOption={(input, option) =>
                              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                            }
                            options={tracked.map((p) => ({
                              value: p.id,
                              label: `${p.name} (Code: ${p.barcode || '—'} · Current: ${formatStockQty(p.current_stock, p.unit)})`
                            }))}
                          />
                        </Form.Item>

                        {/* Selected Product Preview Card */}
                        {selectedProd && (
                          <div style={{
                            display: 'flex',
                            gap: 12,
                            padding: '12px 14px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            alignItems: 'center'
                          }}>
                            <div style={{
                              width: 50,
                              height: 50,
                              borderRadius: 10,
                              overflow: 'hidden',
                              background: '#ffffff',
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #e2e8f0'
                            }}>
                              <img
                                src={getProductImageSrc(selectedProd.image_path || selectedProd.imagePath, selectedProd.name, selectedProd.category_name) || getAutoMatchedProductImage(selectedProd.name)}
                                alt={selectedProd.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => {
                                  const imgPath = selectedProd.image_path || selectedProd.imagePath
                                  const clean = imgPath?.replace(/^\/+/, '') || ''
                                  const cached = typeof window !== 'undefined' ? localStorage.getItem(`pos_img_${clean}`) : null
                                  if (cached && (e.target as HTMLImageElement).src !== cached) {
                                    (e.target as HTMLImageElement).src = cached
                                  } else {
                                    (e.target as HTMLElement).style.display = 'none'
                                  }
                                }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontWeight: 800,
                                fontSize: 13.5,
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {selectedProd.name}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                                {selectedProd.barcode && (
                                  <span style={{ fontSize: 10.5, fontFamily: 'monospace', background: '#ffffff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: 4, color: '#475569' }}>
                                    {selectedProd.barcode}
                                  </span>
                                )}
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                  Unit: <strong>{selectedProd.unit || 'pcs'}</strong>
                                </span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, background: '#ffffff', padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                Current Stock
                              </div>
                              <div style={{
                                fontSize: 14,
                                fontWeight: 900,
                                color: (selectedProd.current_stock ?? 0) <= 0 ? '#dc2626' : (selectedProd.current_stock ?? 0) < 5 ? '#d97706' : '#15803d'
                              }}>
                                {formatStockQty(selectedProd.current_stock, selectedProd.unit)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Product Pricing & Reference */}
                      <div className="form-section" style={{ margin: 0 }}>
                        <div className="form-section-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: '#fffbeb',
                              border: '1px solid #fde68a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#d97706'
                            }}>
                              <DollarSign size={15} />
                            </div>
                            <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                              2. Pricing & Reference (මිල හා විස්තර)
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                          <Form.Item
                            name="price"
                            label={
                              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', minHeight: 20 }}>
                                <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>Selling Price</span>
                                {margin !== null && (
                                  <span style={{ fontSize: 10.5, fontWeight: 700, color: margin >= 0 ? '#16a34a' : '#dc2626' }}>
                                    Margin: {margin}%
                                  </span>
                                )}
                              </div>
                            }
                            rules={[
                              { required: true, message: 'Please enter selling price' },
                              {
                                validator: (_, val) => {
                                  if (val === undefined || val === null || val === '') {
                                    return Promise.reject(new Error('Please enter selling price'))
                                  }
                                  if (Number(val) <= 0) {
                                    return Promise.reject(new Error('Selling price must be greater than 0'))
                                  }
                                  if (Number(val) > 10000000) {
                                    return Promise.reject(new Error('Selling price exceeds maximum limit (10,000,000)'))
                                  }
                                  return Promise.resolve()
                                }
                              }
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              min={0.01}
                              step={10}
                              placeholder="e.g. 3500"
                              size="large"
                              style={{ width: '100%', borderRadius: 8, fontWeight: 700, color: 'var(--primary-dark)' }}
                              formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                            />
                          </Form.Item>

                          <Form.Item
                            name="cost_price"
                            label={
                              <div style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 20 }}>
                                <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>Cost Price</span>
                              </div>
                            }
                            rules={[
                              {
                                validator: (_, val) => {
                                  if (val !== undefined && val !== null && val !== '') {
                                    if (Number(val) < 0) {
                                      return Promise.reject(new Error('Cost price cannot be negative'))
                                    }
                                    if (Number(val) > 10000000) {
                                      return Promise.reject(new Error('Cost price exceeds maximum limit (10,000,000)'))
                                    }
                                  }
                                  return Promise.resolve()
                                }
                              }
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              min={0}
                              step={10}
                              placeholder="e.g. 2100"
                              size="large"
                              style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                              formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                            />
                          </Form.Item>
                        </div>

                        {sellP > 0 && costP > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: 8,
                              padding: '8px 12px',
                              marginBottom: 10,
                              fontSize: 12
                            }}
                          >
                            <span style={{ color: '#166534', fontWeight: 600 }}>
                              Estimated Profit: <strong style={{ color: '#15803d', fontWeight: 800 }}>{formatCurrency(profit)}</strong>
                            </span>
                            <span style={{
                              color: (margin !== null && margin >= 0) ? '#15803d' : '#dc2626',
                              fontWeight: 800,
                              background: '#ffffff',
                              border: '1px solid #bbf7d0',
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11
                            }}>
                              Profit Margin: {margin}%
                            </span>
                          </div>
                        )}

                        <Form.Item
                          name="note"
                          label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569' }}>Batch Reference / Note</span>}
                          rules={[
                            { max: 250, message: 'Note cannot exceed 250 characters' }
                          ]}
                          style={{ marginBottom: 6 }}
                        >
                          <Input placeholder="e.g. Morning bake batch, supplier invoice..." size="large" style={{ borderRadius: 8 }} />
                        </Form.Item>

                        <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                          Tip: Updating Selling or Cost Price will also update the catalog.
                        </div>
                      </div>
                    </div>

                    {/* ──── RIGHT COLUMN: Movement Type & Quantity / Value ──── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="form-section" style={{ margin: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#16a34a'
                            }}>
                              <Layers size={15} />
                            </div>
                            <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                              3. Movement & Quantities (තොග ප්‍රමාණය)
                            </span>
                          </div>
                          {isWeight && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Scale size={13} />
                              <span>Weight Item ({selectedProd?.unit || 'kg'})</span>
                            </span>
                          )}
                        </div>

                        {/* Restock Entry Method Switcher */}
                        <div style={{ marginBottom: 14 }}>
                          <Segmented
                            block
                            size="middle"
                            value={movementEntryMode}
                            onChange={(val) => {
                              const newMode = val as 'weight' | 'amount'
                              setMovementEntryMode(newMode)
                              if (newMode === 'amount') {
                                const curVal = form.getFieldValue('stock_value')
                                if (!curVal || Number(curVal) <= 0) {
                                  const effPrice = priceBasis === 'cost' && (form.getFieldValue('cost_price') || selectedProd?.cost_price)
                                    ? Number(form.getFieldValue('cost_price') || selectedProd?.cost_price)
                                    : Number(form.getFieldValue('price') || selectedProd?.price)
                                  const val = Math.round(normalizedChange * effPrice * 100) / 100
                                  if (val > 0) form.setFieldsValue({ stock_value: val })
                                }
                              }
                            }}
                            options={[
                              {
                                label: (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, padding: '3px 0' }}>
                                    <Scale size={15} />
                                    <span>{isWeight ? 'By Weight (බරින්)' : 'By Qty (ප්‍රමාණයෙන්)'}</span>
                                  </div>
                                ),
                                value: 'weight'
                              },
                              {
                                label: (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, color: '#15803d', padding: '3px 0' }}>
                                    <Banknote size={15} />
                                    <span>By Cash (මුදල් ගාණෙන්)</span>
                                  </div>
                                ),
                                value: 'amount'
                              }
                            ]}
                          />
                        </div>

                        {movementEntryMode === 'amount' ? (
                          /* By Cash Mode */
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                              <Form.Item
                                name="type"
                                label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Action Type</span>}
                                initialValue="IN"
                                rules={[{ required: true, message: 'Please select an action type' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select size="large" style={{ borderRadius: 8 }}>
                                  <Select.Option value="IN">
                                    <span style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>+ Stock In</span>
                                  </Select.Option>
                                  <Select.Option value="DAMAGE">
                                    <span style={{ color: 'var(--danger)', fontWeight: 700 }}>- Damage</span>
                                  </Select.Option>
                                  <Select.Option value="RETURN">
                                    <span style={{ color: 'var(--info)', fontWeight: 700 }}>+ Return</span>
                                  </Select.Option>
                                  <Select.Option value="ADJUST">
                                    <span style={{ color: 'var(--warning)', fontWeight: 700 }}>~ Adjust</span>
                                  </Select.Option>
                                </Select>
                              </Form.Item>

                              <div>
                                <Form.Item
                                  name="stock_value"
                                  label={<span style={{ fontWeight: 700, fontSize: 12.5, color: '#15803d' }}>Total Cash (මුදල් - Rs.)</span>}
                                  style={{ marginBottom: 0 }}
                                >
                                  <InputNumber
                                    min={1}
                                    step={100}
                                    placeholder="e.g. 5000"
                                    size="large"
                                    addonBefore={<span style={{ fontWeight: 800, color: '#15803d' }}>Rs.</span>}
                                    style={{ width: '100%', borderRadius: 8, fontWeight: 800, fontSize: 16, color: '#15803d' }}
                                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                                    onChange={(val) => handleMoneyAmountChange(val)}
                                  />
                                </Form.Item>

                                {/* Hidden real values to keep form state valid */}
                                {isWeight && (
                                  <>
                                    <Form.Item name="weight_kg" hidden><Input /></Form.Item>
                                    <Form.Item name="weight_g" hidden><Input /></Form.Item>
                                  </>
                                )}
                                <Form.Item name="quantity" hidden><Input /></Form.Item>
                              </div>
                            </div>

                            {/* Live Calculated Equivalent Badge with Rate Switcher */}
                            <div
                              style={{
                                background: '#f0fdf4',
                                border: '1.5px solid #86efac',
                                borderRadius: 10,
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                marginTop: 4
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle2 size={18} color="#16a34a" />
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#166534' }}>
                                    එකතු වන තොගය (Calculated Stock):
                                  </div>
                                  <div style={{ fontSize: 11, color: '#65a30d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <span>Rate: Rs. {((priceBasis === 'cost' && selectedProd?.cost_price ? selectedProd.cost_price : (selectedProd?.price || 0))).toLocaleString()}/{selectedProd?.unit || 'pcs'}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextBasis = priceBasis === 'selling' ? 'cost' : 'selling'
                                        setPriceBasis(nextBasis)
                                        const curVal = form.getFieldValue('stock_value')
                                        if (curVal) handleMoneyAmountChange(curVal, nextBasis)
                                      }}
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: '#ffffff',
                                        border: '1px solid #86efac',
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        color: '#15803d',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        transition: 'all 0.15s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#dcfce7'
                                        e.currentTarget.style.borderColor = '#4ade80'
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#ffffff'
                                        e.currentTarget.style.borderColor = '#86efac'
                                      }}
                                      title="Toggle rate basis between Selling Price and Cost Price"
                                    >
                                      <span>{priceBasis === 'selling' ? 'Selling Price' : 'Cost Price'} Rate ⇄</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: 18, fontWeight: 900, color: '#15803d' }}>
                                  {isWeight
                                    ? `${kgPart} kg ${gPart} g`
                                    : `${currentQty} ${selectedProd?.unit || 'pcs'}`}
                                </span>
                                {isWeight && (
                                  <div style={{ fontSize: 11, color: '#166534', fontWeight: 700 }}>
                                    ({normalizedChange} {selectedProd?.unit || 'kg'})
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Quick Cash Presets */}
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                Quick Cash Presets
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {[500, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 15000, 20000].map((amt) => (
                                  <span
                                    key={amt}
                                    className="form-quick-chip"
                                    style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 700, padding: '3px 8px' }}
                                    onClick={() => {
                                      form.setFieldsValue({ stock_value: amt })
                                      handleMoneyAmountChange(amt)
                                    }}
                                  >
                                    Rs. {amt >= 1000 ? `${amt / 1000}k` : amt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          /* By Weight / Quantity Mode */
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: isWeight ? '1fr 1.35fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                              <Form.Item
                                name="type"
                                label={
                                  <div style={{ display: 'flex', alignItems: 'center', minHeight: 20 }}>
                                    <span style={{ fontWeight: 700, fontSize: 12.5 }}>Action Type</span>
                                  </div>
                                }
                                initialValue="IN"
                                rules={[{ required: true, message: 'Please select an action type' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select size="large" style={{ borderRadius: 8 }}>
                                  <Select.Option value="IN">
                                    <span style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>+ Stock In / Received</span>
                                  </Select.Option>
                                  <Select.Option value="DAMAGE">
                                    <span style={{ color: 'var(--danger)', fontWeight: 700 }}>- Damage / Wastage</span>
                                  </Select.Option>
                                  <Select.Option value="RETURN">
                                    <span style={{ color: 'var(--info)', fontWeight: 700 }}>+ Customer Return</span>
                                  </Select.Option>
                                  <Select.Option value="ADJUST">
                                    <span style={{ color: 'var(--warning)', fontWeight: 700 }}>~ Count Adjustment</span>
                                  </Select.Option>
                                </Select>
                              </Form.Item>

                              {isWeight ? (
                                /* Dual Weight Input (Kg & Grams) */
                                <div>
                                  <Form.Item
                                    label={
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minHeight: 20 }}>
                                        <span style={{ fontWeight: 700, fontSize: 12.5 }}>Weight (Kg & g)</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                                          = {kgPart} kg {gPart} g ({isBaseGram ? (kgPart * 1000 + gPart) + 'g' : (kgPart + gPart / 1000).toFixed(3) + 'kg'})
                                        </span>
                                      </div>
                                    }
                                    style={{ marginBottom: 0 }}
                                  >
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                      <Form.Item name="weight_kg" initialValue={0} noStyle>
                                        <InputNumber
                                          min={0}
                                          placeholder="0"
                                          addonAfter="kg"
                                          size="large"
                                          style={{ width: '100%', fontWeight: 700 }}
                                          onChange={(val) => {
                                            const k = Number(val) || 0
                                            const g = Number(form.getFieldValue('weight_g')) || 0
                                            const totalKg = k + g / 1000
                                            form.setFieldsValue({ quantity: isBaseGram ? (k * 1000 + g) : totalKg })
                                            updateStockValueFromWeights(k, g)
                                          }}
                                        />
                                      </Form.Item>
                                      <Form.Item name="weight_g" initialValue={500} noStyle>
                                        <InputNumber
                                          min={0}
                                          max={999}
                                          placeholder="0"
                                          addonAfter="g"
                                          size="large"
                                          style={{ width: '100%', fontWeight: 700 }}
                                          onChange={(val) => {
                                            const g = Number(val) || 0
                                            const k = Number(form.getFieldValue('weight_kg')) || 0
                                            const totalKg = k + g / 1000
                                            form.setFieldsValue({ quantity: isBaseGram ? (k * 1000 + g) : totalKg })
                                            updateStockValueFromWeights(k, g)
                                          }}
                                        />
                                      </Form.Item>
                                    </div>
                                  </Form.Item>
                                  {/* Hidden quantity field to keep form state / validation valid */}
                                  <Form.Item name="quantity" hidden initialValue={isBaseGram ? 500 : 0.5}>
                                    <Input />
                                  </Form.Item>
                                </div>
                              ) : (
                                <Form.Item
                                  name="quantity"
                                  label={
                                    <div style={{ display: 'flex', alignItems: 'center', minHeight: 20 }}>
                                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>
                                        Quantity ({selectedProd?.unit || 'pcs'})
                                      </span>
                                    </div>
                                  }
                                  rules={[
                                    { required: true, message: 'Please enter quantity' },
                                    {
                                      validator: (_, val) => {
                                        if (val === undefined || val === null || val === '') {
                                          return Promise.reject(new Error('Please enter quantity'))
                                        }
                                        if (Number(val) <= 0) {
                                          return Promise.reject(new Error('Quantity must be greater than 0'))
                                        }
                                        if (Number(val) > 1000000) {
                                          return Promise.reject(new Error('Quantity exceeds maximum limit (1,000,000)'))
                                        }
                                        return Promise.resolve()
                                      }
                                    }
                                  ]}
                                  initialValue={1}
                                  style={{ marginBottom: 0 }}
                                >
                                  <InputNumber
                                    min={1}
                                    step={1}
                                    size="large"
                                    style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                                    onChange={(val) => updateStockValueFromQty(Number(val) || 0)}
                                  />
                                </Form.Item>
                              )}
                            </div>

                            {/* Live Calculated Value Hint in Weight Mode */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginTop: 4,
                              marginBottom: 8,
                              padding: '6px 12px',
                              background: '#f8fafc',
                              borderRadius: 8,
                              border: '1px dashed #cbd5e1',
                              fontSize: 12
                            }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>
                                Equivalent Money Value:
                              </span>
                              <span style={{ color: '#15803d', fontWeight: 800 }}>
                                Rs. {Math.round(normalizedChange * ((priceBasis === 'cost' && selectedProd?.cost_price ? selectedProd.cost_price : (selectedProd?.price || 0))) * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                <span style={{ color: '#94a3b8', fontWeight: 500, marginLeft: 6 }}>
                                  (@ Rs. {((priceBasis === 'cost' && selectedProd?.cost_price ? selectedProd.cost_price : (selectedProd?.price || 0))).toLocaleString()}/{selectedProd?.unit || 'kg'})
                                </span>
                              </span>
                            </div>

                            {/* Quick Multiplier / Weight Chips */}
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                Quick Presets
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {isWeight ? (
                                  [
                                    { label: '250g', kg: 0, g: 250 },
                                    { label: '500g', kg: 0, g: 500 },
                                    { label: '1 kg', kg: 1, g: 0 },
                                    { label: '1.5 kg', kg: 1, g: 500 },
                                    { label: '2 kg', kg: 2, g: 0 },
                                    { label: '5 kg', kg: 5, g: 0 },
                                    { label: '10 kg', kg: 10, g: 0 },
                                    { label: '25 kg', kg: 25, g: 0 }
                                  ].map((p) => (
                                    <span
                                      key={p.label}
                                      className="form-quick-chip"
                                      onClick={() => {
                                        form.setFieldsValue({
                                          weight_kg: p.kg,
                                          weight_g: p.g,
                                          quantity: isBaseGram ? (p.kg * 1000 + p.g) : (p.kg + p.g / 1000)
                                        })
                                        updateStockValueFromWeights(p.kg, p.g)
                                      }}
                                    >
                                      {p.label}
                                    </span>
                                  ))
                                ) : (
                                  [1, 5, 10, 20, 50, 100].map((q) => (
                                    <span
                                      key={q}
                                      className="form-quick-chip"
                                      onClick={() => {
                                        form.setFieldsValue({ quantity: q })
                                        updateStockValueFromQty(q)
                                      }}
                                    >
                                      {q} pcs
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Live Calculation / Stock Preview Banner */}
                        {selectedProd && (
                          <div style={{
                            marginTop: 'auto',
                            paddingTop: 16
                          }}>
                            <div style={{
                              padding: '14px 18px',
                              borderRadius: 12,
                              background: '#ffffff',
                              border: '1.5px solid #e2e8f0',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12
                            }}>
                              <div>
                                <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Current Balance
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#334155', marginTop: 2 }}>
                                  {formatStockQty(currentStock, selectedProd.unit)}
                                </div>
                              </div>

                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '6px 14px',
                                borderRadius: 99,
                                background: mType === 'DAMAGE' ? '#fef2f2' : '#f0fdf4',
                                border: `1.5px solid ${mType === 'DAMAGE' ? '#fecaca' : '#bbf7d0'}`,
                                color: mType === 'DAMAGE' ? '#dc2626' : '#16a34a',
                                fontWeight: 800,
                                fontSize: 13,
                                whiteSpace: 'nowrap'
                              }}>
                                <span>{mType === 'DAMAGE' ? '−' : mType === 'ADJUST' ? '~' : '+'}</span>
                                <span>{isWeight ? `${kgPart} kg ${gPart} g` : `${currentQty} ${selectedProd.unit || 'pcs'}`}</span>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 10.5, color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Projected Balance (නව තොගය)
                                </div>
                                <div style={{ fontSize: 17, fontWeight: 900, color: '#15803d', marginTop: 2 }}>
                                  {formatStockQty(projectedStock, selectedProd.unit)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }}
            </Form.Item>
          ) : (
            /* NEW ITEM 2-COLUMN LAYOUT */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 16,
              alignItems: 'start'
            }}>
              {/* Left Column: Product Information, SKU, Pricing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-section" style={{ margin: 0 }}>
                  <div className="form-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#2563eb'
                      }}>
                        <Package size={15} />
                      </div>
                      <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                        1. Product Information (අයිතම තොරතුරු)
                      </span>
                    </div>
                  </div>

                  <Form.Item
                    name="new_name"
                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Product Name / Title</span>}
                    rules={[
                      { required: true, message: 'Please enter product name' },
                      { whitespace: true, message: 'Product name cannot be blank spaces' },
                      { min: 2, message: 'Product name must be at least 2 characters' },
                      { max: 100, message: 'Product name cannot exceed 100 characters' }
                    ]}
                    style={{ marginBottom: 12 }}
                  >
                    <Input placeholder="e.g. Blueberry Cheesecake 1kg" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, marginBottom: 12 }}>
                    <Form.Item
                      name="new_category_id"
                      label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Category</span>}
                      rules={[{ required: true, message: 'Please select a category' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        placeholder="Select category"
                        size="large"
                        style={{ borderRadius: 8 }}
                        onChange={handleCategorySelectForNewItem}
                      >
                        {categories.map((c) => (
                          <Select.Option key={c.id} value={c.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{c.name}</span>
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="new_unit"
                      label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Unit</span>}
                      initialValue="pcs"
                      rules={[{ required: true, message: 'Please select a unit' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        size="large"
                        style={{ borderRadius: 8 }}
                        onChange={(val) => {
                          if (val === 'g') setNewProductWeightMode('g')
                          else if (val === 'kg') setNewProductWeightMode('kg')
                        }}
                      >
                        <Select.Option value="pcs">pcs (Pieces)</Select.Option>
                        <Select.Option value="kg">kg (Kilograms)</Select.Option>
                        <Select.Option value="g">g (Grams)</Select.Option>
                        <Select.Option value="slice">slice (Portion)</Select.Option>
                        <Select.Option value="box">box (Pack)</Select.Option>
                      </Select>
                    </Form.Item>
                  </div>

                  {/* Barcode / SKU with Auto Code */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
                    <Form.Item
                      name="new_barcode"
                      label={
                        <span style={{ fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>Item Code / Barcode</span>
                          <span style={{ fontSize: 10, color: 'var(--primary)', background: 'var(--primary-bg)', padding: '1px 6px', borderRadius: 4 }}>
                            Auto by Category
                          </span>
                        </span>
                      }
                      rules={[
                        { required: true, message: 'Please enter or generate item code' },
                        { whitespace: true, message: 'Item code cannot be blank spaces' },
                        { min: 2, message: 'Item code must be at least 2 characters' },
                        { max: 50, message: 'Item code cannot exceed 50 characters' },
                        {
                          pattern: /^[a-zA-Z0-9_\-\.\/]+$/,
                          message: 'Item code can only contain letters, numbers, hyphens, underscores, slashes, or dots'
                        }
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        placeholder="e.g. CK-001, PS-005..."
                        size="large"
                        style={{ borderRadius: 8, fontFamily: 'monospace', fontWeight: 700 }}
                      />
                    </Form.Item>

                    <button
                      type="button"
                      onClick={handleRegenerateNewItemCode}
                      title="Generate Category Code"
                      style={{
                        height: 40,
                        padding: '0 14px',
                        borderRadius: 8,
                        border: '1.5px solid #86efac',
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 1px 2px rgba(22, 163, 74, 0.08)',
                        marginBottom: 0,
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#16a34a'
                        e.currentTarget.style.color = '#ffffff'
                        e.currentTarget.style.borderColor = '#16a34a'
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(22, 163, 74, 0.25)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f0fdf4'
                        e.currentTarget.style.color = '#15803d'
                        e.currentTarget.style.borderColor = '#86efac'
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(22, 163, 74, 0.08)'
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Auto Code</span>
                    </button>
                  </div>
                </div>

                {/* Pricing section for New Item */}
                <div className="form-section" style={{ margin: 0 }}>
                  <div className="form-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#d97706'
                      }}>
                        <DollarSign size={15} />
                      </div>
                      <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                        2. Catalog Pricing (මිල ගණන්)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Form.Item
                      name="new_price"
                      label={<span style={{ fontWeight: 700, fontSize: 12 }}>Selling Price (Rs.)</span>}
                      rules={[
                        { required: true, message: 'Please enter selling price' },
                        {
                          validator: (_, val) => {
                            if (val === undefined || val === null || val === '') {
                              return Promise.reject(new Error('Please enter selling price'))
                            }
                            if (Number(val) <= 0) {
                              return Promise.reject(new Error('Must be greater than 0'))
                            }
                            if (Number(val) > 10000000) {
                              return Promise.reject(new Error('Exceeds 10,000,000 limit'))
                            }
                            return Promise.resolve()
                          }
                        }
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber
                        min={0.01}
                        size="large"
                        style={{ width: '100%', borderRadius: 8, fontWeight: 700, color: 'var(--primary-dark)' }}
                        formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                      />
                    </Form.Item>

                    <Form.Item
                      name="new_cost_price"
                      label={<span style={{ fontWeight: 700, fontSize: 12 }}>Cost Price (Rs.)</span>}
                      rules={[
                        {
                          validator: (_, val) => {
                            if (val !== undefined && val !== null && val !== '') {
                              if (Number(val) < 0) {
                                return Promise.reject(new Error('Cost price cannot be negative'))
                              }
                              if (Number(val) > 10000000) {
                                return Promise.reject(new Error('Exceeds limit'))
                              }
                            }
                            return Promise.resolve()
                          }
                        }
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber
                        min={0}
                        size="large"
                        style={{ width: '100%', borderRadius: 8 }}
                        formatter={(v) => `Rs. ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                      />
                    </Form.Item>
                  </div>
                </div>

                {/* Product Image Selection & Custom Upload */}
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) =>
                    prev.new_name !== cur.new_name ||
                    prev.new_category_id !== cur.new_category_id ||
                    prev.new_image_path !== cur.new_image_path
                  }
                >
                  {({ getFieldValue, setFieldsValue }) => {
                    const currentName = getFieldValue('new_name') || ''
                    const currentCatId = getFieldValue('new_category_id')
                    const selectedCat = categories.find((c) => c.id === currentCatId)
                    const currentImagePath = getFieldValue('new_image_path')

                    return (
                      <>
                        <ProductImagePicker
                          value={currentImagePath}
                          onChange={(newPath) => setFieldsValue({ new_image_path: newPath })}
                          productName={currentName}
                          categoryName={selectedCat?.name}
                        />
                        <Form.Item name="new_image_path" noStyle>
                          <Input type="hidden" />
                        </Form.Item>
                      </>
                    )
                  }}
                </Form.Item>
              </div>

              {/* Right Column: Initial Stock & Inward Batch */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-section" style={{ margin: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div className="form-section-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#16a34a'
                      }}>
                        <Layers size={15} />
                      </div>
                      <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                        3. Initial Stock & Inward Batch
                      </span>
                    </div>
                  </div>

                  <Form.Item noStyle shouldUpdate={(prev, cur) => prev.new_unit !== cur.new_unit || prev.new_quantity !== cur.new_quantity || prev.new_price !== cur.new_price || prev.new_cost_price !== cur.new_cost_price}>
                    {({ getFieldValue }) => {
                      const chosenUnit = getFieldValue('new_unit') || 'pcs'
                      const isNewWeight = chosenUnit === 'kg' || chosenUnit === 'g'
                      const isBaseGram = chosenUnit === 'g'
                      const kgPart = Number(getFieldValue('new_weight_kg')) || 0
                      const gPart = Number(getFieldValue('new_weight_g')) || 0
                      const currentQty = Number(getFieldValue('new_quantity')) || 0
                      const normalizedNewStock = isNewWeight ? (isBaseGram ? (kgPart * 1000 + gPart) : (kgPart + gPart / 1000)) : currentQty
                      const sellP = Number(getFieldValue('new_price')) || 0
                      const costP = Number(getFieldValue('new_cost_price')) || 0
                      const unitPrice = sellP > 0 ? sellP : (costP > 0 ? costP : 0)

                      return (
                        <div>
                          {/* Segmented Switcher for New Item */}
                          <div style={{ marginBottom: 14 }}>
                            <Segmented
                              block
                              size="middle"
                              value={newProductEntryMode}
                              onChange={(val) => setNewProductEntryMode(val as 'weight' | 'amount')}
                              options={[
                                {
                                  label: (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, padding: '3px 0' }}>
                                      <Scale size={15} />
                                      <span>{isNewWeight ? 'By Weight (බරින්)' : 'By Qty (ප්‍රමාණයෙන්)'}</span>
                                    </div>
                                  ),
                                  value: 'weight'
                                },
                                {
                                  label: (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, color: '#15803d', padding: '3px 0' }}>
                                      <Banknote size={15} />
                                      <span>By Cash (මුදල් ගාණෙන්)</span>
                                    </div>
                                  ),
                                  value: 'amount'
                                }
                              ]}
                            />
                          </div>

                          {newProductEntryMode === 'amount' ? (
                            <div>
                              <div style={{ marginBottom: 10 }}>
                                <Form.Item
                                  name="new_stock_value"
                                  label={<span style={{ fontWeight: 700, fontSize: 12.5, color: '#15803d' }}>Initial Stock Value (මුදල් ගාණ - Rs.)</span>}
                                  style={{ marginBottom: 0 }}
                                >
                                  <InputNumber
                                    min={1}
                                    step={100}
                                    placeholder="e.g. 5000"
                                    size="large"
                                    addonBefore={<span style={{ fontWeight: 800, color: '#15803d' }}>Rs.</span>}
                                    style={{ width: '100%', borderRadius: 8, fontWeight: 800, color: '#15803d' }}
                                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                                    onChange={handleNewProductMoneyAmountChange}
                                  />
                                </Form.Item>

                                {/* Hidden real values */}
                                {isNewWeight && (
                                  <>
                                    <Form.Item name="new_weight_kg" hidden><Input /></Form.Item>
                                    <Form.Item name="new_weight_g" hidden><Input /></Form.Item>
                                  </>
                                )}
                                <Form.Item name="new_quantity" hidden><Input /></Form.Item>
                              </div>

                              {/* Live Calculated Equivalent Badge */}
                              <div
                                style={{
                                  background: '#f0fdf4',
                                  border: '1.5px solid #86efac',
                                  borderRadius: 10,
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  marginTop: 6
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <CheckCircle2 size={18} color="#16a34a" />
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: '#166534' }}>
                                      ගණනය වූ තොගය (Calculated Stock):
                                    </div>
                                    <div style={{ fontSize: 10.5, color: '#65a30d', fontWeight: 600 }}>
                                      @ Rs. {unitPrice.toLocaleString()}/{chosenUnit}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: 16, fontWeight: 900, color: '#15803d' }}>
                                    {isNewWeight
                                      ? `${kgPart} kg ${gPart} g (${normalizedNewStock} ${chosenUnit})`
                                      : `${currentQty} ${chosenUnit}`}
                                  </span>
                                </div>
                              </div>

                              {/* Quick Presets */}
                              <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                  Quick Amounts
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {[1000, 2000, 2500, 5000, 7500, 10000, 20000].map((amt) => (
                                    <span
                                      key={amt}
                                      className="form-quick-chip"
                                      style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 700, padding: '3px 8px' }}
                                      onClick={() => {
                                        form.setFieldsValue({ new_stock_value: amt })
                                        handleNewProductMoneyAmountChange(amt)
                                      }}
                                    >
                                      Rs. {amt >= 1000 ? `${amt / 1000}k` : amt}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {isNewWeight ? (
                                <div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    <Form.Item
                                      name="new_weight_kg"
                                      label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Weight (kg)</span>}
                                      initialValue={1}
                                      rules={[
                                        {
                                          validator: (_, val) => {
                                            if (val !== undefined && val !== null && val !== '') {
                                              if (Number(val) < 0) return Promise.reject(new Error('kg cannot be negative'))
                                              if (Number(val) > 10000) return Promise.reject(new Error('kg too large'))
                                            }
                                            return Promise.resolve()
                                          }
                                        }
                                      ]}
                                      style={{ marginBottom: 0 }}
                                    >
                                      <InputNumber
                                        min={0}
                                        step={1}
                                        placeholder="0"
                                        size="large"
                                        addonAfter="kg"
                                        style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                                        onChange={(val) => {
                                          const k = Number(val) || 0
                                          const g = Number(form.getFieldValue('new_weight_g')) || 0
                                          const isBaseGram = chosenUnit === 'g'
                                          form.setFieldsValue({ new_quantity: isBaseGram ? (k * 1000 + g) : (k + g / 1000) })
                                        }}
                                      />
                                    </Form.Item>

                                    <Form.Item
                                      name="new_weight_g"
                                      label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Weight (g)</span>}
                                      initialValue={0}
                                      rules={[
                                        {
                                          validator: (_, val) => {
                                            if (val !== undefined && val !== null && val !== '') {
                                              if (Number(val) < 0) return Promise.reject(new Error('g cannot be negative'))
                                              if (Number(val) >= 1000) return Promise.reject(new Error('g must be < 1000'))
                                            }
                                            return Promise.resolve()
                                          }
                                        }
                                      ]}
                                      style={{ marginBottom: 0 }}
                                    >
                                      <InputNumber
                                        min={0}
                                        max={999}
                                        step={50}
                                        placeholder="0"
                                        size="large"
                                        addonAfter="g"
                                        style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                                        onChange={(val) => {
                                          const g = Number(val) || 0
                                          const k = Number(form.getFieldValue('new_weight_kg')) || 0
                                          const isBaseGram = chosenUnit === 'g'
                                          form.setFieldsValue({ new_quantity: isBaseGram ? (k * 1000 + g) : (k + g / 1000) })
                                        }}
                                      />
                                    </Form.Item>
                                  </div>

                                  <Form.Item name="new_quantity" hidden initialValue={chosenUnit === 'g' ? 1000 : 1}>
                                    <Input />
                                  </Form.Item>

                                  {/* Quick Chips for New Product Weight */}
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                      Presets
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      {[
                                        { label: '250g', kg: 0, g: 250 },
                                        { label: '500g', kg: 0, g: 500 },
                                        { label: '1 kg', kg: 1, g: 0 },
                                        { label: '1.5 kg', kg: 1, g: 500 },
                                        { label: '2 kg', kg: 2, g: 0 },
                                        { label: '5 kg', kg: 5, g: 0 },
                                        { label: '10 kg', kg: 10, g: 0 },
                                        { label: '25 kg', kg: 25, g: 0 }
                                      ].map((p) => (
                                        <span
                                          key={p.label}
                                          className="form-quick-chip"
                                          style={{ padding: '3px 8px' }}
                                          onClick={() => {
                                            form.setFieldsValue({
                                              new_weight_kg: p.kg,
                                              new_weight_g: p.g,
                                              new_quantity: chosenUnit === 'g' ? (p.kg * 1000 + p.g) : (p.kg + p.g / 1000)
                                            })
                                          }}
                                        >
                                          {p.label}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Form.Item
                                    name="new_quantity"
                                    label={<span style={{ fontWeight: 700, fontSize: 12.5 }}>Initial Stock ({chosenUnit})</span>}
                                    rules={[
                                      { required: true, message: 'Please enter initial stock quantity' },
                                      {
                                        validator: (_, val) => {
                                          if (val === undefined || val === null || val === '') {
                                            return Promise.reject(new Error('Please enter initial stock quantity'))
                                          }
                                          if (Number(val) < 0) {
                                            return Promise.reject(new Error('Stock quantity cannot be negative'))
                                          }
                                          if (Number(val) > 1000000) {
                                            return Promise.reject(new Error('Stock quantity exceeds maximum limit (1,000,000)'))
                                          }
                                          return Promise.resolve()
                                        }
                                      }
                                    ]}
                                    initialValue={10}
                                    style={{ marginBottom: 0 }}
                                  >
                                    <InputNumber
                                      min={0}
                                      step={1}
                                      size="large"
                                      style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
                                    />
                                  </Form.Item>

                                  {/* Quick Chips for Non-Weight Items */}
                                  <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                      Presets
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      {[5, 10, 20, 50, 100].map((q) => (
                                        <span
                                          key={q}
                                          className="form-quick-chip"
                                          style={{ padding: '3px 8px' }}
                                          onClick={() => form.setFieldsValue({ new_quantity: q })}
                                        >
                                          {q} pcs
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          <Form.Item
                            name="new_note"
                            label={<span style={{ fontWeight: 600, fontSize: 12, color: '#475569', marginTop: 12, display: 'inline-block' }}>Note / Supplier Info</span>}
                            rules={[{ max: 250, message: 'Note cannot exceed 250 characters' }]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input placeholder="e.g. Initial supplier batch" size="large" style={{ borderRadius: 8 }} />
                          </Form.Item>
                        </div>
                      )
                    }}
                  </Form.Item>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* STEP 2: SUPPLIER, TOTAL STOCK VALUE & STORE EXPENSE DETAILS */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <div style={{ display: modalStep === 1 ? 'block' : 'none' }}>
            <Form.Item
              noStyle
              shouldUpdate={(prev, cur) =>
                prev.product_id !== cur.product_id ||
                prev.quantity !== cur.quantity ||
                prev.weight_kg !== cur.weight_kg ||
                prev.weight_g !== cur.weight_g ||
                prev.cost_price !== cur.cost_price ||
                prev.price !== cur.price ||
                prev.new_name !== cur.new_name ||
                prev.new_quantity !== cur.new_quantity ||
                prev.new_weight_kg !== cur.new_weight_kg ||
                prev.new_weight_g !== cur.new_weight_g ||
                prev.new_cost_price !== cur.new_cost_price ||
                prev.new_unit !== cur.new_unit ||
                prev.supplier_id !== cur.supplier_id ||
                prev.total_stock_cost !== cur.total_stock_cost
              }
            >
              {({ getFieldValue, setFieldsValue }) => {
                let targetName = ''
                let targetUnit = 'pcs'
                let targetQty = 0
                let targetCostPrice = 0

                if (entryMode === 'EXISTING') {
                  const pId = getFieldValue('product_id')
                  const selProd = tracked.find((p) => p.id === pId)
                  targetName = selProd?.name || 'Selected Item'
                  targetUnit = selProd?.unit || 'pcs'
                  const isWeight = targetUnit.toLowerCase() === 'kg' || targetUnit.toLowerCase() === 'g'
                  const isBaseGram = targetUnit.toLowerCase() === 'g'

                  const kg = Number(getFieldValue('weight_kg')) || 0
                  const g = Number(getFieldValue('weight_g')) || 0
                  const rawQty = Number(getFieldValue('quantity')) || 0
                  targetQty = isWeight ? (isBaseGram ? (kg * 1000 + g) : (kg + g / 1000)) : rawQty
                  targetCostPrice = Number(getFieldValue('cost_price')) || selProd?.cost_price || 0
                } else {
                  targetName = getFieldValue('new_name') || 'New Item'
                  targetUnit = getFieldValue('new_unit') || 'pcs'
                  const isNewWeight = targetUnit.toLowerCase() === 'kg' || targetUnit.toLowerCase() === 'g'
                  const isNewBaseGram = targetUnit.toLowerCase() === 'g'

                  const kg = Number(getFieldValue('new_weight_kg')) || 0
                  const g = Number(getFieldValue('new_weight_g')) || 0
                  const rawQty = Number(getFieldValue('new_quantity')) || 0
                  targetQty = isNewWeight ? (isNewBaseGram ? (kg * 1000 + g) : (kg + g / 1000)) : rawQty
                  targetCostPrice = Number(getFieldValue('new_cost_price')) || 0
                }

                const computedAutoCost = Math.round(targetQty * targetCostPrice * 100) / 100
                const enteredTotalCost = Number(getFieldValue('total_stock_cost')) || 0
                const isAuto = enteredTotalCost === 0 || Math.abs(enteredTotalCost - computedAutoCost) < 0.01

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Item Summary Banner */}
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: 14,
                        padding: '16px 20px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: '#eff6ff',
                            border: '1.5px solid #bfdbfe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563eb',
                            flexShrink: 0
                          }}
                        >
                          <Package size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                            {targetName}
                          </div>
                          <div style={{ fontSize: 12.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                            <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 8px', borderRadius: 6, fontWeight: 800 }}>
                              Receiving: +{formatStockQty(targetQty, targetUnit)}
                            </span>
                            <span>·</span>
                            <span>
                              Unit Cost: <strong style={{ color: '#0f172a' }}>Rs. {targetCostPrice.toLocaleString()} / {targetUnit}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', background: '#f8fafc', padding: '8px 16px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Auto-Calculated Value
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(computedAutoCost)}
                        </div>
                      </div>
                    </div>

                    {/* 2 Columns: Supplier details & Cost / Expense details */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                        gap: 16,
                        alignItems: 'start'
                      }}
                    >
                      {/* Left: Supplier & Invoice */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="form-section" style={{ margin: 0 }}>
                          <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#059669'
                              }}>
                                <Truck size={15} />
                              </div>
                              <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                                1. Supplier & Billing (සැපයුම්කරු හා බිල්පත්)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsAddSupplierModalOpen(true)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: '#059669',
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                padding: '4px 10px',
                                borderRadius: 7,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(5, 150, 105, 0.08)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#059669'
                                e.currentTarget.style.color = '#ffffff'
                                e.currentTarget.style.borderColor = '#059669'
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(5, 150, 105, 0.25)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ecfdf5'
                                e.currentTarget.style.color = '#059669'
                                e.currentTarget.style.borderColor = '#a7f3d0'
                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(5, 150, 105, 0.08)'
                              }}
                            >
                              <PlusCircle size={13} />
                              <span>+ New Supplier</span>
                            </button>
                          </div>

                          <Form.Item
                            name="supplier_id"
                            label={<span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>Select Supplier (අදාල සැපයුම්කරු තෝරන්න)</span>}
                            rules={[{ required: true, message: 'Please select a supplier for this stock' }]}
                            style={{ marginBottom: 12 }}
                          >
                            <Select
                              placeholder="Choose or search supplier..."
                              showSearch
                              size="large"
                              style={{ width: '100%', borderRadius: 8 }}
                              optionFilterProp="label"
                              onChange={(val) => {
                                const s = suppliers.find((sup) => sup.id === val)
                                if (s) setFieldsValue({ supplier_name: s.name })
                              }}
                              options={suppliers.map((s) => ({
                                value: s.id,
                                label: `${s.name}${s.phone ? ` (${s.phone})` : ''}${s.contactPerson ? ` · ${s.contactPerson}` : ''}`
                              }))}
                            />
                          </Form.Item>

                          <Form.Item name="supplier_name" hidden><Input /></Form.Item>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <Form.Item
                              name="invoice_no"
                              label={<span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>Bill / Invoice No</span>}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder="e.g. INV-2026-901" size="large" style={{ borderRadius: 8 }} />
                            </Form.Item>

                            <Form.Item
                              name="payment_method"
                              label={<span style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>Payment Method</span>}
                              initialValue="CASH"
                              style={{ marginBottom: 0 }}
                            >
                              <Select size="large" style={{ borderRadius: 8 }}>
                                <Select.Option value="CASH">
                                  <span style={{ fontWeight: 700, color: '#16a34a' }}>Cash Drawer (මුදල්)</span>
                                </Select.Option>
                                <Select.Option value="BANK">
                                  <span style={{ fontWeight: 700, color: '#2563eb' }}>Bank Transfer (බැංකු)</span>
                                </Select.Option>
                                <Select.Option value="CREDIT">
                                  <span style={{ fontWeight: 700, color: '#d97706' }}>Credit / Pay Later (ණයට)</span>
                                </Select.Option>
                              </Select>
                            </Form.Item>
                          </div>
                        </div>
                      </div>

                      {/* Right: Total Cost & Owner Visibility */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="form-section" style={{ margin: 0 }}>
                          <div className="form-section-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#16a34a'
                              }}>
                                <Banknote size={15} />
                              </div>
                              <span className="form-section-title" style={{ color: '#0f172a', fontSize: 12.5 }}>
                                2. Stock Total Value & Expense (තොගයේ වටිනාකම)
                              </span>
                            </div>
                          </div>

                          <Form.Item
                            name="total_stock_cost"
                            label={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                                  Total Stock Amount (සම්පූර්ණ මුදල - Rs.)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setFieldsValue({ total_stock_cost: computedAutoCost })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#2563eb',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    padding: '3px 10px',
                                    borderRadius: 7,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.08)'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#2563eb'
                                    e.currentTarget.style.color = '#ffffff'
                                    e.currentTarget.style.borderColor = '#2563eb'
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.25)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#eff6ff'
                                    e.currentTarget.style.color = '#2563eb'
                                    e.currentTarget.style.borderColor = '#bfdbfe'
                                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(37, 99, 235, 0.08)'
                                  }}
                                  title="Reset to automatically calculated cost"
                                >
                                  <RotateCcw size={12} />
                                  <span>Reset to Auto (Rs. {computedAutoCost.toLocaleString()})</span>
                                </button>
                              </div>
                            }
                            rules={[
                              { required: true, message: 'Please enter total stock value' },
                              {
                                validator: (_, val) => {
                                  if (val !== undefined && val !== null && Number(val) < 0) {
                                    return Promise.reject(new Error('Total amount cannot be negative'))
                                  }
                                  return Promise.resolve()
                                }
                              }
                            ]}
                            style={{ marginBottom: 10 }}
                          >
                            <InputNumber
                              min={0}
                              step={100}
                              placeholder="e.g. 15000"
                              size="large"
                              addonBefore={<span style={{ fontWeight: 800, color: '#15803d' }}>Rs.</span>}
                              style={{ width: '100%', borderRadius: 8, fontWeight: 800, fontSize: 16, color: '#15803d' }}
                              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(v) => v!.replace(/Rs\.\s?|(,*)/g, '') as any}
                            />
                          </Form.Item>

                          {/* Live Status indicator */}
                          <div
                            style={{
                              background: isAuto ? '#f0fdf4' : '#fffbeb',
                              border: `1.5px solid ${isAuto ? '#86efac' : '#fde68a'}`,
                              borderRadius: 10,
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              marginBottom: 12
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CheckCircle2 size={16} color={isAuto ? '#16a34a' : '#d97706'} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: isAuto ? '#166534' : '#92400e' }}>
                                  {isAuto
                                    ? 'Auto-Calculated Value (ස්වයංක්‍රීයව ගණනය වූ අගය)'
                                    : 'Manual Amount Override (වෙනස් කළ මුදල)'}
                                </div>
                                <div style={{ fontSize: 11, color: isAuto ? '#15803d' : '#b45309', marginTop: 1 }}>
                                  {isAuto
                                    ? `${targetQty} ${targetUnit} × Rs. ${targetCostPrice.toLocaleString()} / ${targetUnit}`
                                    : `Effective Rate: Rs. ${(targetQty > 0 ? (enteredTotalCost / targetQty) : 0).toFixed(2)} / ${targetUnit}`}
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: 15, fontWeight: 900, color: isAuto ? '#15803d' : '#b45309' }}>
                              Rs. {enteredTotalCost.toLocaleString()}
                            </span>
                          </div>

                          {/* Owner Visibility Switch */}
                          <div
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 10,
                              padding: '12px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a' }}>
                                Record as Store Expense for Owner Visibility
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 1.35 }}>
                                මෙම මුදල Owner Hub සහ Store Expenses ලේඛනයට "Stock Purchase" ලෙස ඇතුලත් වේ.
                              </div>
                            </div>
                            <Form.Item name="record_expense" valuePropName="checked" noStyle initialValue={true}>
                              <Switch defaultChecked />
                            </Form.Item>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }}
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Add Supplier Modal */}
      <AddSupplierModal
        open={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        onSuccess={(newSup) => {
          setSuppliers((prev) => [...prev, newSup])
          form.setFieldsValue({
            supplier_id: newSup.id,
            supplier_name: newSup.name
          })
        }}
      />
    </div>
  )
}
