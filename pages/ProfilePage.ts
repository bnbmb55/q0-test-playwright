import { Page, Locator, expect } from '@playwright/test';
import * as path from 'path';

export class ProfilePage {
    readonly page: Page;
    readonly editProfileButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.editProfileButton = page.getByRole('button', { name: 'Edit Profile' });
    }

    async uploadProfilePicture(absolutePath: string) {
        const imageSavePromise = this.page.waitForResponse(response =>
            response.url().includes('/Infer/api/members/save') && response.status() === 200
        );

        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.editProfileButton.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(absolutePath);

        const saveResponse = await imageSavePromise;
        expect(saveResponse.ok()).toBeTruthy();
        await expect(this.page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 15000 });
    }

    async verifyProfileDetails(name: string, orgName: string) {
        await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 20000 });
        await expect(this.page.getByText(orgName).first()).toBeVisible({ timeout: 10000 });
    }
}
