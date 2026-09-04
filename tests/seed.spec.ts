import { test, expect } from '../fixtures/base';

test.describe('Playwright Test Agent seed', () => {
  test('authenticated Playground session', async ({ authenticate, playgroundPage, page }) => {
    await authenticate();
    await playgroundPage.open();
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible();
  });
});
