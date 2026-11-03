import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const readPersistedGuestRoute = (page: Page) => page.evaluate(async () => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('goy-suite-cache-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
  const cached = await new Promise<{
    state?: { sessions?: Array<{ mealId: string; optionId?: string; completed: boolean }> }
  } | undefined>((resolve, reject) => {
    const request = database.transaction('accounts').objectStore('accounts').get('keep-slopping:guest')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })

  return (cached?.state?.sessions ?? [])
    .filter(({ mealId }) => mealId === 'lunch' || mealId === 'dinner')
    .map(({ mealId, optionId, completed }) => ({ mealId, optionId, completed }))
    .sort((left, right) => left.mealId.localeCompare(right.mealId))
})

test('meal and creatine checklists persist and edits do not double-count meals', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: /Creatina/ }).click()
  await page.getByRole('button', { name: 'Completar 1. Desayuno | Avena', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Marcar 1. Desayuno | Avena como pendiente' })).toBeVisible()
  await expect(page.locator('.metric-card').filter({ hasText: 'Registrado' })).toContainText('865')
  await page.screenshot({ path: info.outputPath('checklist.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Marcar 1. Desayuno | Avena como pendiente' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Creatina/ })).toContainText('Hecho')
  await page.getByRole('button', { name: 'Marcar 1. Desayuno | Avena como pendiente' }).click()
  await page.getByRole('button', { name: 'Completar 1. Desayuno | Avena', exact: true }).click()
  await expect(page.locator('.metric-card').filter({ hasText: 'Registrado' })).toContainText('865')
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Editar 1. Desayuno | Avena', exact: true }).click()
  await page.getByLabel('Comida', { exact: true }).fill('Desayuno editado')
  await page.screenshot({ path: info.outputPath('editor.png'), fullPage: true, animations: 'disabled' })
  const editorAccessibility = await new AxeBuilder({ page }).disableRules(['meta-viewport']).analyze()
  expect(editorAccessibility.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))).toEqual([])
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Desayuno editado' })).toBeVisible()
  expect(errors).toEqual([])
})

