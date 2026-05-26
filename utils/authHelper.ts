import { Page } from '@playwright/test';

/**
 * Helper utility to extract the JWT Authorization token from the browser page.
 */
export class AuthHelper {
    /**
     * Scans localStorage, sessionStorage, and active headers to retrieve the active JWT.
     * @param page Playwright Page instance
     */
    public static async getAuthToken(page: Page, fallbackToken?: string): Promise<string> {
        if (fallbackToken && fallbackToken.startsWith('Bearer ')) {
            return fallbackToken;
        }

        // 1. Scan browser storage (including nested JSON keys)
        const tokenFromStorage = await page.evaluate(() => {
            const scanStorage = (storage: Storage): string | null => {
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key) {
                        const value = storage.getItem(key);
                        if (!value) continue;

                        if (value.startsWith('eyJ') || value.includes('Bearer')) {
                            return value.startsWith('Bearer ') ? value : `Bearer ${value}`;
                        }

                        // Try to parse as JSON to see if token is nested
                        try {
                            const parsed = JSON.parse(value);
                            if (parsed && typeof parsed === 'object') {
                                for (const subKey in parsed) {
                                    const subVal = parsed[subKey];
                                    if (typeof subVal === 'string' && (subVal.startsWith('eyJ') || subVal.includes('Bearer'))) {
                                        return subVal.startsWith('Bearer ') ? subVal : `Bearer ${subVal}`;
                                    }
                                }
                            }
                        } catch (e) {
                            // Ignore non-JSON strings
                        }
                    }
                }
                return null;
            };

            return scanStorage(localStorage) || scanStorage(sessionStorage);
        });

        if (tokenFromStorage) {
            return tokenFromStorage;
        }

        // 2. Scan active context cookies
        try {
            const cookies = await page.context().cookies();
            for (const cookie of cookies) {
                if (cookie.value && (cookie.value.startsWith('eyJ') || cookie.value.includes('Bearer'))) {
                    return cookie.value.startsWith('Bearer ') ? cookie.value : `Bearer ${cookie.value}`;
                }
            }
        } catch (e) {
            // Ignore cookie errors
        }

        // 3. Fallback: Catch token from outgoing API requests
        try {
            const interceptedToken = await new Promise<string>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    page.off('request', requestHandler);
                    reject(new Error('Authentication token could not be extracted from storage, cookies, or network headers.'));
                }, 5000);

                function requestHandler(request: any) {
                    const authHeader = request.headers()['authorization'];
                    if (authHeader && authHeader.startsWith('Bearer ')) {
                        clearTimeout(timeoutId);
                        page.off('request', requestHandler);
                        resolve(authHeader);
                    }
                }

                page.on('request', requestHandler);
            });

            return interceptedToken;
        } catch (e: any) {
            throw new Error('Authentication token could not be extracted from storage, cookies, or network headers.');
        }
    }
}
