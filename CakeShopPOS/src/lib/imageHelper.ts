/**
 * Bakery Product Image Presets & Auto-Matching Engine
 */

export interface ImagePreset {
  id: string
  name: string
  path: string
  keywords: string[]
  categories: string[]
}

export const BAKERY_IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'chocolate_cake',
    name: 'Chocolate Fudge Cake',
    path: '/images/products/chocolate_cake.jpg',
    keywords: ['chocolate', 'choco', 'fudge', 'dark chocolate', 'gateau', 'torte', 'ganache', 'brownie'],
    categories: ['Cakes', 'Desserts']
  },
  {
    id: 'black_forest',
    name: 'Black Forest Cake',
    path: '/images/products/black_forest.jpg',
    keywords: ['black forest', 'forest', 'cherry', 'kirsch', 'schwarzwald'],
    categories: ['Cakes']
  },
  {
    id: 'red_velvet',
    name: 'Red Velvet Cake',
    path: '/images/products/red_velvet.jpg',
    keywords: ['red velvet', 'velvet', 'heart cake', 'cream cheese'],
    categories: ['Cakes']
  },
  {
    id: 'strawberry_cheesecake',
    name: 'Strawberry Cheesecake',
    path: '/images/products/strawberry_cheesecake.jpg',
    keywords: ['cheesecake', 'strawberry', 'berry', 'blueberry', 'fruit cake', 'cheese', 'raspberry'],
    categories: ['Cakes', 'Desserts']
  },
  {
    id: 'ribbon_butter',
    name: 'Butter & Ribbon Cake',
    path: '/images/products/ribbon_butter.jpg',
    keywords: ['ribbon', 'butter', 'vanilla', 'sponge', 'rainbow', 'birthday', 'celebration', 'bento', 'wedding'],
    categories: ['Cakes']
  },
  {
    id: 'choco_fudge_cupcake',
    name: 'Cupcake & Muffin',
    path: '/images/products/choco_fudge_cupcake.jpg',
    keywords: ['cupcake', 'muffin', 'fairy cake', 'mini cake'],
    categories: ['Cupcakes', 'Desserts', 'Pastries']
  },
  {
    id: 'vanilla_eclair',
    name: 'Vanilla Eclair & Pastry',
    path: '/images/products/vanilla_eclair.jpg',
    keywords: ['eclair', 'pastry', 'choux', 'profiterole', 'cream puff', 'slice', 'gateau slice'],
    categories: ['Pastries', 'Desserts']
  },
  {
    id: 'savoury_pastries',
    name: 'Savoury Patties & Rolls',
    path: '/images/products/savoury_pastries.jpg',
    keywords: ['patties', 'patty', 'roll', 'rolls', 'egg roll', 'chinese roll', 'cutlet', 'samosa', 'savoury', 'pastry'],
    categories: ['Savouries', 'Short Eats']
  },
  {
    id: 'fish_bun',
    name: 'Bakery Buns & Bread',
    path: '/images/products/fish_bun.jpg',
    keywords: ['fish bun', 'bun', 'buns', 'seeni sambal', 'egg bun', 'bread', 'roast paan', 'loaf', 'croissant'],
    categories: ['Buns', 'Breads', 'Savouries', 'Short Eats']
  },
  {
    id: 'spicy_chicken',
    name: 'Chicken Bun & Snacks',
    path: '/images/products/spicy_chicken.jpg',
    keywords: ['chicken', 'spicy', 'burger', 'sandwich', 'submarine', 'pizza', 'hot dog'],
    categories: ['Savouries', 'Short Eats', 'Snacks']
  },
  {
    id: 'iced_caramel_latte',
    name: 'Coffee & Cold Drinks',
    path: '/images/products/iced_caramel_latte.jpg',
    keywords: ['coffee', 'latte', 'tea', 'iced', 'caramel', 'mocha', 'frappe', 'juice', 'mojito', 'beverage', 'drink', 'shake', 'smoothie', 'faluda'],
    categories: ['Beverages', 'Coffee', 'Tea', 'Drinks']
  }
]

/**
 * Automatically detects and returns the most suitable bakery image path
 * based on product name keywords and category.
 */
export const getAutoMatchedProductImage = (productName?: string, categoryName?: string): string => {
  const pName = (productName || '').toLowerCase().trim()
  const cName = (categoryName || '').toLowerCase().trim()

  if (!pName && !cName) {
    return BAKERY_IMAGE_PRESETS[0].path // Default to chocolate cake
  }

  // 1. Direct keyword match in product name (weighted score)
  let bestPreset: ImagePreset | null = null
  let maxScore = 0

  for (const preset of BAKERY_IMAGE_PRESETS) {
    let score = 0

    // Check keywords in product name
    for (const kw of preset.keywords) {
      if (pName.includes(kw)) {
        score += kw.length * 2 // Longer specific keywords have higher priority
      }
    }

    // Check category match
    for (const cat of preset.categories) {
      if (cName.includes(cat.toLowerCase())) {
        score += 5
      }
    }

    if (score > maxScore) {
      maxScore = score
      bestPreset = preset
    }
  }

  if (bestPreset && maxScore > 0) {
    return bestPreset.path
  }

  // 2. Category-based fallback
  if (cName.includes('cake')) return '/images/products/chocolate_cake.jpg'
  if (cName.includes('pastr')) return '/images/products/vanilla_eclair.jpg'
  if (cName.includes('savour') || cName.includes('short')) return '/images/products/savoury_pastries.jpg'
  if (cName.includes('bun') || cName.includes('bread')) return '/images/products/fish_bun.jpg'
  if (cName.includes('cupcake')) return '/images/products/choco_fudge_cupcake.jpg'
  if (cName.includes('drink') || cName.includes('bever') || cName.includes('coffee') || cName.includes('tea')) {
    return '/images/products/iced_caramel_latte.jpg'
  }

  return '/images/products/chocolate_cake.jpg'
}

/**
 * Resolves product image paths for Electron, Web Dev Server, and Production bundle.
 * If path is missing or invalid, automatically falls back to smart matching.
 */
export const getProductImageSrc = (
  path?: string,
  productName?: string,
  categoryName?: string
): string | null => {
  let targetPath = path

  // Auto-match if no path is provided
  if (!targetPath || targetPath === '' || targetPath === 'default' || targetPath === 'none') {
    if (productName || categoryName) {
      targetPath = getAutoMatchedProductImage(productName, categoryName)
    } else {
      return null
    }
  }

  // Remote URLs or Data URIs
  if (targetPath.startsWith('http://') || targetPath.startsWith('https://') || targetPath.startsWith('data:')) {
    return targetPath
  }

  // Clean leading slash
  const cleanPath = targetPath.startsWith('/') ? targetPath.slice(1) : targetPath

  // Running inside Electron desktop environment
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return `app-images:///${cleanPath}`
  }

  // Running inside browser / Vite dev server
  if (cleanPath.startsWith('images/')) {
    return `/${cleanPath}`
  }
  return `/images/${cleanPath}`
}
