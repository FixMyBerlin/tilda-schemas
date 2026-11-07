import { expect, test } from '@playwright/test'

/**
 * Three cases of docs/viewer-examples.md: the category the package gives and one rule that triggers.
 * With `SCREENSHOT_DIR` set, each page is also saved as a screenshot (desktop and 375 px).
 */
const CASES: { name: string; tags: string; choice?: string; category: string; rule: string }[] = [
  {
    name: 'bare-cycleway',
    tags: 'highway=cycleway',
    category: 'needsClarification',
    rule: 'needs_clarification',
  },
  {
    name: 'shared-unsigned',
    tags: 'highway=path;bicycle=designated;foot=designated;segregated=no',
    choice: 'kind=footAndCyclewayShared&position=adjoining&sign=unsigned',
    category: 'footAndCyclewayShared_adjoiningOrIsolated',
    rule: 'missing_traffic_sign',
  },
  {
    name: 'protected-lane',
    tags: 'highway=residential;cycleway:right=lane;cycleway:right:lane=exclusive;cycleway:right:separation:left=flex_post',
    category: 'cyclewayOnHighwayProtected',
    rule: 'missing_traffic_sign',
  },
]

const screenshotDir = process.env.SCREENSHOT_DIR

for (const c of CASES) {
  test(`${c.name}: category and a triggered rule`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto(`/?tags=${c.tags}${c.choice ? `&${c.choice}` : ''}`)

    await expect(page.getByTestId('category-id').first()).toHaveText(c.category)
    await expect(page.getByTestId('category-label').first()).not.toBeEmpty()
    const rule = page.locator(`[data-testid="rule-triggered"][data-rule="${c.rule}"]`)
    await expect(rule).toBeVisible()
    expect(errors).toEqual([])

    // No sideways scrolling on a phone.
    await page.setViewportSize({ width: 375, height: 812 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.setViewportSize({ width: 1280, height: 720 })

    if (screenshotDir) {
      await page.screenshot({ path: `${screenshotDir}/${c.name}-desktop.png`, fullPage: true })
      await page.setViewportSize({ width: 375, height: 812 })
      await page.screenshot({ path: `${screenshotDir}/${c.name}-375.png`, fullPage: true })
      await page.screenshot({ path: `${screenshotDir}/${c.name}-375-top.png` })
    }
  })
}

test('the tag text updates the URL', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Tags' }).fill('highway=cycleway\ntraffic_sign=none')
  await expect(page).toHaveURL(/tags=highway=cycleway;traffic_sign=none/)
  await expect(page.getByTestId('category-id').first()).toHaveText('cycleway_adjoiningOrIsolated')
})

test('applying a plan changes the tags and the category', async ({ page }) => {
  await page.goto(
    '/?tags=highway=path;bicycle=designated;foot=designated;segregated=no&kind=footAndCyclewayShared&position=adjoining&sign=unsigned',
  )
  await page.getByTestId('plan').getByRole('button', { name: 'Plan übernehmen' }).click()
  await expect(page).toHaveURL(/traffic_sign=none/)
  await expect(page.getByTestId('category-id').first()).toHaveText(
    'footAndCyclewayShared_adjoining',
  )
})

test('a gap is a button that adds the tag', async ({ page }) => {
  await page.goto('/?tags=highway=cycleway')
  await page.getByRole('button', { name: 'traffic_sign=DE:240' }).first().click()
  await expect(page).toHaveURL(/traffic_sign=DE:240/)
  await expect(page.getByTestId('category-id').first()).toHaveText(
    'footAndCyclewayShared_adjoiningOrIsolated',
  )
  // the base category of the gap has a German label
  await page.goto('/?tags=highway=cycleway')
  await expect(page.getByTestId('gaps').first()).toContainText('Gemeinsamer Geh- & Radweg')
})

test('a gap on a road side writes the key of the side', async ({ page }) => {
  await page.goto('/?tags=highway=residential;cycleway:right=yes')
  await page.getByRole('button', { name: 'cycleway:right=lane' }).first().click()
  await expect(page).toHaveURL(/cycleway:right=lane/)
  await expect(page).not.toHaveURL(/cycleway:right:cycleway/)
  await expect(page.getByTestId('category-id').first()).toHaveText(
    'cyclewayOnHighway_advisoryOrExclusive',
  )
})

test('required attributes, reminders and QA state are in German', async ({ page }) => {
  await page.goto('/?tags=highway=cycleway;is_sidepath=yes;traffic_sign=DE:237')
  const attributes = page.getByTestId('attributes')
  await expect(attributes.getByText('Verkehrsschild (oder keines)')).toBeVisible()
  await expect(attributes.getByText('Breite', { exact: true })).toBeVisible()
  await expect(page.getByTestId('reminders')).toContainText('Auf Schadenschilder prüfen.')
  await expect(page.locator('section[aria-labelledby="requirements-title"]')).toContainText(
    'Tags fehlen',
  )
  await expect(page.locator('section[aria-labelledby="requirements-title"]')).toContainText('Fehlt')
})

test('the tilda-geo profile has required attributes without the Radnetz extras', async ({
  page,
}) => {
  await page.goto('/?tags=highway=cycleway;is_sidepath=yes;traffic_sign=DE:237&profile=tilda-geo')
  const attributes = page.getByTestId('attributes')
  await expect(attributes.getByText('Breite', { exact: true })).toBeVisible()
  await expect(page.getByTestId('reminders')).toHaveCount(0)
  await expect(page.locator('section[aria-labelledby="requirements-title"]')).toContainText(
    'tilda-geo',
  )
  await expect(page.getByText('infraVelo')).toHaveCount(0)
})

test('a plan explains its tags in German', async ({ page }) => {
  await page.goto(
    '/?tags=highway=cycleway&kind=footAndCyclewaySegregated&position=adjoining&sign=signed',
  )
  await expect(page.getByTestId('plan')).toContainText('Festes Tag des gewählten Ziels.')
  await expect(page.getByTestId('plan')).toContainText('Unterscheidet „Getrennter Rad- und Gehweg')
})

test('a kind with options: under construction there is no sign option', async ({ page }) => {
  await page.goto('/?tags=highway=path;bicycle=designated;foot=designated;segregated=no')
  await page
    .getByRole('combobox', { name: /^Art für/ })
    .selectOption({ label: 'Getrennter Rad- und Gehweg' })
  await expect(page).toHaveURL(/kind=footAndCyclewaySegregated/)
  const sign = page.getByRole('group', { name: 'Beschilderung' })
  await expect(sign).toBeVisible()
  await page.getByRole('group', { name: 'Zustand' }).getByRole('button', { name: 'im Bau' }).click()
  await expect(page).toHaveURL(/lifecycle=construction/)
  await expect(page.getByRole('group', { name: 'Beschilderung' })).toHaveCount(0)
  await expect(page.getByTestId('plan').getByRole('heading', { level: 4 })).toContainText('im Bau')
})

test('a rule without a finding shows its description', async ({ page }) => {
  await page.goto('/?tags=highway=cycleway')
  const rule = page.locator('[data-testid="rule"][data-rule="missing_surface"]')
  await expect(rule).toContainText('Radinfrastruktur hat keine Oberfläche')
  // no unfilled placeholder in any rule text
  await expect(page.getByTestId('rules')).not.toContainText(/\{\w+\}/)
})
