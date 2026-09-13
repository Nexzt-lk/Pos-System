/**
 * Bakery Product Image Presets & Auto-Matching Engine
 * Categorized specifically for Wasana Cake POS (8 core categories)
 */

export interface ImagePreset {
  id: string
  name: string
  path: string
  keywords: string[]
  categories: string[]
  categoryKey: string
}

export const BAKERY_IMAGE_PRESETS: ImagePreset[] = [
  // ── 1. Cakes & Gateaux (කේක් වර්ග) ──
  {
    id: 'chocolate_cake',
    name: 'Chocolate Fudge Cake',
    path: '/images/products/chocolate_cake.jpg',
    keywords: ['chocolate', 'choco', 'fudge', 'dark chocolate', 'gateau', 'torte', 'ganache', 'brownie'],
    categories: ['Cakes & Gateaux', 'Cakes', 'Desserts'],
    categoryKey: 'cakes'
  },
  {
    id: 'black_forest',
    name: 'Black Forest Cake',
    path: '/images/products/black_forest.jpg',
    keywords: ['black forest', 'forest', 'cherry', 'kirsch', 'schwarzwald'],
    categories: ['Cakes & Gateaux', 'Cakes'],
    categoryKey: 'cakes'
  },
  {
    id: 'red_velvet',
    name: 'Red Velvet Gateau',
    path: '/images/products/red_velvet.jpg',
    keywords: ['red velvet', 'velvet', 'heart cake', 'cream cheese'],
    categories: ['Cakes & Gateaux', 'Cakes'],
    categoryKey: 'cakes'
  },
  {
    id: 'ribbon_butter',
    name: 'Butter & Ribbon Cake',
    path: '/images/products/ribbon_butter.jpg',
    keywords: ['ribbon', 'butter', 'vanilla', 'sponge', 'rainbow', 'birthday', 'celebration', 'bento', 'wedding'],
    categories: ['Cakes & Gateaux', 'Cakes'],
    categoryKey: 'cakes'
  },
  {
    id: 'strawberry_cheesecake',
    name: 'Strawberry Cheesecake',
    path: '/images/products/strawberry_cheesecake.jpg',
    keywords: ['cheesecake', 'strawberry', 'berry', 'blueberry', 'fruit cake', 'cheese', 'raspberry'],
    categories: ['Cakes & Gateaux', 'Sweet Items & Desserts', 'Desserts'],
    categoryKey: 'cakes'
  },

  // ── 2. Pastries & Savories (පැටිස්, රෝල්ස්, පැස්ට්‍රි) ──
  {
    id: 'savoury_pastries',
    name: 'Savoury Patties & Rolls',
    path: '/images/products/savoury_pastries.jpg',
    keywords: ['patties', 'patty', 'roll', 'rolls', 'egg roll', 'chinese roll', 'cutlet', 'samosa', 'savoury', 'pastry'],
    categories: ['Pastries & Savories', 'Savouries', 'Short Eats'],
    categoryKey: 'pastries'
  },
  {
    id: 'spicy_chicken',
    name: 'Spicy Chicken Pastry',
    path: '/images/products/spicy_chicken.jpg',
    keywords: ['chicken', 'spicy', 'burger', 'sandwich', 'submarine', 'pizza', 'hot dog'],
    categories: ['Pastries & Savories', 'Savouries', 'Short Eats'],
    categoryKey: 'pastries'
  },
  {
    id: 'vanilla_eclair',
    name: 'Vanilla Eclair & Pastry',
    path: '/images/products/vanilla_eclair.jpg',
    keywords: ['eclair', 'pastry', 'choux', 'profiterole', 'cream puff', 'slice', 'gateau slice'],
    categories: ['Pastries & Savories', 'Sweet Items & Desserts', 'Desserts'],
    categoryKey: 'pastries'
  },

  // ── 3. Breads & Buns (පාන් සහ බනිස් වර්ග) ──
  {
    id: 'fish_bun',
    name: 'Fresh Bakery Buns & Bread',
    path: '/images/products/fish_bun.jpg',
    keywords: ['fish bun', 'bun', 'buns', 'seeni sambal', 'egg bun', 'bread', 'roast paan', 'loaf', 'croissant'],
    categories: ['Breads & Buns', 'Buns', 'Breads'],
    categoryKey: 'breads'
  },

  // ── 4. Sweet Items & Desserts (පැණිරස සහ ඩෙසර්ට්ස්) ──
  {
    id: 'choco_fudge_cupcake',
    name: 'Choco Fudge Cupcake',
    path: '/images/products/choco_fudge_cupcake.jpg',
    keywords: ['cupcake', 'muffin', 'fairy cake', 'mini cake', 'dessert', 'sweet', 'pudding'],
    categories: ['Sweet Items & Desserts', 'Desserts'],
    categoryKey: 'sweets'
  },

  // ── 5. Biscuits & Cookies (බිස්කට් සහ කුකීස්) ──
  {
    id: 'cookies_biscuits',
    name: 'Baked Cookies & Biscuits',
    path: '/images/products/cookies_biscuits.jpg',
    keywords: ['cookie', 'cookies', 'biscuit', 'biscuits', 'shortbread', 'wafer', 'rusk'],
    categories: ['Biscuits & Cookies', 'Cookies', 'Biscuits'],
    categoryKey: 'cookies'
  },

  // ── 6. Ice Cream & Frozen Treats (අයිස්ක්‍රීම් වර්ග) ──
  {
    id: 'ice_cream',
    name: 'Ice Cream Sundae & Treats',
    path: '/images/products/ice_cream.jpg',
    keywords: ['ice cream', 'icecream', 'gelato', 'sundae', 'cone', 'frozen', 'popsicle'],
    categories: ['Ice Cream & Frozen Treats', 'Ice Cream'],
    categoryKey: 'icecream'
  },

  // ── 7. Birthday Deco & Party Items (උපන්දින සැරසිලි) ──
  {
    id: 'party_deco',
    name: 'Birthday Candles & Party Items',
    path: '/images/products/party_deco.jpg',
    keywords: ['candle', 'candles', 'topper', 'party', 'balloon', 'popper', 'deco', 'sparkler', 'card', 'snow spray'],
    categories: ['Birthday Deco & Party Items', 'Party Deco'],
    categoryKey: 'party'
  },

  // ── 8. Beverages & Coffee (බීම සහ කෝපි වර්ග) ──
  {
    id: 'iced_caramel_latte',
    name: 'Coffee & Beverages',
    path: '/images/products/iced_caramel_latte.jpg',
    keywords: ['coffee', 'latte', 'tea', 'iced', 'caramel', 'mocha', 'frappe', 'juice', 'mojito', 'beverage', 'drink', 'shake', 'smoothie', 'faluda'],
    categories: ['Beverages & Coffee', 'Beverages', 'Coffee', 'Drinks'],
    categoryKey: 'beverages'
  }
]

