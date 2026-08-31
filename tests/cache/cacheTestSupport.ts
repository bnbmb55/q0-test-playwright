import { expect, Page, Response } from '@playwright/test';
import { CachePrompt, CacheType } from '../../data/cachePrompts';
import { PlaygroundModel } from '../../data/playground/models';

type MetricValue = string | number | boolean;
type CacheStatus = 'hit' | 'miss' | 'unknown';

export type InferenceMetrics = {
    cacheStatus: CacheStatus;
    cacheEvidence: 'explicit-metric' | 'cached-response-shape' | 'none';
    cachedTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    ttftMs?: number;
    backendTotalLatencyMs?: number;
    clientTotalLatencyMs: number;
    tokensPerSecond?: number;
    cost?: number;
    responseText: string;
    uiCacheIndicator?: string;
    uiInferenceTime?: string;
    rawTelemetry: Record<string, MetricValue>;
};

export type CacheEvidence = {
    testCase: string;
    model: string;
    cacheType: CacheType;
    baselinePrompt: string;
    verificationPrompt: string;
    scenario: string;
    requestNumber: number;
    telemetryStatus: 'applied' | 'not-applied' | 'inconclusive';
    functionalStatus: 'passed' | 'failed';
    httpStatus: number;
    historyInputObservation?: string;
    baseline: InferenceMetrics;
    verification: InferenceMetrics;
};

type Submission = { httpStatus: number; metrics: InferenceMetrics };
type TestInfo = { attach: (name: string, options: { body: Buffer; contentType: string }) => Promise<void> };

export async function validateCacheSequence(
    page: Page,
    model: PlaygroundModel,
    cacheType: CacheType,
    prompts: CachePrompt[],
    testInfo: TestInfo
): Promise<void> {
    const submissions: Submission[] = [];
    const evidence: CacheEvidence[] = [];

    for (const prompt of prompts) {
        const current = await submit(page, prompt.prompt);
        submissions.push(current);
        if (prompt.number === 1) continue; // First request establishes the cache/session state.

        const first = submissions[0];
        const previous = submissions.at(-2)!;
        const functionalStatus = hasUsableResponse(current.metrics.responseText) ? 'passed' : 'failed';
        const telemetryStatus = current.metrics.cacheStatus === 'hit' ? 'applied'
            : current.metrics.cacheStatus === 'miss' ? 'not-applied' : 'inconclusive';
        const historyInputObservation = cacheType === 'kv'
            ? describeHistoryInput(previous.metrics, current.metrics)
            : undefined;
        const row: CacheEvidence = {
            testCase: `TC-CACHE-${cacheType.toUpperCase()}-${String(prompt.number).padStart(2, '0')}`,
            model: model.displayName,
            cacheType,
            baselinePrompt: prompts[0].prompt,
            verificationPrompt: prompt.prompt,
            scenario: prompt.validation,
            requestNumber: prompt.number,
            telemetryStatus,
            functionalStatus,
            httpStatus: current.httpStatus,
            historyInputObservation,
            baseline: first.metrics,
            verification: current.metrics
        };
        evidence.push(row);
        // The reporter reads this structured line. Keep raw SSE telemetry in the
        // attachment only; logging it for every streamed token makes CI output
        // and HTML reports unnecessarily large.
        const reportRow = {
            ...row,
            baseline: { ...row.baseline, responseText: '[see JSON attachment]', rawTelemetry: {} },
            verification: { ...row.verification, responseText: '[see JSON attachment]', rawTelemetry: {} }
        };
        console.log(`[CACHE RESULT] ${JSON.stringify(reportRow)}`);
        await testInfo.attach(`cache-${cacheType}-request-${prompt.number}.json`, {
            body: Buffer.from(JSON.stringify(row, null, 2)), contentType: 'application/json'
        });
    }

    expect(submissions[0]?.httpStatus, 'The first request must complete successfully.').toBeLessThan(400);
    // "Unknown" means this endpoint did not expose cache telemetry. Keep that
    // evidence in the report as INCONCLUSIVE and continue the full matrix;
    // fail only a demonstrable request/model/cache failure.
    const failures = evidence.filter((item) => item.httpStatus >= 400 || item.functionalStatus === 'failed' || item.telemetryStatus === 'not-applied')
        .map((item) => item.httpStatus >= 400 ? `${item.testCase}: HTTP ${item.httpStatus}`
            : item.functionalStatus === 'failed' ? `${item.testCase}: empty/refusal response`
                : `${item.testCase}: backend cache miss`);
    expect(failures, `Cache validation failed for ${model.displayName} (${cacheType}).`).toEqual([]);
}

