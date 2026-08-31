import { Reporter, TestCase, TestResult, FullResult, FullConfig, Suite, TestStep } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

interface ProcessedStep {
    title: string;
    duration: number;
    status: 'passed' | 'failed' | 'skipped';
    error?: string;
    steps: ProcessedStep[];
}

interface ProcessedAttachment {
    name: string;
    contentType: string;
    path: string;
}

interface ProcessedTest {
    id: string;
    title: string;
    suiteTitle: string;
    file: string;
    browser: string;
    status: 'passed' | 'failed' | 'skipped' | 'flaky';
    duration: number;
    steps: ProcessedStep[];
    error?: string;
    attachments: ProcessedAttachment[];
    logs: string[];
}

interface GuardrailEvidence {
    testCaseId: string;
    profile?: string;
    policy: string;
    model: string;
    expectedOutcome: 'allow' | 'block' | 'redact';
    actualOutcome: 'allow' | 'block' | 'redact' | 'inconclusive';
    httpStatus: number;
    guardrailBlockType?: string;
    renderedResponseLength: number;
    latencyMs: number;
}

interface GuardrailSummary {
    status: 'COMPLIANT' | 'NON-COMPLIANT' | 'NOT EVALUATED';
    total: number;
    compliant: number;
    nonCompliant: number;
    evidence: GuardrailEvidence[];
    models: GuardrailModelSummary[];
}

interface GuardrailModelSummary {
    model: string;
    profile: string;
    total: number;
    compliant: number;
    nonCompliant: number;
    status: 'PASSED' | 'FAILED';
}

interface CacheEvidence {
    testCase?: string;
    model: string;
    cacheType: 'prompt' | 'semantic' | 'prefix' | 'kv';
    baselinePrompt?: string;
    verificationPrompt?: string;
    scenario?: string;
    requestNumber?: number;
    historyInputObservation?: string;
    telemetryStatus: 'applied' | 'not-applied' | 'inconclusive';
    functionalStatus?: 'passed' | 'failed';
    httpStatus: number;
    baseline?: CacheMetrics;
    verification?: CacheMetrics;
}

interface CacheMetrics {
    cacheStatus: 'hit' | 'miss' | 'unknown';
    cacheEvidence?: 'explicit-metric' | 'cached-response-shape' | 'none';
    cachedTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    ttftMs?: number;
    backendTotalLatencyMs?: number;
    clientTotalLatencyMs: number;
    tokensPerSecond?: number;
    cost?: number;
    responseText?: string;
    responseMatchesExpected?: boolean;
    uiCacheIndicator?: string;
    uiInferenceTime?: string;
    rawTelemetry: Record<string, string | number | boolean>;
}

interface CacheSummary {
    status: 'APPLIED' | 'NOT APPLIED' | 'INCONCLUSIVE' | 'NOT EVALUATED';
    total: number;
    applied: number;
    notApplied: number;
    inconclusive: number;
    evidence: CacheEvidence[];
}

class CustomReporter implements Reporter {
    private config!: FullConfig;
    private startTime!: number;
    private tests: ProcessedTest[] = [];

    onBegin(config: FullConfig, suite: Suite) {
        this.config = config;
        this.startTime = Date.now();
        this.tests = [];
    }

    onTestEnd(test: TestCase, result: TestResult) {
        const testFile = path.basename(test.location.file);
        const browserName = test.parent.project()?.name || 'unknown';

        // Categorize the test status according to expected Playwright outcomes
        let status: 'passed' | 'failed' | 'skipped' | 'flaky' = 'passed';
        const outcome = test.outcome();
        if (outcome === 'expected') status = 'passed';
        else if (outcome === 'unexpected') status = 'failed';
        else if (outcome === 'flaky') status = 'flaky';
        else if (outcome === 'skipped') status = 'skipped';

        // Extract steps recursively
        const steps = this.processSteps(result.steps);

        // Gather error message if any
        let errorMsg = '';
        if (result.errors && result.errors.length > 0) {
            errorMsg = result.errors.map(e => e.stack || e.message).join('\n\n');
        } else if (result.error) {
            errorMsg = result.error.stack || result.error.message || '';
        }

        // Collect logs
        const logs: string[] = [];
        if (result.stdout && result.stdout.length > 0) {
            logs.push(...result.stdout.map(b => b.toString()));
        }
        if (result.stderr && result.stderr.length > 0) {
            logs.push(...result.stderr.map(b => b.toString()));
        }

        this.tests.push({
            id: test.id,
            title: test.title,
            suiteTitle: test.parent.title || 'Root',
            file: testFile,
            browser: browserName,
            status,
            duration: result.duration,
            steps,
            error: errorMsg,
            attachments: [], // Will be filled in onEnd once directories are established
            logs
        });

        // Store temp reference to the raw attachments so we can copy them in onEnd
        (this.tests[this.tests.length - 1] as any).rawAttachments = result.attachments;
    }

    private processSteps(steps: TestStep[]): ProcessedStep[] {
        return steps.map(s => {
            let status: 'passed' | 'failed' | 'skipped' = 'passed';
            if (s.error) status = 'failed';

            return {
                title: s.title,
                duration: s.duration,
                status,
                error: s.error?.stack || s.error?.message,
                steps: s.steps ? this.processSteps(s.steps) : []
            };
        });
    }

