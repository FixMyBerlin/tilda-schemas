import { expect, test } from '@playwright/test'

/**
 * Three cases of docs/viewer-examples.md: the category the package gives and one rule that triggers.
 * With `SCREENSHOT_DIR` set, each page is also saved as a screenshot (desktop and 375 px).
 */
const CASES: { name: string; tags: string; target?: string; category: string; rule: string }[] = [
  {
    name: 'bare-cycleway',
    tags: 'highway=cycleway',
    category: 'needsClarification',
    rule: 'needs_clarification',
  },
  {
    name: 'shared-unsigned',
    tags: 'highway=path;bicycle=designated;foot=designated;segregated=no',
    target: 'footAndCyclewayShared_adjoining:unsigned',
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

    await page.goto(`/?tags=${c.tags}${c.target ? `&target=${c.target}` : ''}`)

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
    '/?tags=highway=path;bicycle=designated;foot=designated;segregated=no&target=footAndCyclewayShared_adjoining:unsigned',
  )
  await page.getByTestId('plan').getByRole('button', { name: 'Plan übernehmen' }).click()
  await expect(page).toHaveURL(/traffic_sign=none/)
  await expect(page.getByTestId('category-id').first()).toHaveText(
    'footAndCyclewayShared_adjoining',
  )
})
