import { Page, TestInfo } from '@playwright/test';

export class ReporterHelper {
    private screenshotCount = 0;
    
    constructor(private page: Page, private testInfo: TestInfo) {}

    /**
     * Capture a screenshot and attach it to the test context.
     * Respects the maximum limit of 3-5 screenshots per test to avoid bloat.
     */
    async capture(type: 'start' | 'milestone' | 'validation' | 'failure', description: string) {
        if (this.screenshotCount >= 5 && type !== 'failure') {
            // Adhere to screenshot rules: max 3-5 screenshots unless failure occurs
            return;
        }
        try {
            await this.page.waitForLoadState('load').catch(() => {});
            await this.page.waitForTimeout(500); // 500ms stabilization wait
            const screenshot = await this.page.screenshot({ fullPage: false });
            await this.testInfo.attach(`[${type.toUpperCase()}] ${description}`, {
                body: screenshot,
                contentType: 'image/png'
            });
            this.screenshotCount++;
        } catch (e) {
            console.error(`Failed to capture [${type}] screenshot:`, e);
        }
    }

    /**
     * Logs and captures a screenshot for a major workflow milestone.
     */
    async milestone(description: string) {
        await this.capture('milestone', description);
    }

    /**
     * Logs and captures a screenshot for a validation check point.
     */
    async validation(description: string) {
        await this.capture('validation', description);
    }
}