    async onEnd(result: FullResult) {
        const endTime = Date.now();
        const duration = endTime - this.startTime;

        // Establish output directory
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportDir = path.join(process.cwd(), 'reports', `report-${timestamp}`);
        const assetsDir = path.join(reportDir, 'assets');

        fs.mkdirSync(assetsDir, { recursive: true });

        // Process attachments and copy them
        for (const test of this.tests) {
            const rawAttachments = (test as any).rawAttachments || [];
            for (const att of rawAttachments) {
                const safeFileName = `${test.id.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${att.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const destPath = path.join(assetsDir, safeFileName);
                if (att.path && fs.existsSync(att.path)) {
                    try {
                        fs.copyFileSync(att.path, destPath);

                        test.attachments.push({
                            name: att.name,
                            contentType: att.contentType,
                            path: `./assets/${safeFileName}`
                        });
                    } catch (e) {
                        console.error(`Failed to copy attachment: ${att.path}`, e);
                    }
                } else if (att.body) {
                    try {
                        fs.writeFileSync(destPath, att.body);
                        test.attachments.push({
                            name: att.name,
                            contentType: att.contentType,
                            path: `./assets/${safeFileName}`
                        });
                    } catch (e) {
                        console.error(`Failed to write attachment: ${att.name}`, e);
                    }
                }
            }
        }

        // Aggregate statistics
        const total = this.tests.length;
        const passed = this.tests.filter(t => t.status === 'passed').length;
        const failed = this.tests.filter(t => t.status === 'failed').length;
        const skipped = this.tests.filter(t => t.status === 'skipped').length;
        const flaky = this.tests.filter(t => t.status === 'flaky').length;
        const passRate = total > 0 ? Math.round(((passed + flaky) / total) * 100) : 0;

        // Group tests by file for module-wise summary
        const fileSummaries: { [file: string]: { total: number; passed: number; failed: number; skipped: number; flaky: number } } = {};
        const browserSummaries: { [browser: string]: { total: number; passed: number; failed: number; skipped: number; flaky: number } } = {};

        for (const test of this.tests) {
            if (!fileSummaries[test.file]) {
                fileSummaries[test.file] = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };
            }
            fileSummaries[test.file].total++;
            fileSummaries[test.file][test.status]++;

            if (!browserSummaries[test.browser]) {
                browserSummaries[test.browser] = { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 };
            }
            browserSummaries[test.browser].total++;
            browserSummaries[test.browser][test.status]++;
        }

        // Environment details
        const envDetails = {
            os: `${os.type()} ${os.release()} (${os.arch()})`,
            playwrightVersion: require('@playwright/test/package.json').version,
            nodeVersion: process.version,
            baseUrl: this.config.projects[0]?.use?.baseURL || 'N/A',
            executionMode: this.config.fullyParallel ? 'Parallel' : 'Serial',
            workers: this.config.workers
        };

        const guardrailSummary = this.summarizeGuardrails();
        const cacheSummary = this.summarizeCaches();
        fs.writeFileSync(
            path.join(reportDir, 'guardrail-compliance.json'),
            JSON.stringify(guardrailSummary, null, 2),
            'utf-8'
        );
        fs.writeFileSync(path.join(reportDir, 'cache-compliance.json'), JSON.stringify(cacheSummary, null, 2), 'utf-8');

        // Render HTML
        const html = this.generateHtml({
            tests: this.tests,
            stats: { total, passed, failed, skipped, flaky, passRate, duration, startTime: this.startTime, endTime },
            fileSummaries,
            browserSummaries,
            envDetails,
            guardrailSummary,
            cacheSummary
        });

        const reportPath = path.join(reportDir, 'index.html');
        fs.writeFileSync(reportPath, html, 'utf-8');
        console.log(`\n======================================================`);
        console.log(`📊 Custom HTML Report successfully generated at:`);
        console.log(`   ${reportPath}`);
        console.log(`======================================================\n`);

        // Automatically open the report in the browser
        // Do not auto-open the report: browser spawning fails in CI and other
        // restricted runners, although the report has already been generated.
    }

    private async openReport(reportPath: string) {
        const cmd = process.platform === 'win32' ? `start "" "${reportPath}"` :
                    process.platform === 'darwin' ? `open "${reportPath}"` :
                    `xdg-open "${reportPath}"`;
        return new Promise<void>((resolve) => {
            exec(cmd, (err) => {
                if (err) {
                    console.error(`Failed to auto-open the HTML report: ${err.message}`);
                } else {
                    console.log(`🚀 Report opened automatically in your default browser.`);
                }
                resolve();
            });
        });
    }

    private summarizeGuardrails(): GuardrailSummary {
        const latestEvidence = new Map<string, GuardrailEvidence>();
        for (const test of this.tests) {
            for (const log of test.logs) {
                const matches = log.matchAll(/\[GUARDRAIL RESULT\]\s+(\{.*\})/g);
                for (const match of matches) {
                    try {
                        const evidence = JSON.parse(match[1]) as GuardrailEvidence;
                        if (!evidence.testCaseId || !evidence.model) continue;
                        // Retries can emit multiple entries for one policy case; retain the final result.
                        latestEvidence.set(`${evidence.model}:${evidence.testCaseId}`, evidence);
                    } catch {
                        // Ignore non-structured legacy console logs.
                    }
                }
            }
        }

        const evidence = [...latestEvidence.values()];
        const compliant = evidence.filter((item) => item.actualOutcome === item.expectedOutcome).length;
        const nonCompliant = evidence.length - compliant;
        const models = [...new Map(evidence.map((item) => [item.model, item])).values()].map(({ model, profile }) => {
            const modelEvidence = evidence.filter((item) => item.model === model);
            const modelCompliant = modelEvidence.filter((item) => item.actualOutcome === item.expectedOutcome).length;
            const modelNonCompliant = modelEvidence.length - modelCompliant;
            return {
                model,
                profile: profile ?? 'not reported',
                total: modelEvidence.length,
                compliant: modelCompliant,
                nonCompliant: modelNonCompliant,
                status: modelNonCompliant === 0 ? 'PASSED' : 'FAILED'
            } as GuardrailModelSummary;
        });
        const includesGuardrailSuite = this.tests.some((test) => test.file === 'Guardrails.spec.ts');
        return {
            status: evidence.length === 0
                ? 'NOT EVALUATED'
                : nonCompliant === 0 ? 'COMPLIANT' : 'NON-COMPLIANT',
            total: evidence.length,
            compliant,
            nonCompliant: includesGuardrailSuite ? nonCompliant : 0,
            evidence,
            models
        };
    }

    private summarizeCaches(): CacheSummary {
        const latestEvidence = new Map<string, CacheEvidence>();
        for (const test of this.tests) {
            for (const log of test.logs) {
                for (const match of log.matchAll(/\[CACHE RESULT\]\s+(\{.*\})/g)) {
                    try {
                        const evidence = JSON.parse(match[1]) as CacheEvidence;
                        // Keep every request comparison. A cache sequence has one
                        // evidence row per request after the warm-up request; using
                        // only model/cache type previously overwrote rows 2-9 with
                        // request 10 and made the report look healthier than it was.
                        if (evidence.model && evidence.cacheType) {
                            latestEvidence.set(`${evidence.model}:${evidence.cacheType}:${evidence.testCase ?? evidence.requestNumber ?? 'latest'}`, evidence);
                        }
                    } catch { /* ignore non-structured legacy logs */ }
                }
            }
        }
        const evidence = [...latestEvidence.values()];
        const applied = evidence.filter((item) => item.telemetryStatus === 'applied').length;
        const notApplied = evidence.filter((item) => item.telemetryStatus === 'not-applied').length;
        const inconclusive = evidence.filter((item) => item.telemetryStatus === 'inconclusive').length;
        return {
            status: evidence.length === 0 ? 'NOT EVALUATED' : notApplied > 0 ? 'NOT APPLIED' : inconclusive > 0 ? 'INCONCLUSIVE' : 'APPLIED',
            total: evidence.length,
            applied,
            notApplied,
            inconclusive,
            evidence
        };
    }

    private generateHtml(data: {
        tests: ProcessedTest[];
        stats: { total: number; passed: number; failed: number; skipped: number; flaky: number; passRate: number; duration: number; startTime: number; endTime: number };
        fileSummaries: { [file: string]: { total: number; passed: number; failed: number; skipped: number; flaky: number } };
        browserSummaries: { [browser: string]: { total: number; passed: number; failed: number; skipped: number; flaky: number } };
        envDetails: { os: string; playwrightVersion: string; nodeVersion: string; baseUrl: string; executionMode: string; workers: number };
        guardrailSummary: GuardrailSummary;
        cacheSummary: CacheSummary;
    }): string {
        const formatDuration = (ms: number): string => {
            const sec = (ms / 1000).toFixed(2);
            if (ms < 1000) return `${ms}ms`;
            if (ms < 60000) return `${sec}s`;
            const min = Math.floor(ms / 60000);
            const extraSec = ((ms % 60000) / 1000).toFixed(0);
            return `${min}m ${extraSec}s`;
        };

        const startDate = new Date(data.stats.startTime).toLocaleString();
        const endDate = new Date(data.stats.endTime).toLocaleString();

        // SVG Donut Chart Calculation
        const passedVal = data.stats.passed + data.stats.flaky;
        const failedVal = data.stats.failed;
        const skippedVal = data.stats.skipped;
        const totalVal = data.stats.total || 1;

        const pPercent = (passedVal / totalVal) * 100;
        const fPercent = (failedVal / totalVal) * 100;
        const sPercent = (skippedVal / totalVal) * 100;

        // Donut offsets
        const radius = 50;
        const circumference = 2 * Math.PI * radius; // ~314.16
        const pDash = (pPercent / 100) * circumference;
        const fDash = (fPercent / 100) * circumference;
        const sDash = (sPercent / 100) * circumference;

        const pOffset = 0;
        const fOffset = -pDash;
        const sOffset = -(pDash + fDash);

        const guardrailColour = data.guardrailSummary.status === 'COMPLIANT'
            ? 'var(--success)'
            : data.guardrailSummary.status === 'NON-COMPLIANT' ? 'var(--danger)' : 'var(--warning)';
        const guardrailRows = data.guardrailSummary.evidence.map((item) => `
            <tr>
                <td>${this.escapeHtml(item.model)}</td>
                <td>${this.escapeHtml(item.profile ?? 'not reported')}</td>
                <td>${this.escapeHtml(item.testCaseId)}</td>
                <td>${this.escapeHtml(item.policy)}</td>
                <td>${this.escapeHtml(item.expectedOutcome)}</td>
                <td class="${item.actualOutcome === item.expectedOutcome ? 'text-success' : 'text-danger'}">${this.escapeHtml(item.actualOutcome)}</td>
                <td>${item.httpStatus}</td>
                <td>${this.escapeHtml(item.guardrailBlockType || 'not reported')}</td>
            </tr>`).join('');
        const guardrailModelRows = data.guardrailSummary.models.map((item) => `
            <tr>
                <td>${this.escapeHtml(item.model)}</td>
                <td>${this.escapeHtml(item.profile)}</td>
                <td>${item.total}</td>
                <td class="text-success">${item.compliant}</td>
                <td class="${item.nonCompliant ? 'text-danger' : ''}">${item.nonCompliant}</td>
                <td class="${item.status === 'PASSED' ? 'text-success' : 'text-danger'}">${item.status}</td>
            </tr>`).join('');
        const guardrailPanel = `
            <div class="panel" style="margin: 24px auto; max-width: 1400px; border-top: 4px solid ${guardrailColour};">
                <h3 class="panel-title">Guardrail Compliance Verdict: <span style="color: ${guardrailColour};">${data.guardrailSummary.status}</span></h3>
                <p style="color: var(--text-secondary); margin-bottom: 16px;">
                    ${data.guardrailSummary.status === 'NOT EVALUATED'
                        ? 'No structured guardrail evidence was emitted. This report cannot claim that guardrails are working; use the deterministic Guardrails.spec.ts suite.'
                        : `${data.guardrailSummary.compliant}/${data.guardrailSummary.total} policy decisions matched expectation; ${data.guardrailSummary.nonCompliant} did not.`}
                    <a href="./guardrail-compliance.json" download class="download-link" style="margin-left: 12px;">Download compliance JSON</a>
                </p>
                ${guardrailModelRows ? `<h4 style="margin: 20px 0 10px;">Per-model result</h4><div style="overflow-x: auto;"><table><thead><tr><th>Model</th><th>Backend profile</th><th>Executed</th><th>Passed</th><th>Failed</th><th>Status</th></tr></thead><tbody>${guardrailModelRows}</tbody></table></div>` : ''}
                ${guardrailRows ? `<h4 style="margin: 20px 0 10px;">Policy evidence</h4><div style="overflow-x: auto;"><table><thead><tr><th>Model</th><th>Backend profile</th><th>Case</th><th>Policy</th><th>Expected</th><th>Actual</th><th>HTTP</th><th>Block type</th></tr></thead><tbody>${guardrailRows}</tbody></table></div>` : ''}
            </div>`;
        const cacheColour = data.cacheSummary.status === 'APPLIED'
            ? 'var(--success)'
            : data.cacheSummary.status === 'NOT APPLIED' ? 'var(--danger)' : 'var(--warning)';
        const cacheDecision = data.cacheSummary.status === 'APPLIED'
            ? 'Caching is validated: every evaluated verification request reported a cache hit through an explicit API metric or the documented Q0 cached-response shape.'
            : data.cacheSummary.status === 'NOT APPLIED'
                ? 'Caching is not working for at least one evaluated request: the backend reported a miss or zero cached tokens.'
                : data.cacheSummary.status === 'INCONCLUSIVE'
                    ? 'Caching cannot be confirmed: inference succeeded, but the backend did not return an explicit cache decision or the documented Q0 cached-response shape.'
                    : 'No cache evidence was collected.';
        const cacheRows = data.cacheSummary.evidence.map((item) => {
            const first = item.baseline;
            const second = item.verification;
            const display = (value: number | undefined, suffix = '') => value === undefined ? 'not reported' : `${value}${suffix}`;
            const label = item.functionalStatus === 'failed' ? 'WRONG RESPONSE'
                : item.telemetryStatus === 'applied' ? 'VALIDATED' : item.telemetryStatus === 'not-applied' ? 'NOT WORKING' : 'NOT OBSERVABLE';
            const colour = item.functionalStatus === 'failed' || item.telemetryStatus === 'not-applied' ? 'text-danger'
                : item.telemetryStatus === 'applied' ? 'text-success' : 'text-warning';
            const evidenceSource = second?.cacheEvidence === 'explicit-metric' ? 'explicit API metric'
                : second?.cacheEvidence === 'cached-response-shape' ? 'Q0 cached-response shape'
                    : 'none';
            const prompt = item.baselinePrompt === item.verificationPrompt
                ? item.baselinePrompt ?? 'not recorded'
                : `1st: ${item.baselinePrompt ?? 'not recorded'}\n2nd: ${item.verificationPrompt ?? 'not recorded'}`;
            const observation = `${item.scenario ?? `2nd request: ${second?.cacheStatus ?? 'unknown'} (${evidenceSource})`}${item.historyInputObservation ? ` ${item.historyInputObservation}` : ''} Response check: ${item.functionalStatus ?? 'not recorded'}.`;
            const issue = item.httpStatus >= 400 ? `HTTP ${item.httpStatus}`
                : item.functionalStatus === 'failed' ? 'Response did not meet the scenario expectation.'
                    : item.telemetryStatus === 'not-applied' ? 'Backend reported a cache miss.'
                        : item.telemetryStatus === 'inconclusive' ? 'API did not expose cache-hit evidence.' : '—';
            return `<tr><td>${this.escapeHtml(item.testCase ?? `TC-CACHE-${item.cacheType.toUpperCase()}`)}</td><td>${this.escapeHtml(item.model)}</td><td style="white-space: pre-wrap; min-width: 280px;">${this.escapeHtml(prompt)}</td><td>${this.escapeHtml(item.cacheType)} cache, same browser/backend session</td><td>${display(first?.backendTotalLatencyMs ?? first?.clientTotalLatencyMs, ' ms')}</td><td>${display(second?.backendTotalLatencyMs ?? second?.clientTotalLatencyMs, ' ms')}</td><td>${display(first?.inputTokens)}</td><td>${display(second?.inputTokens)}</td><td>${display(first?.outputTokens)}</td><td>${display(second?.outputTokens)}</td><td>${this.escapeHtml(observation)}</td><td>${this.escapeHtml(issue)}</td><td class="${colour}">${label}</td></tr>`;
        }).join('');
        const cachePanel = `
            <div class="panel" style="margin: 24px auto; max-width: 1400px; border-top: 4px solid ${cacheColour};">
                <h3 class="panel-title">Cache Telemetry Verdict: <span style="color: ${cacheColour};">${data.cacheSummary.status}</span></h3>
                <p style="color: var(--text-secondary); margin-bottom: 8px;">${cacheDecision}</p>
                <p style="color: var(--text-secondary); margin-bottom: 16px;">${data.cacheSummary.applied}/${data.cacheSummary.total} validated; ${data.cacheSummary.notApplied} not working; ${data.cacheSummary.inconclusive} not observable. <a href="./cache-compliance.json" download class="download-link" style="margin-left: 12px;">Download machine-readable evidence</a></p>
                ${cacheRows ? `<div style="overflow-x: auto;"><table><thead><tr><th>Test Case</th><th>Model</th><th>Prompt</th><th>Test Scenario</th><th>Inference Time (1st)</th><th>Inference Time (2nd)</th><th>Input Tokens (1st)</th><th>Input Tokens (2nd)</th><th>Output Tokens (1st)</th><th>Output Tokens (2nd)</th><th>Observation</th><th>Failure / Issue</th><th>Status</th></tr></thead><tbody>${cacheRows}</tbody></table></div>` : ''}
            </div>`;

        // Generate individual test HTML list
        let testListHtml = '';
        data.tests.forEach(test => {
            const statusClass = `status-${test.status}`;
            const statusLabel = test.status.toUpperCase();
            
            // Build attachments HTML
            let attachmentsHtml = '';
            if (test.attachments && test.attachments.length > 0) {
                attachmentsHtml = `<div class="test-attachments"><h4>Evidence & Attachments</h4><div class="attachment-grid">`;
                test.attachments.forEach(att => {
                    if (att.contentType.startsWith('image/')) {
                        attachmentsHtml += `
                            <div class="attachment-item">
                                <span class="attachment-title">${att.name}</span>
                                <img src="${att.path}" alt="${att.name}" class="screenshot-thumbnail" onclick="openLightbox('${att.path}')" />
                            </div>`;
                    } else if (att.contentType.startsWith('video/')) {
                        attachmentsHtml += `
                            <div class="attachment-item">
                                <span class="attachment-title">${att.name}</span>
                                <video controls class="video-player">
                                    <source src="${att.path}" type="${att.contentType}">
                                    Your browser does not support the video tag.
                                </video>
                            </div>`;
                    } else {
                        attachmentsHtml += `
                            <div class="attachment-item">
                                <span class="attachment-title">${att.name}</span>
                                <a href="${att.path}" download class="download-link">Download File</a>
                            </div>`;
                    }
                });
                attachmentsHtml += `</div></div>`;
            }

            // Build console logs HTML
            let logsHtml = '';
            if (test.logs && test.logs.length > 0) {
                logsHtml = `
                    <div class="test-logs">
                        <h4>Console Output (Stdout/Stderr)</h4>
                        <pre><code>${test.logs.map(log => this.escapeHtml(log)).join('\n')}</code></pre>
                    </div>`;
            }

            // Build error section HTML
            let errorHtml = '';
            if (test.error) {
                errorHtml = `
                    <div class="test-error">
                        <h4>Error Stack Trace</h4>
                        <pre><code>${this.escapeHtml(test.error)}</code></pre>
                    </div>`;
            }

            // Build steps HTML
            const renderSteps = (stepList: ProcessedStep[]): string => {
                if (!stepList || stepList.length === 0) return '';
                let stepsListHtml = '<ul class="step-list">';
                stepList.forEach(s => {
                    const stepStatusClass = `step-${s.status}`;
                    const stepStatusIcon = s.status === 'passed' ? '✓' : s.status === 'failed' ? '✗' : '○';
                    stepsListHtml += `
                        <li class="${stepStatusClass}">
                            <div class="step-header">
                                <span class="step-icon">${stepStatusIcon}</span>
                                <span class="step-title">${this.escapeHtml(s.title)}</span>
                                <span class="step-duration">${formatDuration(s.duration)}</span>
                            </div>
                            ${s.error ? `<pre class="step-error">${this.escapeHtml(s.error)}</pre>` : ''}
                            ${s.steps && s.steps.length > 0 ? renderSteps(s.steps) : ''}
                        </li>`;
                });
                stepsListHtml += '</ul>';
                return stepsListHtml;
            };

            const stepsSectionHtml = test.steps && test.steps.length > 0 ? `
                <div class="test-steps">
                    <h4>Step-by-Step Timeline</h4>
                    ${renderSteps(test.steps)}
                </div>` : '';

            testListHtml += `
                <div class="test-card ${statusClass}" data-status="${test.status}">
                    <div class="test-card-header" onclick="toggleCard('${test.id}')">
                        <div class="test-info-primary">
                            <span class="status-badge badge-${test.status}">${statusLabel}</span>
                            <span class="test-title">${this.escapeHtml(test.title)}</span>
                        </div>
                        <div class="test-info-secondary">
                            <span class="test-browser"><i class="browser-icon">🌐</i> ${test.browser}</span>
                            <span class="test-file"><i class="file-icon">📄</i> ${test.file}</span>
                            <span class="test-duration">⏱ ${formatDuration(test.duration)}</span>
                            <span class="accordion-arrow" id="arrow-${test.id}">▼</span>
                        </div>
                    </div>
                    <div class="test-card-body" id="body-${test.id}">
                        ${errorHtml}
                        ${stepsSectionHtml}
                        ${attachmentsHtml}
                        ${logsHtml}
                    </div>
                </div>`;
        });

        // Generate module-wise summary rows
        let moduleRows = '';
        Object.entries(data.fileSummaries).forEach(([file, stats]) => {
            const passPercent = stats.total > 0 ? Math.round(((stats.passed + stats.flaky) / stats.total) * 100) : 0;
            moduleRows += `
                <tr>
                    <td>📄 ${file}</td>
                    <td><strong>${stats.total}</strong></td>
                    <td class="text-success">${stats.passed}</td>
                    <td class="text-danger">${stats.failed}</td>
                    <td class="text-warning">${stats.flaky}</td>
                    <td class="text-muted">${stats.skipped}</td>
                    <td>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${passPercent}%; background-color: ${passPercent > 80 ? '#22c55e' : passPercent > 50 ? '#f59e0b' : '#ef4444'}"></div>
                        </div>
                        <span class="progress-text">${passPercent}%</span>
                    </td>
                </tr>`;
        });

        // Generate browser-wise summary rows
        let browserRows = '';
        Object.entries(data.browserSummaries).forEach(([browser, stats]) => {
            const passPercent = stats.total > 0 ? Math.round(((stats.passed + stats.flaky) / stats.total) * 100) : 0;
            browserRows += `
                <tr>
                    <td>🌐 ${browser}</td>
                    <td><strong>${stats.total}</strong></td>
                    <td class="text-success">${stats.passed}</td>
                    <td class="text-danger">${stats.failed}</td>
                    <td class="text-warning">${stats.flaky}</td>
                    <td class="text-muted">${stats.skipped}</td>
                    <td>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${passPercent}%; background-color: ${passPercent > 80 ? '#22c55e' : passPercent > 50 ? '#f59e0b' : '#ef4444'}"></div>
                        </div>
                        <span class="progress-text">${passPercent}%</span>
                    </td>
                </tr>`;
        });

        const overallStatusClass = data.stats.failed > 0 ? 'bg-danger-banner' : 'bg-success-banner';
        const overallStatusLabel = data.stats.failed > 0 ? 'TEST SUITE FAILED' : 'TEST SUITE PASSED';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playwright Automation Report</title>
    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-tertiary: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --border-color: #334155;
            
            --success: #22c55e;
            --danger: #ef4444;
            --warning: #f59e0b;
            --skipped: #64748b;
            
            --accent: #6366f1;
            --accent-hover: #4f46e5;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            padding: 24px;
            font-size: 14px;
            line-height: 1.5;
        }

        header {
            margin-bottom: 24px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }

        .status-banner {
            padding: 20px 24px;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 0.05em;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .bg-success-banner {
            background: linear-gradient(135deg, #15803d 0%, #166534 100%);
            border-bottom: 4px solid var(--success);
        }

        .bg-danger-banner {
            background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
            border-bottom: 4px solid var(--danger);
        }

        .suite-metadata {
            background-color: var(--bg-secondary);
            padding: 16px 24px;
            display: flex;
            flex-wrap: wrap;
            gap: 24px;
            border-bottom: 1px solid var(--border-color);
        }

        .meta-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .meta-item-label {
            color: var(--text-secondary);
            font-size: 12px;
            text-transform: uppercase;
            font-weight: 600;
        }

        .meta-item-value {
            font-size: 15px;
            font-weight: 600;
        }

        /* Dashboard layout */
        .dashboard-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
        }

        @media (max-width: 1024px) {
            .dashboard-grid {
                grid-template-columns: 1fr;
            }
        }

        .stats-panel {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
        }

        .stat-card {
            background-color: var(--bg-secondary);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }

        .stat-value {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
        }

        .stat-card.passed-card .stat-value { color: var(--success); }
        .stat-card.failed-card .stat-value { color: var(--danger); }
        .stat-card.flaky-card .stat-value { color: var(--warning); }
        .stat-card.skipped-card .stat-value { color: var(--skipped); }

        .stat-card.pass-rate-card {
            grid-column: span 3;
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
            border: 1px solid #4338ca;
        }
        .stat-card.pass-rate-card .stat-value {
            color: #a5b4fc;
            font-size: 40px;
        }

        .chart-panel {
            background-color: var(--bg-secondary);
            border-radius: 12px;
            padding: 24px;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .chart-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
            width: 100%;
            text-align: left;
        }

        .svg-chart-container {
            position: relative;
            width: 180px;
            height: 180px;
        }

        .svg-chart {
            transform: rotate(-90deg);
        }

        .chart-center-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }

        .chart-center-val {
            font-size: 28px;
            font-weight: 700;
        }

        .chart-center-lbl {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 600;
        }

        .chart-legend {
            display: flex;
            gap: 16px;
            margin-top: 20px;
            justify-content: center;
            width: 100%;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: var(--text-secondary);
            font-weight: 600;
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }

        /* Two column summary tables & env */
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
        }

        @media (max-width: 768px) {
            .summary-grid {
                grid-template-columns: 1fr;
            }
        }

        .panel {
            background-color: var(--bg-secondary);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }

        .panel-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }

        th, td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            font-size: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 600;
        }

        td {
            font-size: 13px;
        }

        .text-success { color: var(--success) !important; font-weight: 600; }
        .text-danger { color: var(--danger) !important; font-weight: 600; }
        .text-warning { color: var(--warning) !important; font-weight: 600; }
        .text-muted { color: var(--text-secondary); }

        .progress-bar-container {
            width: 80px;
            height: 6px;
            background-color: var(--bg-tertiary);
            border-radius: 3px;
            overflow: hidden;
            display: inline-block;
            vertical-align: middle;
            margin-right: 8px;
        }

        .progress-bar-fill {
            height: 100%;
            border-radius: 3px;
        }

        .progress-text {
            font-size: 11px;
            font-weight: 600;
            vertical-align: middle;
        }

        .env-table td:first-child {
            color: var(--text-secondary);
            font-weight: 600;
            width: 40%;
        }

        /* Filter Controls */
        .controls-panel {
            background-color: var(--bg-secondary);
            border-radius: 12px;
            padding: 16px 20px;
            border: 1px solid var(--border-color);
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }

        .filter-buttons {
            display: flex;
            gap: 8px;
        }

        .filter-btn {
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s ease;
        }

        .filter-btn:hover {
            background-color: var(--border-color);
        }

        .filter-btn.active {
            background-color: var(--accent);
            border-color: var(--accent);
        }

        .filter-btn.active:hover {
            background-color: var(--accent-hover);
        }

        .search-container {
            display: flex;
            align-items: center;
            background-color: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 6px 12px;
            width: 300px;
        }

        .search-input {
            background: none;
            border: none;
            color: var(--text-primary);
            outline: none;
            width: 100%;
            margin-left: 8px;
            font-size: 13px;
        }

        /* Test card list */
        .test-list-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 16px;
        }

        .test-card {
            background-color: var(--bg-secondary);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            margin-bottom: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            transition: border-color 0.2s ease;
        }

        .test-card.status-passed { border-left: 5px solid var(--success); }
        .test-card.status-failed { border-left: 5px solid var(--danger); }
        .test-card.status-flaky { border-left: 5px solid var(--warning); }
        .test-card.status-skipped { border-left: 5px solid var(--skipped); }

        .test-card-header {
            padding: 16px 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            user-select: none;
        }

        .test-card-header:hover {
            background-color: rgba(255, 255, 255, 0.02);
        }

        .test-info-primary {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 1;
        }

        .status-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 4px;
            letter-spacing: 0.03em;
        }

        .badge-passed { background-color: rgba(34, 197, 94, 0.2); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.3); }
        .badge-failed { background-color: rgba(239, 68, 68, 0.2); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
        .badge-flaky { background-color: rgba(245, 158, 11, 0.2); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge-skipped { background-color: rgba(100, 116, 139, 0.2); color: var(--skipped); border: 1px solid rgba(100, 116, 139, 0.3); }

        .test-title {
            font-size: 15px;
            font-weight: 600;
        }

        .test-info-secondary {
            display: flex;
            align-items: center;
            gap: 16px;
            color: var(--text-secondary);
            font-size: 12px;
        }

        .test-info-secondary span {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .accordion-arrow {
            font-size: 10px;
            color: var(--text-secondary);
            transition: transform 0.2s ease;
        }

        .test-card-body {
            display: none;
            padding: 20px;
            border-top: 1px solid var(--border-color);
            background-color: rgba(0, 0, 0, 0.15);
        }

        /* Error section */
        .test-error {
            margin-bottom: 20px;
        }

        .test-error h4, .test-steps h4, .test-attachments h4, .test-logs h4 {
            font-size: 13px;
            text-transform: uppercase;
            color: var(--text-secondary);
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: 0.05em;
        }

        pre {
            background-color: #0b0f19;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            overflow-x: auto;
            color: #f8fafc;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12px;
            line-height: 1.6;
        }

        .test-error pre {
            border-left: 4px solid var(--danger);
        }

        /* Steps list */
        .test-steps {
            margin-bottom: 20px;
        }

        .step-list {
            list-style: none;
            padding-left: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .step-list li {
            border: 1px solid var(--border-color);
            background-color: var(--bg-secondary);
            border-radius: 8px;
            padding: 10px 14px;
        }

        .step-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .step-icon {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            font-size: 10px;
            font-weight: 700;
            margin-right: 10px;
        }

        .step-title {
            font-weight: 600;
            font-size: 13px;
            flex: 1;
        }

        .step-duration {
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 600;
        }

        .step-passed .step-icon { background-color: rgba(34, 197, 94, 0.15); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.3); }
        .step-failed { border-left: 3px solid var(--danger) !important; }
        .step-failed .step-icon { background-color: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
        
        .step-error {
            background-color: #0b0f19;
            color: var(--danger);
            margin-top: 8px;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            border-left: 3px solid var(--danger);
        }

        .step-list .step-list {
            margin-top: 8px;
            padding-left: 16px;
            border-left: 1px dashed var(--border-color);
        }

        /* Attachments Grid */
        .test-attachments {
            margin-bottom: 20px;
        }

        .attachment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 16px;
        }

        .attachment-item {
            background-color: #0b0f19;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .attachment-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .screenshot-thumbnail {
            width: 100%;
            height: 140px;
            object-fit: cover;
            border-radius: 6px;
            cursor: pointer;
            transition: opacity 0.2s ease;
            border: 1px solid var(--border-color);
        }

        .screenshot-thumbnail:hover {
            opacity: 0.8;
        }

        .video-player {
            width: 100%;
            height: 140px;
            border-radius: 6px;
            background-color: #000;
            border: 1px solid var(--border-color);
        }

        .download-link {
            display: inline-block;
            background-color: var(--bg-tertiary);
            color: var(--text-primary);
            text-decoration: none;
            padding: 8px 12px;
            border-radius: 6px;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid var(--border-color);
            transition: background-color 0.2s ease;
        }

        .download-link:hover {
            background-color: var(--border-color);
        }

        /* Logs section */
        .test-logs pre {
            max-height: 300px;
            overflow-y: auto;
        }

        /* Lightbox Modal */
        .lightbox-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(15, 23, 42, 0.95);
            justify-content: center;
            align-items: center;
            cursor: zoom-out;
        }

        .lightbox-content {
            max-width: 90%;
            max-height: 90%;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
            border: 1px solid var(--border-color);
        }

        .lightbox-close {
            position: absolute;
            top: 24px;
            right: 24px;
            color: var(--text-primary);
            font-size: 30px;
            font-weight: 700;
            cursor: pointer;
        }
    </style>
</head>
<body>

    <header>
        <div class="status-banner ${overallStatusClass}">
            <span>${overallStatusLabel}</span>
            <span style="font-size: 18px; opacity: 0.9;">PASS RATE: ${data.stats.passRate}%</span>
        </div>
        <div class="suite-metadata">
            <div class="meta-item">
                <span class="meta-item-label">Start Time</span>
                <span class="meta-item-value">${startDate}</span>
            </div>
            <div class="meta-item">
                <span class="meta-item-label">End Time</span>
                <span class="meta-item-value">${endDate}</span>
            </div>
            <div class="meta-item">
                <span class="meta-item-label">Total Duration</span>
                <span class="meta-item-value">${formatDuration(data.stats.duration)}</span>
            </div>
        </div>
    </header>

    ${guardrailPanel}
    ${cachePanel}

    <div class="dashboard-grid">
        <!-- Stats Cards -->
        <div class="stats-panel">
            <div class="stat-card pass-rate-card">
                <span class="stat-value">${data.stats.passRate}%</span>
                <span class="stat-label">Overall Pass Rate</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" style="color: var(--text-primary);">${data.stats.total}</span>
                <span class="stat-label">Total Executed</span>
            </div>
            <div class="stat-card passed-card">
                <span class="stat-value">${passedVal}</span>
                <span class="stat-label">Passed</span>
            </div>
            <div class="stat-card failed-card">
                <span class="stat-value">${data.stats.failed}</span>
                <span class="stat-label">Failed</span>
            </div>
            <div class="stat-card flaky-card">
                <span class="stat-value">${data.stats.flaky}</span>
                <span class="stat-label">Flaky</span>
            </div>
            <div class="stat-card skipped-card">
                <span class="stat-value">${data.stats.skipped}</span>
                <span class="stat-label">Skipped</span>
            </div>
        </div>

        <!-- SVG Donut Chart -->
        <div class="chart-panel">
            <h3 class="chart-title">Test Distribution</h3>
            <div class="svg-chart-container">
                <svg width="100%" height="100%" viewBox="0 0 120 120" class="svg-chart">
                    <!-- Base background circle -->
                    <circle cx="60" cy="60" r="${radius}" fill="transparent" stroke="#1e293b" stroke-width="12" />
                    
                    <!-- Skip circle -->
                    ${skippedVal > 0 ? `<circle cx="60" cy="60" r="${radius}" fill="transparent" stroke="var(--skipped)" stroke-width="12"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${sOffset}" />` : ''}

                    <!-- Failed circle -->
                    ${failedVal > 0 ? `<circle cx="60" cy="60" r="${radius}" fill="transparent" stroke="var(--danger)" stroke-width="12"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${fOffset}" />` : ''}

                    <!-- Passed circle -->
                    ${passedVal > 0 ? `<circle cx="60" cy="60" r="${radius}" fill="transparent" stroke="var(--success)" stroke-width="12"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${pOffset}" />` : ''}
                </svg>
                <div class="chart-center-text">
                    <span class="chart-center-val">${data.stats.passRate}%</span><br>
                    <span class="chart-center-lbl">Pass Rate</span>
                </div>
            </div>
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background-color: var(--success);"></div>
                    <span>Passed</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: var(--danger);"></div>
                    <span>Failed</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: var(--skipped);"></div>
                    <span>Skipped</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Summaries and Environment -->
    <div class="summary-grid">
        <div class="panel">
            <h3 class="panel-title">Module / Feature Summary</h3>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>File / Feature</th>
                            <th>Total</th>
                            <th class="text-success">P</th>
                            <th class="text-danger">F</th>
                            <th class="text-warning">Flaky</th>
                            <th class="text-muted">S</th>
                            <th>Pass %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${moduleRows}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="panel">
            <h3 class="panel-title">Run Environment Specs</h3>
            <table class="env-table">
                <tbody>
                    <tr>
                        <td>Target Environment (Base URL)</td>
                        <td><a href="${data.envDetails.baseUrl}" target="_blank" style="color: var(--accent); font-weight: 600;">${data.envDetails.baseUrl}</a></td>
                    </tr>
                    <tr>
                        <td>Operating System (OS)</td>
                        <td>${data.envDetails.os}</td>
                    </tr>
                    <tr>
                        <td>Node.js Version</td>
                        <td>${data.envDetails.nodeVersion}</td>
                    </tr>
                    <tr>
                        <td>Playwright Version</td>
                        <td>v${data.envDetails.playwrightVersion}</td>
                    </tr>
                    <tr>
                        <td>Execution Strategy</td>
                        <td>${data.envDetails.executionMode} (${data.envDetails.workers} workers)</td>
                    </tr>
                </tbody>
            </table>

            <h3 class="panel-title" style="margin-top: 24px;">Browser Coverage Summary</h3>
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Browser</th>
                            <th>Total</th>
                            <th class="text-success">P</th>
                            <th class="text-danger">F</th>
                            <th class="text-warning">Flaky</th>
                            <th class="text-muted">S</th>
                            <th>Pass %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${browserRows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Controls Panel -->
    <div class="controls-panel">
        <div class="filter-buttons">
            <button class="filter-btn active" onclick="setFilter('all', this)">All</button>
            <button class="filter-btn text-success" onclick="setFilter('passed', this)">Passed</button>
            <button class="filter-btn text-danger" onclick="setFilter('failed', this)">Failed</button>
            <button class="filter-btn text-warning" onclick="setFilter('flaky', this)">Flaky</button>
            <button class="filter-btn text-muted" onclick="setFilter('skipped', this)">Skipped</button>
        </div>
        <div class="search-container">
            <span>🔍</span>
            <input type="text" class="search-input" placeholder="Search tests by title or spec file..." oninput="onSearch(this.value)" />
        </div>
    </div>

    <!-- Test List -->
    <h3 class="test-list-title">Detailed Execution Results</h3>
    <div class="test-list-container">
        ${testListHtml}
    </div>

    <!-- Lightbox Modal -->
    <div id="lightbox" class="lightbox-modal" onclick="closeLightbox()">
        <span class="lightbox-close">&times;</span>
        <img class="lightbox-content" id="lightbox-img">
    </div>

    <script>
        let currentFilter = 'all';
        let currentSearch = '';

        function toggleCard(id) {
            const body = document.getElementById('body-' + id);
            const arrow = document.getElementById('arrow-' + id);
            if (body.style.display === 'block') {
                body.style.display = 'none';
                arrow.style.transform = 'rotate(0deg)';
            } else {
                body.style.display = 'block';
                arrow.style.transform = 'rotate(180deg)';
            }
        }

        function setFilter(status, btnElement) {
            currentFilter = status;
            
            // Highlight active button
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            btnElement.classList.add('active');

            applyFilterAndSearch();
        }

        function onSearch(query) {
            currentSearch = query.toLowerCase();
            applyFilterAndSearch();
        }

        function applyFilterAndSearch() {
            document.querySelectorAll('.test-card').forEach(card => {
                const cardStatus = card.dataset.status;
                const title = card.querySelector('.test-title').textContent.toLowerCase();
                const file = card.querySelector('.test-file').textContent.toLowerCase();
                
                const matchesFilter = (currentFilter === 'all' || cardStatus === currentFilter);
                const matchesSearch = (!currentSearch || title.includes(currentSearch) || file.includes(currentSearch));

                if (matchesFilter && matchesSearch) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function openLightbox(src) {
            const modal = document.getElementById('lightbox');
            const img = document.getElementById('lightbox-img');
            modal.style.display = 'flex';
            img.src = src;
        }

        function closeLightbox() {
            document.getElementById('lightbox').style.display = 'none';
        }

        // Close lightbox on escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === "Escape") {
                closeLightbox();
            }
        });
    </script>
</body>
</html>`;
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

export default CustomReporter;
