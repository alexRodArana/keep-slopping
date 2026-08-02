import { describe, expect, it } from 'vitest'
import { calculateNutrition, mapOpenFoodFactsProduct, normalizeBarcode } from './foodApi'

describe('food API helpers', () => {
  it('normalizes a product with nutrition per 100 grams', () => {
    const product = mapOpenFoodFactsProduct({
      brands: ['Alpina'],
      code: '7702001163885',
      image_front_small_url: 'https://images.openfoodfacts.org/product.jpg',
      nutriments: {
        carbohydrates_100g: 6.8,
        'energy-kcal_100g': 116,
        fat_100g: 4.4,
        proteins_100g: 12,
      },
      product_name: 'Yogurt griego',
      serving_size: '150 g',
    })

    expect(product).toMatchObject({
      barcode: '7702001163885',
      brand: 'Alpina',
      caloriesPer100g: 116,
      carbsPer100g: 6.8,
      fatPer100g: 4.4,
      name: 'Yogurt griego',
      proteinPer100g: 12,
      servingGrams: 150,
    })
  })

  it('calculates calories and macros from the selected portion', () => {
    const product = mapOpenFoodFactsProduct({
      code: '12345678',
      nutriments: {
        carbohydrates_100g: 40,
        'energy-kcal_100g': 200,
        fat_100g: 10,
        proteins_100g: 20,
      },
      product_name: 'Producto',
    })

    expect(product).not.toBeNull()
    expect(calculateNutrition(product!, 75)).toEqual({
      calories: 150,
      protein: 15,
      carbs: 30,
      fat: 7.5,
    })
  })

  it('uses the metric amount inside descriptive servings and falls back from an empty translated name', () => {
    const product = mapOpenFoodFactsProduct({
      code: '12345678',
      nutriments: { 'energy-kcal_100g': 90 },
      product_name: 'Avena',
      product_name_es: '',
      serving_size: '1 envase (250 g)',
    })

    expect(product).toMatchObject({ name: 'Avena', servingGrams: 250 })
  })

  it('rejects incomplete products and cleans scanned barcodes', () => {
    expect(mapOpenFoodFactsProduct({ code: '12345678', product_name: 'Sin calorias' })).toBeNull()
    expect(normalizeBarcode(' 750-123 4567890 ')).toBe('7501234567890')
  })
})