test('shared appearance, contrast, responsive layout and logo rendering', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1. Desayuno | Avena', exact: true })).toBeVisible()
  await expect(page.getByText('Plan de hoy', { exact: true })).toHaveCount(0)
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme as 'dark' | 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'system')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await page.getByRole('button', { name: 'Cambiar acento', exact: true }).click()
    await page.getByRole('menuitemradio', { name: 'Color Azul' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue')
    const ovalControls = await page.locator('.icon-button:not(.tiny), .account-status, .accent-swatch, .check-icon, .meal-master-check').evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const { width, height } = node.getBoundingClientRect()
        return width > 0 && height > 0 && Math.abs(width - height) > 0.5
          ? [{ className: node.className, width, height }]
          : []
      }),
    )
    expect(ovalControls).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('.brand-mark img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 192)).toBe(true)
    const findings = await new AxeBuilder({ page }).disableRules(['meta-viewport']).analyze()
    expect(findings.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))).toEqual([])
    await page.screenshot({ path: info.outputPath(`home-${theme}.png`), fullPage: true })
  }
  await page.getByRole('button', { name: 'Cambiar acento', exact: true }).click()
  await page.getByRole('button', { name: 'Elegir tema' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Color Azul' })).toHaveCount(0)
  await page.getByRole('menuitemradio', { name: 'Oscuro', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Elegir tema' }).click()
  await page.getByRole('menuitemradio', { name: 'Dispositivo', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0d0f12')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'system')
})

test('daily dinner choice persists and changes only that dinner registration', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2026-11-03T12:00:00Z'))
  await page.goto('/')

  const preWorkoutCard = page.locator('article.meal-checklist').filter({
    has: page.getByRole('heading', { name: 'Colación preentreno | Arroz inflado y miel', exact: true }),
  })
  const dinnerCard = page.locator('article.meal-checklist').filter({
    has: page.getByRole('heading', { name: '4. Cena | Elige UNA opción', exact: true }),
  })
  const registered = page.locator('.metric-card').filter({ hasText: 'Registrado' })
  const dinnerOptionA = dinnerCard.getByRole('radio', { name: /Opción A - Avena sin PB2/ })
  const dinnerOptionB = dinnerCard.getByRole('radio', { name: /Opción B - Pollo con papa/ })

  await expect(dinnerOptionA).not.toBeChecked()
  await expect(dinnerOptionB).not.toBeChecked()
  await expect(page.locator('article.meal-checklist')).toHaveCount(5)
  await expect(dinnerCard.getByText('Selecciona una opción para ver y registrar sus ingredientes.', { exact: true })).toBeVisible()
  await expect(dinnerCard.getByRole('button', { name: 'Elige una opción para 4. Cena | Elige UNA opción' })).toBeDisabled()
  await expect(preWorkoutCard.getByRole('button', { name: /Marcar Arroz inflado natural/ })).toContainText('53 g')
  await preWorkoutCard.getByRole('button', { name: 'Completar Colación preentreno | Arroz inflado y miel', exact: true }).click()
  await expect(registered).toContainText('276')

  await dinnerOptionA.check()
  await expect(dinnerOptionA).toBeChecked()
  await expect(preWorkoutCard.getByRole('button', { name: /Desmarcar Arroz inflado natural/ })).toContainText('53 g')
  await expect(dinnerCard.getByRole('button', { name: 'Marcar Avena seca de 4. Cena | Elige UNA opción' })).toContainText('97 g')
  await expect(dinnerCard.getByRole('button', { name: 'Marcar Proteína whey de 4. Cena | Elige UNA opción' })).toContainText('6 g')
  const dinnerFruit = dinnerCard.getByRole('button', { name: /Marcar Fresas congeladas o moras azules/ })
  await expect(dinnerFruit).toHaveCount(1)
  await expect(dinnerFruit).toContainText('150 g de fresas o 84 g de moras azules')
  await expect(dinnerCard.getByRole('button', { name: /Marcar Pechuga de pollo/ })).toHaveCount(0)
  await expect(page.locator('.ingredient-check strong').filter({ hasText: /^PB2$/ })).toHaveCount(0)

  await dinnerCard.getByRole('button', { name: 'Completar 4. Cena | Elige UNA opción', exact: true }).click()
  await expect(registered).toContainText('924')
  await expect.poll(() => readPersistedGuestRoute(page)).toEqual([
    { mealId: 'dinner', optionId: 'dinner-a', completed: true },
    { mealId: 'lunch', optionId: undefined, completed: true },
  ])

  await page.reload()
  await expect(dinnerOptionA).toBeChecked()
  await expect(preWorkoutCard.getByRole('button', { name: 'Marcar Colación preentreno | Arroz inflado y miel como pendiente', exact: true })).toBeVisible()
  await expect(dinnerCard.getByRole('button', { name: 'Marcar 4. Cena | Elige UNA opción como pendiente', exact: true })).toBeVisible()
  await expect(registered).toContainText('924')
  await page.screenshot({ path: info.outputPath('dinner-a.png'), fullPage: true, animations: 'disabled' })

  await dinnerOptionB.check()
  await expect(dinnerOptionA).not.toBeChecked()
  await expect(dinnerOptionB).toBeChecked()
  await expect(preWorkoutCard.getByRole('button', { name: /Desmarcar Arroz inflado natural/ })).toContainText('53 g')
  await expect(dinnerCard.getByRole('button', { name: 'Marcar Pechuga de pollo, en crudo de 4. Cena | Elige UNA opción' })).toContainText('42 g')
  await expect(dinnerCard.getByRole('button', { name: 'Marcar Papa, en crudo de 4. Cena | Elige UNA opción' })).toContainText('420 g')
  await expect(dinnerCard.getByRole('button', { name: /Marcar Avena seca/ })).toHaveCount(0)
  await expect(preWorkoutCard.getByRole('button', { name: 'Marcar Colación preentreno | Arroz inflado y miel como pendiente', exact: true })).toBeVisible()
  await expect(dinnerCard.getByRole('button', { name: 'Completar 4. Cena | Elige UNA opción', exact: true })).toBeVisible()
  await expect(registered).toContainText('276 kcal')
  await expect.poll(() => readPersistedGuestRoute(page)).toEqual([
    { mealId: 'dinner', optionId: 'dinner-b', completed: false },
    { mealId: 'lunch', optionId: undefined, completed: true },
  ])

  await page.reload()
  await expect(dinnerOptionB).toBeChecked()
  await expect(preWorkoutCard.getByRole('button', { name: /Desmarcar Arroz inflado natural/ })).toContainText('53 g')
  await expect(registered).toContainText('276 kcal')
  await dinnerCard.getByRole('button', { name: 'Completar 4. Cena | Elige UNA opción', exact: true }).click()
  await expect(registered).toContainText('928 kcal')
  await expect.poll(() => readPersistedGuestRoute(page)).toEqual([
    { mealId: 'dinner', optionId: 'dinner-b', completed: true },
    { mealId: 'lunch', optionId: undefined, completed: true },
  ])
  await page.screenshot({ path: info.outputPath('dinner-b.png'), fullPage: true, animations: 'disabled' })

  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00Z'))
  await page.reload()
  await expect(dinnerOptionA).not.toBeChecked()
  await expect(dinnerOptionB).not.toBeChecked()
  await expect(registered).toContainText('0 kcal')
  await expect(dinnerCard.getByRole('button', { name: 'Elige una opción para 4. Cena | Elige UNA opción' })).toBeDisabled()
})
