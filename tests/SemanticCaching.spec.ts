import { expect, test } from '../fixtures/base';
import { cachePrompts } from '../data/cachePrompts';
import { textGenerationModels } from '../data/playground/models';
import { validateCacheSequence } from './cache/cacheTestSupport';

test.describe('Semantic cache validation', () => {
    test.setTimeout(2100000);
    test.describe.configure({ retries: 0 });
    for (const model of textGenerationModels) test(`${model.displayName}: TC-CACHE-SEMANTIC`, async ({ authenticate, page, playgroundPage }, testInfo) => {
        await authenticate(); await playgroundPage.open();
        expect(await playgroundPage.selectModel(model), `${model.displayName} must be selectable`).toBeTruthy();
        await validateCacheSequence(page, model, 'semantic', cachePrompts.semantic, testInfo);
    });
});
