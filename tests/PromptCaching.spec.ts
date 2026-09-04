import { expect, test } from '../fixtures/base';
import { cachePrompts } from '../data/cachePrompts';
import { textGenerationModelsForRun } from '../data/playground/models';
import { validateCacheSequence } from './cache/cacheTestSupport';

test.describe('Prompt cache validation', () => {
    // Ten requests may each wait up to three minutes for a cold/queued large model.
    test.setTimeout(2100000);
    test.describe.configure({ retries: 0 });
    for (const model of textGenerationModelsForRun) test(`${model.displayName}: TC-CACHE-PROMPT`, async ({ authenticate, page, playgroundPage }, testInfo) => {
        await authenticate(); await playgroundPage.open();
        expect(await playgroundPage.selectModel(model), `${model.displayName} must be selectable`).toBeTruthy();
        await validateCacheSequence(page, model, 'prompt', cachePrompts.prompt, testInfo);
    });
});