export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  'birthday deco & party items': '/images/products/party_deco.jpg',
  'sweet items & desserts': '/images/products/choco_fudge_cupcake.jpg',
  'cakes & gateaux': '/images/products/chocolate_cake.jpg',
  'biscuits & cookies': '/images/products/cookies_biscuits.jpg',
  'ice cream & frozen treats': '/images/products/ice_cream.jpg',
  'pastries & savories': '/images/products/savoury_pastries.jpg',
  'breads & buns': '/images/products/fish_bun.jpg',
  'beverages & coffee': '/images/products/iced_caramel_latte.jpg'
}

/**
 * Automatically detects and returns the most suitable bakery image path
 * based on product name keywords and category.
 */
export const getAutoMatchedProductImage = (productName?: string, categoryName?: string): string => {
  const pName = (productName || '').toLowerCase().trim()
  const cName = (categoryName || '').toLowerCase().trim()

  // 1. Keyword match in product name (highest priority)
  if (pName) {
    let bestPreset: ImagePreset | null = null
    let maxScore = 0

    for (const preset of BAKERY_IMAGE_PRESETS) {
      let score = 0
      for (const kw of preset.keywords) {
        if (pName.includes(kw)) {
          score += kw.length * 2
        }
      }
      for (const cat of preset.categories) {
        if (cName.includes(cat.toLowerCase())) {
          score += 6
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
  }

  // 2. Direct category lookup
  for (const [catKey, imgPath] of Object.entries(CATEGORY_IMAGE_MAP)) {
    if (cName.includes(catKey) || catKey.includes(cName)) {
      return imgPath
    }
  }

  // 3. Fallback based on category partial name
  if (cName.includes('deco') || cName.includes('party') || cName.includes('candle')) {
    return '/images/products/party_deco.jpg'
  }
  if (cName.includes('ice') || cName.includes('frozen') || cName.includes('cream')) {
    return '/images/products/ice_cream.jpg'
  }
  if (cName.includes('biscuit') || cName.includes('cookie')) {
    return '/images/products/cookies_biscuits.jpg'
  }
  if (cName.includes('sweet') || cName.includes('dessert') || cName.includes('cupcake')) {
    return '/images/products/choco_fudge_cupcake.jpg'
  }
  if (cName.includes('bun') || cName.includes('bread') || cName.includes('paan')) {
    return '/images/products/fish_bun.jpg'
  }
  if (cName.includes('pastr') || cName.includes('savour') || cName.includes('roll') || cName.includes('patty')) {
    return '/images/products/savoury_pastries.jpg'
  }
  if (cName.includes('drink') || cName.includes('bever') || cName.includes('coffee') || cName.includes('tea')) {
    return '/images/products/iced_caramel_latte.jpg'
  }
  if (cName.includes('cake') || cName.includes('gateaux')) {
    return '/images/products/chocolate_cake.jpg'
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
