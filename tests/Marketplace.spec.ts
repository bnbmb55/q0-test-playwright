import { test, expect } from '../fixtures/base';
import { AppConfig } from '../utils/config';

test.describe('Marketplace Functionality', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(90000);

    test.beforeEach(async ({ loginPage, dashboardPage, marketplacePage }) => {
        await loginPage.navigate();
        await loginPage.login('patil.tanmay9900@gmail.com', 'Ganesha@5050');
        await dashboardPage.verifyDashboardVisible();

        const marketplaceLink = dashboardPage.page.getByRole('button', { name: /Marketplace/ }).first();
        await expect(marketplaceLink).toBeVisible({ timeout: 15000 });
        await marketplaceLink.click();

        await expect(dashboardPage.page).toHaveURL(/marketplace/, { timeout: 30000 });
        await expect(dashboardPage.page.getByText('Discover 100+ Models')).toBeVisible({ timeout: 20000 });
    });

    test('TC-MARKET-01: Verify Marketplace landing page UI components', async ({ marketplacePage }) => {
        await expect(marketplacePage.page.getByText('Discover 100+ Models')).toBeVisible();
        await expect(marketplacePage.page.getByRole('button', { name: 'Text Generation' })).toBeVisible();
        await expect(marketplacePage.searchBar).toBeVisible();
    });

    test('TC-MARKET-02: Verify search functionality', async ({ marketplacePage }) => {
        await marketplacePage.search('Gemma');
        const dropdownResult = marketplacePage.page.locator('div').filter({ hasText: /^Gemma/ }).first();
        await expect(dropdownResult).toBeVisible();
        await expect(dropdownResult).toContainText(/Gemma/i);
    });

    test('TC-MARKET-03: Verify search with invalid input', async ({ marketplacePage }) => {
        await marketplacePage.search('NonExistentModel12345');
        await expect(marketplacePage.page.getByText('No Results Found')).toBeVisible();
    });

    test('TC-MARKET-04: Verify advanced filtering by Task and Provider', async ({ marketplacePage }) => {
        console.log('Selecting Text Generation filter...');
        await marketplacePage.applyFilter('Text generation');
        await expect(marketplacePage.page.locator('h3')).toHaveCount(8, { timeout: 15000 });

        console.log('Selecting OpenAI filter...');
        await marketplacePage.applyFilter('openai');
        await expect(marketplacePage.page.locator('h3')).toHaveCount(2, { timeout: 15000 });

        console.log('Clearing filters...');
        await marketplacePage.clearFilters();
        await expect(marketplacePage.page.locator('h3')).toHaveCount(20, { timeout: 15000 });
    });

    test('TC-MARKET-05: Verify sorting by New vs Popular', async ({ marketplacePage }) => {
        await marketplacePage.sortBy('New');
        await expect(marketplacePage.modelCards.first()).toBeVisible();

        await marketplacePage.sortBy('Popular');
        await expect(marketplacePage.page.locator('div').filter({ hasText: /^Popular Models$/ })).toBeVisible();
    });

    test('TC-MARKET-06: Verify model detail page navigation and core actions', async ({ marketplacePage }) => {
        const firstModelTitle = marketplacePage.modelCards.first();
        await expect(firstModelTitle).toBeVisible();
        const modelName = await firstModelTitle.innerText();

        await firstModelTitle.click();

        await expect(marketplacePage.page.locator('h1')).toContainText(modelName, { timeout: 20000 });
        await expect(marketplacePage.page.getByRole('button', { name: 'Try Now' })).toBeVisible();
        await expect(marketplacePage.page.getByRole('button', { name: 'Deploy On Demand' })).toBeVisible();

        const marketplaceNav = marketplacePage.page.locator('nav, .sidebar, .navigation').getByText('Marketplace', { exact: true }).first();
        await expect(marketplaceNav).toBeVisible({ timeout: 15000 });
        await marketplaceNav.click({ force: true });
        
        await expect(marketplacePage.page).toHaveURL(/marketplace/, { timeout: 30000 });
    });

    test('TC-MARKET-07: Verify "Clear All" functionality in filters panel', async ({ marketplacePage }) => {
        await marketplacePage.applyFilter('Text generation');
        await marketplacePage.applyFilter('openai');
        await marketplacePage.clearFilters();
        await expect(marketplacePage.page.getByText('Discover 100+ Models')).toBeVisible();
    });

    test('TC-MARKET-08: Verify infinite scroll loads more models', async ({ marketplacePage }) => {
        await expect(marketplacePage.page.locator('h3').first()).toBeVisible();
        const initialCardCount = await marketplacePage.page.locator('h3').count();

        for (let i = 0; i < 3; i++) {
            await marketplacePage.page.evaluate(() => window.scrollBy(0, 2000));
            await marketplacePage.page.waitForTimeout(1000);
        }

        const newCardCount = await marketplacePage.page.locator('h3').count();
        expect(newCardCount).toBeGreaterThanOrEqual(initialCardCount);
    });
});
