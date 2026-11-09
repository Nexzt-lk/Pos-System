import { Product, Category } from '../types/product'

/**
 * Returns a clean 2-3 letter uppercase prefix for a category name
 * e.g. "Signature Cakes" -> "CK"
 * e.g. "Pastries & Savories" -> "PS"
 * e.g. "Desserts & Cupcakes" -> "DS"
 * e.g. "Beverages & Coffee" -> "BV"
 */
export const getCategoryPrefix = (categoryName?: string): string => {
  if (!categoryName) return 'ITM'
  const clean = categoryName.trim().toLowerCase()

  if (clean.includes('cake') || clean.includes('gateau')) return 'CK'
  if (clean.includes('pastr') || clean.includes('savor') || clean.includes('bun') || clean.includes('roll') || clean.includes('patty')) return 'PS'
  if (clean.includes('dessert') || clean.includes('sweet') || clean.includes('cupcake') || clean.includes('pudding') || clean.includes('eclair')) return 'DS'
  if (clean.includes('beverage') || clean.includes('coffee') || clean.includes('tea') || clean.includes('drink') || clean.includes('juice')) return 'BV'
  if (clean.includes('bread') || clean.includes('toast') || clean.includes('loaf')) return 'BR'
  if (clean.includes('cookie') || clean.includes('biscuit')) return 'CK'
  if (clean.includes('ingredient') || clean.includes('raw') || clean.includes('material')) return 'RM'

  // If multi-word category (e.g. "Hot Kitchen" -> "HK")
  const words = categoryName.trim().split(/[\s&/_-]+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }

  // Fallback to first 3 letters
  return categoryName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM'
}

/**
 * Auto-generates a unique SKU / Barcode based on the selected category and existing items.
 * Example:
 * - Category "Signature Cakes" -> "CK-001", "CK-002", "CK-003"...
 * - Category "Pastries & Savories" -> "PS-001", "PS-002"...
 */
export const generateCategoryItemCode = (
  category?: Category | { id?: string; name?: string } | null,
  existingProducts: Product[] = []
): string => {
  const prefix = getCategoryPrefix(category?.name)
  
  // Count how many products belong to this category or have this prefix
  const categoryProducts = existingProducts.filter(
    (p) => (category?.id && p.category_id === category.id) || (p.barcode && p.barcode.startsWith(prefix))
  )

  let nextSeq = categoryProducts.length + 1
  let generatedCode = `${prefix}-${nextSeq.toString().padStart(3, '0')}`

  // Ensure collision-proof code against all existing barcodes in system
  const allExistingCodes = new Set(existingProducts.map((p) => p.barcode?.trim().toUpperCase()).filter(Boolean))
  while (allExistingCodes.has(generatedCode.toUpperCase())) {
    nextSeq++
    generatedCode = `${prefix}-${nextSeq.toString().padStart(3, '0')}`
  }

  return generatedCode
}
