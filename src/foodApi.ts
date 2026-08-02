import type { FoodProduct } from './types'

const PRODUCT_API = 'https://world.openfoodfacts.org/api/v3/product'
const SEARCH_API = 'https://world.openfoodfacts.org/cgi/search.pl'
const CLIENT_HEADER = 'KeepSlopping/1.0 (https://github.com/alexRodArana/keep-slopping)'
const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'brands',
  'image_front_small_url',
  'nutriments',
  'serving_quantity',
  'serving_quantity_unit',
  'serving_size',
].join(',')
const SEARCH_CACHE_TTL = 30 * 60 * 1000
const PRODUCT_CACHE_TTL = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'keep-slopping-food-cache-v1'

type CachedValue<T> = {
  expiresAt: number
  value: T
}

type NutritionValues = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const finiteNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const positiveNumber = (value: unknown, fallback = 0) => {
  const parsed = finiteNumber(value)
  return parsed === undefined ? fallback : Math.max(0, parsed)
}

const roundNutrition = (value: number) => Math.round(value * 10) / 10

const safeImageUrl = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

const getBrand = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(String).find(Boolean) ?? ''
  }

  return typeof value === 'string' ? value.split(',')[0]?.trim() ?? '' : ''
}

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

const validServingGrams = (value: unknown) => {
  const grams = finiteNumber(value)
  return grams !== undefined && grams > 0 && grams <= 2000 ? roundNutrition(grams) : undefined
}

const parseServingGrams = (size: unknown, quantity: unknown, unit: unknown) => {
  const normalizedUnit = typeof unit === 'string' ? unit.trim().toLocaleLowerCase('es-MX') : ''
  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams' || normalizedUnit === 'ml') {
    const grams = validServingGrams(quantity)
    if (grams !== undefined) {
      return grams
    }
  }

  if (typeof size !== 'string') {
    return 100
  }

  const normalizedSize = size.replace(',', '.')
  const metricMatches = [...normalizedSize.matchAll(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos?|ml)\b/gi)]
  const metricGrams = validServingGrams(metricMatches.at(-1)?.[1])
  if (metricGrams !== undefined) {
    return metricGrams
  }

  return validServingGrams(normalizedSize.match(/(\d+(?:\.\d+)?)/)?.[1]) ?? 100
}

const getCaloriesPer100g = (nutriments: Record<string, unknown>) => {
  const calories = finiteNumber(nutriments['energy-kcal_100g'])
  if (calories !== undefined) {
    return Math.max(0, calories)
  }

  const kilojoules = finiteNumber(nutriments.energy_100g)
  return kilojoules === undefined ? undefined : Math.max(0, kilojoules / 4.184)
}

export const normalizeBarcode = (value: string) => value.replace(/\D/g, '').slice(0, 18)

export const mapOpenFoodFactsProduct = (value: unknown): FoodProduct | null => {
  if (!isRecord(value)) {
    return null
  }

  const barcode = normalizeBarcode(String(value.code ?? ''))
  const name = firstText(value.product_name_es, value.product_name)
  const nutriments = isRecord(value.nutriments) ? value.nutriments : {}
  const caloriesPer100g = getCaloriesPer100g(nutriments)

  if (!barcode || !name || caloriesPer100g === undefined) {
    return null
  }

  return {
    barcode,
    name,
    brand: getBrand(value.brands),
    imageUrl: safeImageUrl(value.image_front_small_url),
    servingGrams: parseServingGrams(value.serving_size, value.serving_quantity, value.serving_quantity_unit),
    caloriesPer100g: roundNutrition(caloriesPer100g),
    proteinPer100g: roundNutrition(positiveNumber(nutriments.proteins_100g)),
    carbsPer100g: roundNutrition(positiveNumber(nutriments.carbohydrates_100g)),
    fatPer100g: roundNutrition(positiveNumber(nutriments.fat_100g)),
  }
}

export const calculateNutrition = (product: FoodProduct, grams: number): NutritionValues => {
  const safeGrams = Math.max(0, Number.isFinite(grams) ? grams : 0)
  const factor = safeGrams / 100

  return {
    calories: roundNutrition(product.caloriesPer100g * factor),
    protein: roundNutrition(product.proteinPer100g * factor),
    carbs: roundNutrition(product.carbsPer100g * factor),
    fat: roundNutrition(product.fatPer100g * factor),
  }
}

const readCache = <T>(key: string): T | undefined => {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}:${key}`)
    if (!raw) {
      return undefined
    }

    const cached = JSON.parse(raw) as CachedValue<T>
    if (!cached.expiresAt || cached.expiresAt <= Date.now()) {
      sessionStorage.removeItem(`${CACHE_PREFIX}:${key}`)
      return undefined
    }

    return cached.value
  } catch {
    return undefined
  }
}

const writeCache = <T>(key: string, value: T, ttl: number) => {
  try {
    sessionStorage.setItem(
      `${CACHE_PREFIX}:${key}`,
      JSON.stringify({
        expiresAt: Date.now() + ttl,
        value,
      } satisfies CachedValue<T>),
    )
  } catch {
    // Private browsing can disable session storage.
  }
}

const fetchJson = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-User-Agent': CLIENT_HEADER,
    },
    signal,
  })

  if (response.status === 429) {
    throw new Error('Demasiadas consultas. Espera un minuto e intenta otra vez.')
  }

  if (!response.ok) {
    throw new Error('No se pudo consultar la base de alimentos.')
  }

  return response.json() as Promise<unknown>
}

export const searchFoods = async (query: string, signal?: AbortSignal): Promise<FoodProduct[]> => {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ')
  if (normalizedQuery.length < 2) {
    return []
  }

  const cacheKey = `search:${normalizedQuery.toLocaleLowerCase('es-MX')}`
  const cached = readCache<FoodProduct[]>(cacheKey)
  if (cached) {
    return cached
  }

  const params = new URLSearchParams({
    search_terms: normalizedQuery,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '10',
    fields: PRODUCT_FIELDS,
    lc: 'es',
    cc: 'mx',
  })
  const data = await fetchJson(`${SEARCH_API}?${params.toString()}`, signal)
  const products = isRecord(data) && Array.isArray(data.products) ? data.products : []
  const seen = new Set<string>()
  const results = products
    .map(mapOpenFoodFactsProduct)
    .filter((product): product is FoodProduct => Boolean(product))
    .filter((product) => {
      if (seen.has(product.barcode)) {
        return false
      }
      seen.add(product.barcode)
      return true
    })

  writeCache(cacheKey, results, SEARCH_CACHE_TTL)
  return results
}

export const getFoodByBarcode = async (value: string, signal?: AbortSignal): Promise<FoodProduct | null> => {
  const barcode = normalizeBarcode(value)
  if (barcode.length < 6) {
    return null
  }

  const cacheKey = `barcode:${barcode}`
  const cached = readCache<FoodProduct | null>(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const params = new URLSearchParams({
    fields: PRODUCT_FIELDS,
    lc: 'es',
    cc: 'mx',
  })
  const data = await fetchJson(`${PRODUCT_API}/${encodeURIComponent(barcode)}?${params.toString()}`, signal)
  const product = isRecord(data) ? mapOpenFoodFactsProduct(data.product) : null
  writeCache(cacheKey, product, PRODUCT_CACHE_TTL)
  return product
}