async function submit(page: Page, prompt: string): Promise<Submission> {
    const input = page.getByPlaceholder('Type something...').or(page.getByPlaceholder('Type your prompt here...')).or(page.locator('textarea')).first();
    await expect(input).toBeVisible({ timeout: 15000 });
    await expect(input).toBeEditable({ timeout: 10000 });
    await input.fill(prompt);
    const startedAt = Date.now();
    // Cold starts and queueing for the larger hosted models can legitimately
    // exceed one minute. This is a response-header wait, not a fixed sleep.
    const responsePromise = page.waitForResponse(isInferenceResponse, { timeout: 180000 });
    await input.press('Enter');
    const response = await responsePromise;
    const body = await response.text().catch(() => '');
    const uiMetrics = await readUiMetrics(page);
    return { httpStatus: response.status(), metrics: extractMetrics(response, body, Date.now() - startedAt, uiMetrics) };
}

function isInferenceResponse(response: Response): boolean {
    if (response.request().method() !== 'POST' || !/\/(inference|api|playground)\//i.test(response.url())) return false;
    return true;
}

function hasUsableResponse(text: string): boolean {
    return text.trim().length > 0 && !/^(i'?m sorry|i cannot|i can't)\b/i.test(text.trim());
}

function describeHistoryInput(previous: InferenceMetrics, current: InferenceMetrics): string {
    if (previous.inputTokens === undefined || previous.outputTokens === undefined || current.inputTokens === undefined) {
        return 'Not observable: one or more token fields were absent.';
    }
    const lowerBound = previous.inputTokens + previous.outputTokens;
    return current.inputTokens >= lowerBound
        ? `History growth observed: ${current.inputTokens} input tokens; previous input + output was ${lowerBound}.`
        : `History growth not visible in API totals: ${current.inputTokens} input tokens; previous input + output was ${lowerBound}.`;
}

function extractMetrics(response: Response, body: string, clientTotalLatencyMs: number, uiMetrics: Pick<InferenceMetrics, 'uiCacheIndicator' | 'uiInferenceTime'>): InferenceMetrics {
    const parsedBody = parseResponseBody(body);
    const telemetry = flattenTelemetry({ headers: response.headers(), body: parsedBody });
    const cacheValue = findMetric(telemetry, ['cache_hit', 'cachehit', 'cache_status', 'cachestatus', 'cache_result', 'cachetype']);
    const explicitCacheStatus = normaliseCacheStatus(cacheValue);
    const cachedResponseShape = isCachedResponseShape(telemetry);
    const inputTokens = findNumber(telemetry, ['input_tokens', 'num_input_tokens', 'prompt_tokens']);
    // Uncached Q0 streaming responses report num_output_tokens: 1 on each
    // chunk. Sum those chunks to report the real generated-token total; a
    // cached compact response has one event and therefore remains unchanged.
    const outputTokens = sumNumbers(telemetry, ['num_output_tokens', 'output_tokens'])
        ?? findNumber(telemetry, ['completion_tokens']);
    const backendTotalLatencyMs = findNumber(telemetry, ['total_latency_ms', 'backend_latency_ms', 'latency_ms']);
    return {
        cacheStatus: explicitCacheStatus !== 'unknown' ? explicitCacheStatus : cachedResponseShape ? 'hit' : 'unknown',
        cacheEvidence: explicitCacheStatus !== 'unknown' ? 'explicit-metric' : cachedResponseShape ? 'cached-response-shape' : 'none',
        cachedTokens: findNumber(telemetry, ['cached_tokens', 'cache_read_input_tokens', 'cache_tokens', 'kv_cache_tokens']),
        inputTokens, outputTokens,
        ttftMs: findNumber(telemetry, ['ttft_ms', 'backend_ttft_ms', 'time_to_first_token_ms']),
        backendTotalLatencyMs, clientTotalLatencyMs,
        tokensPerSecond: findNumber(telemetry, ['tokens_per_second', 'output_tokens_per_second', 'tok_per_sec']) ?? (outputTokens && backendTotalLatencyMs ? outputTokens / (backendTotalLatencyMs / 1000) : undefined),
        cost: findNumber(telemetry, ['total_cost', 'request_cost', 'cost']),
        responseText: extractResponseText(parsedBody), ...uiMetrics, rawTelemetry: telemetry
    };
}

function extractResponseText(value: unknown): string {
    if (Array.isArray(value)) return value.map(extractResponseText).join('');
    if (!value || typeof value !== 'object') return '';
    const event = value as Record<string, unknown>;
    const direct = typeof event.text_output === 'string' ? event.text_output : '';
    const delta = Array.isArray(event.choices) ? event.choices.map((choice) => {
        const content = (choice as { delta?: { content?: unknown } }).delta?.content;
        return typeof content === 'string' ? content : '';
    }).join('') : '';
    return direct || delta;
}

function isCachedResponseShape(telemetry: Record<string, MetricValue>): boolean {
    const keys = Object.keys(telemetry).map((path) => path.toLowerCase());
    return keys.some((key) => key.endsWith('.text_output') || /\.choices\[\d+\]\.delta\.content$/.test(key))
        && !keys.some((key) => key.endsWith('.model_name') || key.endsWith('.model_version'))
        && !keys.some((key) => /backend_(latency|compute|queue|ttft)_ms$/.test(key));
}

async function readUiMetrics(page: Page): Promise<Pick<InferenceMetrics, 'uiCacheIndicator' | 'uiInferenceTime'>> {
    const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const last = (expression: RegExp) => [...text.matchAll(expression)].map((match) => match[0].trim()).at(-1);
    return {
        uiCacheIndicator: last(/(?:cached\s+inference\s+time|cache\s+(?:hit|status)|cached\s+tokens)\s*:\s*[^\r\n]+/ig),
        uiInferenceTime: last(/(?<!cached\s)inference\s+time\s*:\s*[^\r\n]+/ig)
    };
}

function parseResponseBody(body: string): unknown {
    const events: unknown[] = [];
    for (const line of body.split('\n')) if (line.startsWith('data:')) try { events.push(JSON.parse(line.replace(/^data:\s*/, ''))); } catch { /* [DONE] */ }
    if (events.length) return events;
    try { return JSON.parse(body); } catch { return {}; }
}

function flattenTelemetry(value: unknown, path = '', result: Record<string, MetricValue> = {}): Record<string, MetricValue> {
    if (Array.isArray(value)) value.forEach((item, index) => flattenTelemetry(item, `${path}[${index}]`, result));
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value as Record<string, unknown>)) flattenTelemetry(child, path ? `${path}.${key}` : key, result);
    else if (['string', 'number', 'boolean'].includes(typeof value)) result[path] = value as MetricValue;
    return result;
}

function findMetric(telemetry: Record<string, MetricValue>, names: string[]): MetricValue | undefined {
    return Object.entries(telemetry).find(([path]) => names.some((name) => path.toLowerCase().replace(/[^a-z0-9_]/g, '_').includes(name)))?.[1];
}
function findNumber(telemetry: Record<string, MetricValue>, names: string[]): number | undefined { const value = findMetric(telemetry, names); const number = Number(value); return value !== undefined && Number.isFinite(number) ? number : undefined; }
function sumNumbers(telemetry: Record<string, MetricValue>, names: string[]): number | undefined {
    const values = Object.entries(telemetry)
        .filter(([path]) => names.some((name) => path.toLowerCase().replace(/[^a-z0-9_]/g, '_').endsWith(name)))
        .map(([, value]) => Number(value))
        .filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}
function normaliseCacheStatus(value: MetricValue | undefined): CacheStatus { if (value === true || value === 1 || /^(hit|true|applied)$/i.test(String(value))) return 'hit'; if (value === false || value === 0 || /^(miss|false|not.?applied)$/i.test(String(value))) return 'miss'; return 'unknown'; }
