import { Page, Locator, expect, test } from '@playwright/test';

export class SecretsPage {
    readonly page: Page;

    // Navigation and Action Buttons
    readonly secretsMenu: Locator;
    readonly createNewSecretBtn: Locator;
    readonly createSecretBtn: Locator;
    readonly continueBtn: Locator;
    readonly cancelBtn: Locator;
    readonly backBtn: Locator;

    // Inputs
    readonly displayNameInput: Locator;
    readonly searchInput: Locator;

    // Provider Buttons
    readonly awsProviderBtn: Locator;
    readonly gcpProviderBtn: Locator;
    readonly azureProviderBtn: Locator;
    readonly huggingfaceProviderBtn: Locator;
    readonly dockerProviderBtn: Locator;

    constructor(page: Page) {
        this.page = page;

        // Navigation & Sidebar
        this.secretsMenu = page.getByRole('button', { name: 'Secrets Secrets' });

        // Buttons
        this.createNewSecretBtn = page
            .getByRole('button', { name: 'Create New Secret' })
            .or(page.getByRole('button', { name: 'Create Secret' }));
        this.createSecretBtn = page.getByRole('button', { name: 'Create Secret', exact: true });
        this.continueBtn = page.getByRole('button', { name: 'Continue' });
        this.cancelBtn = page.getByRole('button', { name: /Cancel/i });
        this.backBtn = page.getByRole('button', { name: /Back/i });

        // Inputs
        this.displayNameInput = page.getByRole('textbox', { name: 'Enter a display name for your' });
        this.searchInput = page.getByRole('textbox', { name: /Search/i });

        // Provider Buttons (for reference)
        this.awsProviderBtn = page.getByRole('button', { name: 'AWS' });
        this.gcpProviderBtn = page.getByRole('button', { name: 'GCP' });
        this.azureProviderBtn = page.getByRole('button', { name: 'Azure' });
        this.huggingfaceProviderBtn = page.getByRole('button', { name: 'Huggingface' });
        this.dockerProviderBtn = page.getByRole('button', { name: 'Docker' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Navigation
    // ─────────────────────────────────────────────────────────────────────────

    async navigateToSecrets() {
        await test.step('Navigate to Secrets Management', async () => {
            await this.secretsMenu.waitFor({ state: 'visible', timeout: 15000 });
            await this.secretsMenu.click();
            await expect(this.createNewSecretBtn.first()).toBeVisible({ timeout: 15000 });
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Monaco Editor Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fill Monaco editor — JS API first, keyboard fallback second.
     */
    private async fillMonacoEditor(content: string): Promise<void> {
        const editorContainer = this.page.locator('.monaco-editor').first();
        await editorContainer.waitFor({ state: 'visible', timeout: 15000 });

        // Strategy 1: Monaco JS API
        const monacoSet = await this.page.evaluate((text: string) => {
            try {
                const editors = (window as any).monaco?.editor?.getEditors?.() ?? [];
                if (editors.length > 0) { editors[0].setValue(text); return true; }
                const models = (window as any).monaco?.editor?.getModels?.() ?? [];
                if (models.length > 0) { models[0].setValue(text); return true; }
            } catch (_) { /* fall through */ }
            return false;
        }, content).catch(() => false);

        if (monacoSet) {
            console.log('  ✔ Monaco editor value set via JS API');
            return;
        }

        // Strategy 2: Keyboard fallback
        console.log('  ⚠ Monaco JS API unavailable — using keyboard fallback');
        await editorContainer.click();
        await this.page.keyboard.press('Control+a');
        await this.page.keyboard.press('Delete');
        await this.page.keyboard.press('Control+a');
        await this.page.keyboard.press('Backspace');
        await this.page.keyboard.insertText(content);
    }

    /**
     * Read current Monaco editor value via JS API. Returns empty string on failure.
     */
    async getMonacoEditorValue(): Promise<string> {
        return await this.page.evaluate(() => {
            try {
                const editors = (window as any).monaco?.editor?.getEditors?.() ?? [];
                if (editors.length > 0) return editors[0].getValue();
                const models = (window as any).monaco?.editor?.getModels?.() ?? [];
                if (models.length > 0) return models[0].getValue();
            } catch (_) { /* fall through */ }
            return '';
        }).catch(() => '');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validation Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns true if "Secret data must be valid JSON" error is visible.
     */
    async hasJsonValidationError(): Promise<boolean> {
        const errorLocator = this.page
            .getByText('Secret data must be valid JSON', { exact: false })
            .or(this.page.getByText('must be valid JSON', { exact: false }))
            .or(this.page.getByText('valid JSON', { exact: false }));
        try {
            await errorLocator.first().waitFor({ state: 'visible', timeout: 3000 });
            console.log('  ⚠ JSON validation error detected');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check for any visible error/toast message matching the given text.
     */
    async hasErrorMessage(text: string | RegExp): Promise<boolean> {
        const locator = this.page.getByText(text);
        try {
            await locator.first().waitFor({ state: 'visible', timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Verify a specific validation/error message is visible.
     */
    async expectErrorMessage(text: string | RegExp) {
        await expect(
            this.page.getByText(text).first()
        ).toBeVisible({ timeout: 10000 });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Provider Selection
    // ─────────────────────────────────────────────────────────────────────────

    private async selectProvider(provider: 'AWS' | 'GCP' | 'Azure' | 'Huggingface' | 'Docker') {
        const dropdownTrigger = this.page
            .getByRole('button', { name: /AWS|GCP|Azure|Huggingface|Docker/i })
            .first();
        await dropdownTrigger.waitFor({ state: 'visible', timeout: 10000 });
        await dropdownTrigger.click();

        const option = this.page.getByRole('option', { name: provider, exact: true })
            .or(this.page.getByRole('option', { name: new RegExp(`^${provider}$`, 'i') }))
            .or(this.page.getByRole('button', { name: provider, exact: true }))
            .or(this.page.getByRole('button', { name: new RegExp(`^${provider}$`, 'i') }))
            .last();
        await option.waitFor({ state: 'visible', timeout: 10000 });
        await option.click();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE Secret
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Full create flow with JSON-error retry logic.
     */
    async createSecret(
        displayName: string,
        provider: 'AWS' | 'GCP' | 'Azure' | 'Huggingface' | 'Docker',
        secretConfig: string
    ) {
        await test.step(`Create ${provider} Secret: "${displayName}"`, async () => {
            await this.createNewSecretBtn.first().waitFor({ state: 'visible', timeout: 15000 });
            await this.createNewSecretBtn.first().click();

            await this.displayNameInput.waitFor({ state: 'visible', timeout: 10000 });
            await this.displayNameInput.fill(displayName);
            await this.continueBtn.click();

            await this.selectProvider(provider);
            await this.fillMonacoEditor(secretConfig);

            await this.createSecretBtn.waitFor({ state: 'visible', timeout: 10000 });
            await this.createSecretBtn.click();

            // Handle JSON validation error — retry once
            if (await this.hasJsonValidationError()) {
                console.log(`  ↳ Re-filling ${provider} editor with corrected JSON…`);
                await this.fillMonacoEditor(secretConfig);
                await this.createSecretBtn.waitFor({ state: 'visible', timeout: 10000 });
                await this.createSecretBtn.click();
            }

            await expect(
                this.page.getByText(displayName, { exact: false })
                    .or(this.page.getByRole('listitem').filter({ hasText: displayName }))
            ).toBeVisible({ timeout: 20000 });
            console.log(`  ✅ ${provider} secret "${displayName}" created successfully`);
        });
    }

    /**
     * Start the create flow but submit with an empty display name to test validation.
     */
    async attemptCreateWithEmptyName() {
        await test.step('Attempt create secret with empty name', async () => {
            await this.createNewSecretBtn.first().waitFor({ state: 'visible', timeout: 15000 });
            await this.createNewSecretBtn.first().click();
            await this.displayNameInput.waitFor({ state: 'visible', timeout: 10000 });
            await this.displayNameInput.fill('');
            await this.continueBtn.click();
        });
    }

    /**
     * Start the create flow, fill name, select provider, paste invalid JSON, click Create.
     * Returns whether JSON validation error appeared.
     */
    async attemptCreateWithInvalidJson(
        displayName: string,
        provider: 'AWS' | 'GCP' | 'Azure' | 'Huggingface' | 'Docker',
        invalidJson: string
    ): Promise<boolean> {
        let errorShown = false;
        await test.step(`Attempt create with invalid JSON for ${provider}`, async () => {
            await this.createNewSecretBtn.first().waitFor({ state: 'visible', timeout: 15000 });
            await this.createNewSecretBtn.first().click();

            await this.displayNameInput.waitFor({ state: 'visible', timeout: 10000 });
            await this.displayNameInput.fill(displayName);
            await this.continueBtn.click();

            await this.selectProvider(provider);
            await this.fillMonacoEditor(invalidJson);

            await this.createSecretBtn.waitFor({ state: 'visible', timeout: 10000 });
            await this.createSecretBtn.click();

            errorShown = await this.hasJsonValidationError();
        });
        return errorShown;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEARCH / LISTING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Search for a secret by name using the search input.
     */
    async searchSecret(query: string) {
        await test.step(`Search secrets: "${query}"`, async () => {
            await this.searchInput.waitFor({ state: 'visible', timeout: 10000 });
            await this.searchInput.click();
            await this.searchInput.fill(query);
            await this.page.keyboard.press('Enter');
        });
    }

    /**
     * Clear the search input.
     */
    async clearSearch() {
        await test.step('Clear search input', async () => {
            await this.searchInput.waitFor({ state: 'visible', timeout: 10000 });
            await this.searchInput.fill('');
            await this.page.keyboard.press('Enter');
        });
    }

    /**
     * Verify a secret name appears in the current listing.
     */
    async verifySecretInList(secretName: string) {
        await test.step(`Verify "${secretName}" is in list`, async () => {
            await expect(
                this.page.getByText(secretName, { exact: false }).first()
            ).toBeVisible({ timeout: 15000 });
        });
    }

    /**
     * Verify a secret name does NOT appear in the current listing.
     */
    async verifySecretNotInList(secretName: string) {
        await test.step(`Verify "${secretName}" is NOT in list`, async () => {
            await expect(
                this.page.getByText(secretName, { exact: false })
            ).not.toBeVisible({ timeout: 10000 });
        });
    }

    /**
     * Returns the count of visible secret items on the page.
     */
    async getSecretsCount(): Promise<number> {
        // Try multiple patterns: table rows, list items, card elements
        const rows = this.page.getByRole('row');
        const items = this.page.getByRole('listitem');
        const cards = this.page.locator('[class*="secret"]').or(this.page.locator('[class*="card"]'));

        const rowCount = await rows.count().catch(() => 0);
        const itemCount = await items.count().catch(() => 0);
        const cardCount = await cards.count().catch(() => 0);

        // Return whichever has the most (non-header) items
        return Math.max(rowCount > 1 ? rowCount - 1 : 0, itemCount, cardCount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EDIT Secret
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Click on a secret row/card to open it for editing.
     * Tries multiple interaction patterns: row click, edit icon, kebab menu.
     */
    async openSecretForEdit(secretName: string) {
        await test.step(`Open secret "${secretName}" for edit`, async () => {
            const secretRow = this.page.getByText(secretName, { exact: false }).first();
            await secretRow.waitFor({ state: 'visible', timeout: 10000 });

            // Try: Click the row/card itself (common for detail view)
            const editIcon = secretRow.locator('xpath=ancestor::div[contains(@class,"card") or contains(@class,"row") or contains(@class,"item")]')
                .getByRole('button', { name: /edit/i })
                .or(secretRow.locator('xpath=..').locator('svg').filter({ hasText: /edit/i }))
                .or(secretRow.locator('xpath=..').getByRole('button').first());

            // If an edit icon exists next to the row, click it; otherwise click the row
            if (await editIcon.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editIcon.click();
            } else {
                await secretRow.click();
            }
            await this.page.locator('.monaco-editor').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        });
    }

    /**
     * Edit the secret's display name (if editable).
     */
    async editSecretName(newName: string) {
        await test.step(`Edit secret name to "${newName}"`, async () => {
            const nameInput = this.displayNameInput
                .or(this.page.getByRole('textbox', { name: /name/i }))
                .or(this.page.getByRole('textbox').first());
            await nameInput.waitFor({ state: 'visible', timeout: 10000 });
            await nameInput.fill(newName);
        });
    }

    /**
     * Edit the secret's JSON configuration in Monaco editor.
     */
    async editSecretConfig(newConfig: string) {
        await test.step('Edit secret configuration', async () => {
            await this.fillMonacoEditor(newConfig);
        });
    }

    /**
     * Click Update/Save button to save edits.
     */
    async saveSecretEdits() {
        await test.step('Save secret edits', async () => {
            const saveBtn = this.page.getByRole('button', { name: /Save|Update/i }).first();
            await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
            await saveBtn.click();
            await saveBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE Secret
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Initiate deletion of a secret by name.
     * Looks for a delete button/icon on the secret's row, or a kebab menu → Delete option.
     */
    async deleteSecret(secretName: string) {
        await test.step(`Delete secret "${secretName}"`, async () => {
            const secretRow = this.page.getByText(secretName, { exact: false }).first();
            await secretRow.waitFor({ state: 'visible', timeout: 10000 });

            // Strategy 1: Direct delete icon next to the secret
            const parentContainer = secretRow.locator('xpath=ancestor::div[contains(@class,"card") or contains(@class,"row") or contains(@class,"item") or @role="listitem"]').first();

            const deleteBtn = parentContainer.getByRole('button', { name: /delete|remove/i })
                .or(parentContainer.locator('[aria-label*="delete" i]'))
                .or(parentContainer.locator('[aria-label*="remove" i]'))
                .or(parentContainer.locator('button:has(svg)').last());

            // Strategy 2: Kebab/overflow menu
            const kebabMenu = parentContainer.getByRole('button', { name: /more|options|menu/i })
                .or(parentContainer.locator('[aria-label*="more" i]'))
                .or(parentContainer.locator('[class*="kebab"]'))
                .or(parentContainer.locator('[class*="menu-trigger"]'));

            if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await deleteBtn.click();
            } else if (await kebabMenu.isVisible({ timeout: 3000 }).catch(() => false)) {
                await kebabMenu.click();
                const deleteOption = this.page.getByRole('menuitem', { name: /delete|remove/i })
                    .or(this.page.getByText(/Delete/i)).first();
                await deleteOption.waitFor({ state: 'visible', timeout: 5000 });
                await deleteOption.click();
            } else {
                // Fallback: try right-click or click the row
                await secretRow.click();
                const detailDeleteBtn = this.page.getByRole('button', { name: /delete|remove/i }).first();
                await detailDeleteBtn.waitFor({ state: 'visible', timeout: 10000 });
                await detailDeleteBtn.click();
            }

            // Wait for confirmation button to appear
            const confirmBtn = this.page.getByRole('button', { name: /Confirm|Yes|Delete|OK/i })
                .or(this.page.getByRole('button', { name: /Continue/i })).first();
            await confirmBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        });
    }

    /**
     * Confirm deletion in the confirmation dialog.
     */
    async confirmDelete() {
        await test.step('Confirm deletion', async () => {
            const confirmBtn = this.page.getByRole('button', { name: /Confirm|Yes|Delete/i })
                .or(this.page.getByRole('button', { name: /OK/i })).first();
            await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
            await confirmBtn.click();
            await confirmBtn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        });
    }

    /**
     * Cancel deletion in the confirmation dialog.
     */
    async cancelDelete() {
        await test.step('Cancel deletion', async () => {
            const cancelBtn = this.page.getByRole('button', { name: /Cancel|No/i }).first();
            await cancelBtn.waitFor({ state: 'visible', timeout: 10000 });
            await cancelBtn.click();
            await cancelBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        });
    }

    /**
     * Full delete flow: find secret → click delete → confirm.
     */
    async deleteSecretAndConfirm(secretName: string) {
        await test.step(`Delete and confirm: "${secretName}"`, async () => {
            await this.deleteSecret(secretName);
            await this.confirmDelete();
            console.log(`  🗑️ Secret "${secretName}" deleted successfully`);
        });
    }
}
