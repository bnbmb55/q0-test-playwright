import { Page, Locator, expect } from '@playwright/test';

export class MarketplacePage {
    readonly page: Page;
    readonly searchBar: Locator;
    readonly filtersButton: Locator;
    readonly applyFiltersButton: Locator;
    readonly clearAllButton: Locator;
    readonly sortDropdown: Locator;
    readonly modelCards: Locator;

    constructor(page: Page) {
        this.page = page;
        this.searchBar = page.getByRole('textbox', { name: 'Discover 100s models and try' });
        this.filtersButton = page.getByRole('button', { name: 'Filters filter' });
        this.applyFiltersButton = page.getByRole('button', { name: 'Apply Filters' });
        this.clearAllButton = page.getByRole('button', { name: /Clear All/i });
        this.sortDropdown = page.getByRole('combobox');
        this.modelCards = page.locator('h3');
    }

    async search(query: string) {
        await this.searchBar.fill(query);
    }

    async applyFilter(taskOrProvider: string) {
        await this.filtersButton.click();
        await this.page.getByRole('button', { name: taskOrProvider, exact: false }).click();
        await this.applyFiltersButton.click();
        await expect(this.modelCards.first()).toBeVisible({ timeout: 15000 });
    }

    async clearFilters() {
        await this.filtersButton.click();
        await this.clearAllButton.last().click();
        await expect(this.modelCards.first()).toBeVisible({ timeout: 15000 });
    }

    async sortBy(option: 'New' | 'Popular') {
        await this.sortDropdown.click();
        await this.page.getByRole('option', { name: option }).click();
    }
}
