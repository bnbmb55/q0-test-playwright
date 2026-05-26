import type { Reporter, TestCase, TestResult, FullResult, FullConfig, Suite } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';

interface ProcessedTestStep {
    title: string;
    duration: number;
    status: 'passed' | 'failed';
    error?: string;
    indent: number;
}

interface ProcessedTestCase {
    id: string;
    title: string;
    suiteName: string;
    fileModule: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    browser: string;
    environment: string;
    startTime: string;
    expectedResult: string;
    actualResult: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    cleanError?: string;
    fullError?: string;
    steps: ProcessedTestStep[];
    screenshots: { type: string; path: string; description: string }[];
    videos: string[];
    traces: string[];
    consoleLogs?: string;
    networkLogs?: string;
}

export default class CustomReporter implements Reporter {
    private suites: Suite[] = [];
    private startTime: number = Date.now();
    private config!: FullConfig;

    onBegin(config: FullConfig, suite: Suite) {
        this.config = config;
        this.suites.push(suite);
        this.startTime = Date.now();
    }

    async onEnd(result: FullResult) {
        const totalDuration = Date.now() - this.startTime;
        const reportDir = path.join(process.cwd(), 'playwright-report');
        const evidenceDir = path.join(reportDir, 'evidence');

        if (!fs.existsSync(evidenceDir)) {
            fs.mkdirSync(evidenceDir, { recursive: true });
        }

        const allTests: TestCase[] = [];
        const collect = (s: Suite) => {
            for (const test of s.tests) {
                allTests.push(test);
            }
            for (const child of s.suites) {
                collect(child);
            }
        };

        for (const suite of this.suites) {
            collect(suite);
        }

        const processedTests: ProcessedTestCase[] = [];

        for (const test of allTests) {
            const lastResult = test.results[test.results.length - 1];
            const status = lastResult ? lastResult.status : 'skipped';
            const duration = lastResult ? lastResult.duration : 0;
            const startTimeIso = lastResult ? new Date(lastResult.startTime).toISOString() : new Date().toISOString();

            const project = test.parent.project();
            const browser = project ? project.name : 'chromium';
            const baseURL = project?.use?.baseURL || this.config.use?.baseURL || 'https://ui-uat.q0.dev';
            const environment = this.detectEnvironment(baseURL);

            const steps = lastResult ? this.processSteps(lastResult.steps) : [];

            // Extract attachments
            const screenshots: { type: string; path: string; description: string }[] = [];
            const videos: string[] = [];
            const traces: string[] = [];
            let consoleLogs: string | undefined = undefined;
            let networkLogs: string | undefined = undefined;

            if (lastResult && lastResult.attachments) {
                for (const attachment of lastResult.attachments) {
                    let relativePath = '';
                    try {
                        if (attachment.path && fs.existsSync(attachment.path)) {
                            const ext = path.extname(attachment.path);
                            const rand = Math.random().toString(36).substring(2, 7);
                            const destName = `evidence_${Date.now()}_${rand}${ext}`;
                            const destPath = path.join(evidenceDir, destName);
                            fs.copyFileSync(attachment.path, destPath);
                            relativePath = `evidence/${destName}`;
                        } else if (attachment.body) {
                            const ext = attachment.contentType === 'image/png' ? '.png' : '.txt';
                            const rand = Math.random().toString(36).substring(2, 7);
                            const destName = `evidence_${Date.now()}_${rand}${ext}`;
                            const destPath = path.join(evidenceDir, destName);
                            fs.writeFileSync(destPath, attachment.body);
                            relativePath = `evidence/${destName}`;
                        }
                    } catch (err) {
                        console.error('Failed to copy attachment:', err);
                    }

                    if (!relativePath) continue;

                    if (attachment.contentType.startsWith('image/')) {
                        const name = attachment.name;
                        let type = 'validation';
                        let desc = name;

                        const match = name.match(/^\[(.*?)\]\s*(.*)$/);
                        if (match) {
                            type = match[1].toLowerCase();
                            desc = match[2];
                        } else if (name === 'screenshot') {
                            type = 'failure';
                            desc = 'Failure point screenshot';
                        }
                        screenshots.push({ type, path: relativePath, description: desc });
                    } else if (attachment.contentType.startsWith('video/')) {
                        videos.push(relativePath);
                    } else if (attachment.name === 'trace') {
                        traces.push(relativePath);
                    } else if (attachment.name === 'Console Logs') {
                        try {
                            consoleLogs = fs.readFileSync(path.join(reportDir, relativePath), 'utf-8');
                        } catch {
                            consoleLogs = 'Failed to load console logs.';
                        }
                    } else if (attachment.name === 'Network Details') {
                        try {
                            networkLogs = fs.readFileSync(path.join(reportDir, relativePath), 'utf-8');
                        } catch {
                            networkLogs = 'Failed to load network details.';
                        }
                    }
                }
            }

            // Extract Error Details
            let cleanError: string | undefined = undefined;
            let fullError: string | undefined = undefined;
            let expectedResult = 'System navigates and performs actions successfully';
            let actualResult = 'Steps completed with no errors';

            if (status === 'failed' && lastResult && lastResult.error) {
                fullError = lastResult.error.stack || lastResult.error.message || '';
                cleanError = this.cleanErrorMessage(fullError);
                
                const expAct = this.parseExpectedActual(fullError);
                expectedResult = expAct.expected;
                actualResult = expAct.actual;
            } else if (status === 'skipped') {
                actualResult = 'Test was skipped by suite execution rules';
            }

            const severity = this.getSeverity(test.title);

            // Get clean suite name (avoid file path, use title or file name)
            let suiteName = test.parent.title;
            if (!suiteName) {
                const relFile = path.relative(process.cwd(), test.location.file);
                suiteName = relFile.replace(/\\/g, '/');
            }
            const fileModule = path.basename(test.location.file);

            processedTests.push({
                id: test.id,
                title: test.title,
                suiteName,
                fileModule,
                status: status === 'timedOut' ? 'failed' : (status as any),
                duration,
                browser,
                environment,
                startTime: startTimeIso,
                expectedResult,
                actualResult,
                severity,
                cleanError,
                fullError,
                steps,
                screenshots,
                videos,
                traces,
                consoleLogs,
                networkLogs
            });
        }

        // Stats
        const total = processedTests.length;
        const passed = processedTests.filter(t => t.status === 'passed').length;
        const failed = processedTests.filter(t => t.status === 'failed').length;
        const skipped = processedTests.filter(t => t.status === 'skipped').length;
        const passPercentage = total > 0 ? Math.round((passed / total) * 100) : 0;
        const failPercentage = total > 0 ? Math.round((failed / total) * 100) : 0;

        const uniqueDefects = Array.from(new Set(processedTests.filter(t => t.status === 'failed').map(t => t.cleanError))).length;

        const htmlData = {
            total,
            passed,
            failed,
            skipped,
            passPercentage,
            failPercentage,
            uniqueDefects,
            totalDuration: this.formatDuration(totalDuration),
            rawTotalDuration: totalDuration,
            executionDate: new Date().toLocaleString(),
            environment: processedTests[0]?.environment || 'UAT',
            browser: processedTests[0]?.browser || 'chromium',
            tests: processedTests
        };

        const htmlContent = this.generateHtmlReport(htmlData);

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const timestampedFile = `report_${timestamp}.html`;
        const timestampedPath = path.join(reportDir, timestampedFile);
        const indexPath = path.join(reportDir, 'index.html');

        fs.writeFileSync(timestampedPath, htmlContent);
        fs.writeFileSync(indexPath, htmlContent); // Always keep latest as index.html

        console.log(`\n========================================`);
        console.log(`🏆 Clean Playwright Automation Report Generated!`);
        console.log(`📍 Path: ${timestampedPath}`);
        console.log(`========================================\n`);

        // Automatically open report in default browser on Windows (detached to persist after process exits)
        try {
            const child = spawn('cmd.exe', ['/c', 'start', '', timestampedPath], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();
        } catch (e) {
            console.error('Failed to automatically open the report in the browser:', e);
        }
    }

    private detectEnvironment(baseURL: string): string {
        const url = baseURL.toLowerCase();
        if (url.includes('uat')) return 'UAT';
        if (url.includes('dev')) return 'Development';
        if (url.includes('staging')) return 'Staging';
        if (url.includes('prod') || url.includes('q0.dev')) return 'Production';
        return 'UAT';
    }

    private formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        const seconds = (ms / 1000) % 60;
        const minutes = Math.floor(ms / 1000 / 60) % 60;
        const hours = Math.floor(ms / 1000 / 60 / 60);

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0) parts.push(`${seconds.toFixed(1)}s`);
        return parts.join(' ');
    }

    private processSteps(steps: any[], indent = 0): ProcessedTestStep[] {
        const list: ProcessedTestStep[] = [];
        for (const step of steps) {
            // Ignore internal playwright/fixtures steps to keep details clean
            if (step.category === 'fixture' && step.title.startsWith('fixture:')) continue;
            
            list.push({
                title: step.title,
                duration: step.duration,
                status: step.error ? 'failed' : 'passed',
                error: step.error ? step.error.message : undefined,
                indent
            });
            if (step.steps && step.steps.length > 0) {
                list.push(...this.processSteps(step.steps, indent + 1));
            }
        }
        return list;
    }

    private cleanErrorMessage(msg: string): string {
        // Strip ANSI escape codes
        const cleanMsg = msg.replace(/\u001b\[[0-9;]*m/g, '').trim();
        const firstLine = cleanMsg.split('\n')[0] || '';

        if (firstLine.includes('timeout') && firstLine.includes('exceeded')) {
            if (firstLine.includes('click') || firstLine.includes('locator.click')) {
                return 'System could not locate or click the button within the allowed wait time.';
            }
            if (firstLine.includes('fill') || firstLine.includes('locator.fill')) {
                return 'System could not locate the input field to type details within the allowed wait time.';
            }
            if (firstLine.includes('goto') || firstLine.includes('navigation')) {
                return 'The website took too long to load or was temporarily unavailable.';
            }
            return 'System action timed out waiting for the page element to respond.';
        }

        if (firstLine.includes('toBeVisible') || firstLine.includes('visible')) {
            return 'Validation failed: The expected page element was not displayed.';
        }

        if (firstLine.includes('toContainText') || firstLine.includes('toHaveText') || firstLine.includes('text')) {
            return 'Validation failed: The text displayed on the page did not match what was expected.';
        }

        if (firstLine.includes('toHaveURL') || firstLine.includes('url')) {
            return 'Validation failed: The application did not redirect to the expected page URL.';
        }

        if (firstLine.includes('strict mode violation')) {
            return 'System found multiple matching elements when it expected only one unique element.';
        }

        if (firstLine.includes('Target closed') || firstLine.includes('context closed')) {
            return 'The page or connection was closed before the action could be completed.';
        }

        if (firstLine.includes('expect(received).')) {
            return 'Validation failed: The assertion condition was not met.';
        }

        return firstLine;
    }

    private parseExpectedActual(errorMsg: string): { expected: string; actual: string } {
        const cleanMsg = errorMsg.replace(/\u001b\[[0-9;]*m/g, '');

        let expected = 'Element/state matches standard configuration';
        let actual = 'Assertion failed or timed out during execution';

        const expectedMatch = cleanMsg.match(/Expected:\s*(.*)/i);
        const receivedMatch = cleanMsg.match(/Received:\s*(.*)/i);

        if (expectedMatch && expectedMatch[1]) {
            expected = expectedMatch[1].trim();
        }
        if (receivedMatch && receivedMatch[1]) {
            actual = receivedMatch[1].trim();
        } else {
            if (cleanMsg.includes('toBeVisible')) {
                expected = 'Element should be visible on screen';
                actual = 'Element was hidden or missing in the DOM';
            } else if (cleanMsg.includes('toBeHidden')) {
                expected = 'Element should be hidden/removed';
                actual = 'Element was still visible on screen';
            }
        }

        // Clean quotes from parsed outputs
        expected = expected.replace(/^"|"$/g, '');
        actual = actual.replace(/^"|"$/g, '');

        return { expected, actual };
    }

    private getSeverity(testTitle: string): 'Critical' | 'High' | 'Medium' | 'Low' {
        const title = testTitle.toLowerCase();
        if (title.includes('tc-login-01') || title.includes('security') || title.includes('unauthorized') || title.includes('redirect')) {
            return 'Critical';
        }
        if (title.includes('create') || title.includes('save') || title.includes('delete') || title.includes('secrets') || title.includes('training')) {
            return 'High';
        }
        if (title.includes('validation') || title.includes('error message') || title.includes('cancel')) {
            return 'Medium';
        }
        return 'Low';
    }

    private generateHtmlReport(data: any): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Playwright Automation Report</title>
    <!-- Outfit Font -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-main: #0b0f19;
            --bg-card: rgba(22, 30, 49, 0.7);
            --bg-hover: rgba(30, 41, 67, 0.8);
            --border-color: rgba(255, 255, 255, 0.06);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            
            --color-pass: #10b981;
            --color-fail: #ef4444;
            --color-skip: #f59e0b;
            --color-brand: #6366f1;
            
            --shadow-pass: rgba(16, 185, 129, 0.15);
            --shadow-fail: rgba(239, 68, 68, 0.15);
            --shadow-skip: rgba(245, 158, 11, 0.15);
            --shadow-brand: rgba(99, 102, 241, 0.2);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Outfit', sans-serif;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }

        body {
            background-color: var(--bg-main);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        header {
            width: 100%;
            max-width: 1200px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }

        .logo-section h1 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .logo-section p {
            font-size: 13px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        .status-badge {
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            border: 1px solid var(--border-color);
        }

        .status-badge.pass {
            background: rgba(16, 185, 129, 0.1);
            color: var(--color-pass);
            border-color: rgba(16, 185, 129, 0.2);
            box-shadow: 0 0 15px var(--shadow-pass);
        }

        .status-badge.fail {
            background: rgba(239, 68, 68, 0.1);
            color: var(--color-fail);
            border-color: rgba(239, 68, 68, 0.2);
            box-shadow: 0 0 15px var(--shadow-fail);
        }

        .nav-tabs {
            width: 100%;
            max-width: 1200px;
            display: flex;
            gap: 8px;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 12px;
        }

        .nav-tab {
            padding: 10px 20px;
            border-radius: 8px;
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .nav-tab:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.03);
        }

        .nav-tab.active {
            color: var(--text-primary);
            background: var(--bg-hover);
            border: 1px solid var(--border-color);
        }

        main {
            width: 100%;
            max-width: 1200px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .tab-content {
            display: none;
            flex-direction: column;
            gap: 24px;
        }

        .tab-content.active {
            display: flex;
        }

        /* Dashboard level 1 grid */
        .summary-dashboard {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 24px;
        }

        @media (max-width: 900px) {
            .summary-dashboard {
                grid-template-columns: 1fr;
            }
        }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }

        .glass-card {
            background: var(--bg-card);
            backdrop-filter: blur(12px);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .glass-card:hover {
            transform: translateY(-2px);
        }

        .kpi-card {
            min-height: 110px;
        }

        .kpi-title {
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .kpi-value {
            font-size: 32px;
            font-weight: 700;
            margin-top: 12px;
        }

        .kpi-meta {
            font-size: 12px;
            color: var(--text-secondary);
            margin-top: 8px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .kpi-card.pass-card {
            border-left: 4px solid var(--color-pass);
        }
        .kpi-card.fail-card {
            border-left: 4px solid var(--color-fail);
        }
        .kpi-card.skip-card {
            border-left: 4px solid var(--color-skip);
        }
        .kpi-card.duration-card {
            border-left: 4px solid var(--color-brand);
        }

        /* SVG Donut Chart */
        .chart-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        .donut-container {
            position: relative;
            width: 160px;
            height: 160px;
        }

        .donut-svg {
            transform: rotate(-90deg);
        }

        .donut-circle-bg {
            fill: none;
            stroke: rgba(255, 255, 255, 0.05);
            stroke-width: 14;
        }

        .donut-circle-val {
            fill: none;
            stroke-width: 14;
            stroke-linecap: round;
            transition: stroke-dasharray 0.6s ease;
        }

        .donut-center-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }

        .donut-pct {
            font-size: 26px;
            font-weight: 700;
        }

        .donut-lbl {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
        }

        .chart-legend {
            display: flex;
            gap: 16px;
            margin-top: 20px;
            font-size: 12px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .legend-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        /* Metadata banner */
        .meta-banner {
            display: flex;
            flex-wrap: wrap;
            gap: 24px;
            padding: 16px 24px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            font-size: 13px;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .meta-item span.label {
            color: var(--text-secondary);
        }

        .meta-item span.value {
            font-weight: 500;
        }

        /* Failure section */
        .section-header {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 12px;
            border-left: 3px solid var(--color-brand);
            padding-left: 10px;
        }

        .failed-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .failed-card {
            background: rgba(239, 68, 68, 0.03);
            border: 1px solid rgba(239, 68, 68, 0.15);
            border-radius: 12px;
            padding: 20px;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 20px;
            align-items: start;
        }

        .failed-card:hover {
            border-color: rgba(239, 68, 68, 0.3);
        }

        .failed-info {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .failed-title-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }

        .failed-tag {
            background: rgba(239, 68, 68, 0.1);
            color: var(--color-fail);
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
        }

        .severity-tag {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
        }

        .severity-tag.critical {
            background: rgba(239, 68, 68, 0.15);
            color: #ff8b8b;
        }
        .severity-tag.high {
            background: rgba(245, 158, 11, 0.15);
            color: #ffbe6b;
        }
        .severity-tag.medium {
            background: rgba(99, 102, 241, 0.15);
            color: #a5b4fc;
        }
        .severity-tag.low {
            background: rgba(148, 163, 184, 0.15);
            color: #e2e8f0;
        }

        .failed-name {
            font-size: 16px;
            font-weight: 600;
        }

        .failed-suite {
            font-size: 12px;
            color: var(--text-secondary);
        }

        .failure-reason-box {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.04);
            border-radius: 8px;
            padding: 12px 16px;
            margin-top: 4px;
        }

        .reason-title {
            font-size: 12px;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .reason-text {
            font-size: 14px;
            color: #fca5a5;
            line-height: 1.5;
        }

        .comparison-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 8px;
        }

        @media (max-width: 600px) {
            .comparison-grid {
                grid-template-columns: 1fr;
            }
        }

        .comparison-col {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .comp-lbl {
            font-size: 11px;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
        }

        .comp-val {
            font-size: 13px;
            background: rgba(0, 0, 0, 0.2);
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.03);
            white-space: pre-wrap;
        }

        /* Screenshot Thumbnail rules */
        .failed-thumbnail-container {
            width: 150px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }

        .screenshot-thumb {
            width: 150px;
            height: 90px;
            object-fit: cover;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            cursor: pointer;
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .screenshot-thumb:hover {
            transform: scale(1.03);
            border-color: var(--color-brand);
        }

        /* Filter Controls */
        .filter-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 8px;
        }

        .search-bar {
            flex: 1;
            min-width: 250px;
            max-width: 400px;
            position: relative;
        }

        .search-input {
            width: 100%;
            padding: 10px 16px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s ease;
        }

        .search-input:focus {
            border-color: var(--color-brand);
        }

        select.search-input {
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 16px center;
            background-size: 16px;
            padding-right: 40px;
        }

        .filter-buttons {
            display: flex;
            gap: 8px;
        }

        .filter-btn {
            padding: 8px 14px;
            border-radius: 6px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-secondary);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .filter-btn:hover {
            color: var(--text-primary);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .filter-btn.active {
            background: rgba(99, 102, 241, 0.1);
            border-color: var(--color-brand);
            color: #a5b4fc;
        }

        /* Test items list */
        .test-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .test-row {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow: hidden;
            transition: border-color 0.2s;
        }

        .test-row.passed { border-left: 4px solid var(--color-pass); }
        .test-row.failed { border-left: 4px solid var(--color-fail); }
        .test-row.skipped { border-left: 4px solid var(--color-skip); }

        .test-summary {
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s;
        }

        .test-summary:hover {
            background-color: var(--bg-hover);
        }

        .test-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .status-dot.passed { background-color: var(--color-pass); box-shadow: 0 0 8px var(--color-pass); }
        .status-dot.failed { background-color: var(--color-fail); box-shadow: 0 0 8px var(--color-fail); }
        .status-dot.skipped { background-color: var(--color-skip); box-shadow: 0 0 8px var(--color-skip); }

        .test-title-container {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .test-row-title {
            font-size: 14px;
            font-weight: 600;
        }

        .test-row-meta {
            font-size: 11px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .test-header-right {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .test-row-duration {
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .chevron {
            font-size: 12px;
            color: var(--text-secondary);
            transition: transform 0.2s ease;
        }

        .test-row.open .chevron {
            transform: rotate(180deg);
        }

        /* Expanded Details Level 3 */
        .test-details {
            display: none;
            padding: 24px;
            border-top: 1px solid var(--border-color);
            background: rgba(10, 15, 30, 0.4);
            animation: slideDown 0.25s ease-out;
        }

        .test-row.open .test-details {
            display: block;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
        }

        @media (max-width: 768px) {
            .details-grid {
                grid-template-columns: 1fr;
            }
        }

        .details-section-title {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* Step tree view */
        .step-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .step-item {
            display: flex;
            justify-content: space-between;
            align-items: start;
            padding: 8px 12px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.03);
            font-size: 13px;
        }

        .step-item.failed {
            background: rgba(239, 68, 68, 0.03);
            border-color: rgba(239, 68, 68, 0.1);
        }

        .step-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .step-icon {
            font-size: 10px;
        }
        .step-icon.passed { color: var(--color-pass); }
        .step-icon.failed { color: var(--color-fail); }

        .step-text {
            color: #e2e8f0;
        }

        .step-duration {
            color: var(--text-secondary);
            font-size: 12px;
        }

        /* Logs block */
        .log-block {
            background: #060913;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            line-height: 1.5;
            color: #cbd5e1;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
            position: relative;
        }

        .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            color: var(--text-secondary);
            font-size: 11px;
            cursor: pointer;
        }

        .copy-btn:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.1);
        }

        /* Evidence Links */
        .evidence-links-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 12px;
        }

        .evidence-btn {
            padding: 8px 14px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .evidence-btn:hover {
            background: var(--bg-hover);
            border-color: var(--color-brand);
        }

        /* Grid for screenshots inside detail view */
        .screenshot-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 12px;
        }

        .gallery-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .gallery-img {
            width: 100%;
            height: 110px;
            object-fit: cover;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            cursor: pointer;
            transition: transform 0.2s;
        }

        .gallery-img:hover {
            transform: scale(1.02);
            border-color: var(--color-brand);
        }

        .gallery-desc {
            font-size: 11px;
            color: var(--text-secondary);
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* Metrics view */
        .metrics-card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
        }

        .metric-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            font-size: 14px;
        }

        .metric-label {
            color: var(--text-secondary);
        }

        .metric-value {
            font-weight: 500;
        }

        .slowest-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .slow-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255, 255, 255, 0.01);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 13px;
        }

        .slow-name {
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 70%;
        }

        .slow-time {
            color: var(--color-fail);
            font-weight: 600;
        }

        /* Lightbox Modal */
        .lightbox {
            display: none;
            position: fixed;
            z-index: 1000;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 7, 13, 0.95);
            backdrop-filter: blur(8px);
            justify-content: center;
            align-items: center;
            flex-direction: column;
            gap: 16px;
        }

        .lightbox.active {
            display: flex;
        }

        .lightbox-img {
            max-width: 90%;
            max-height: 80%;
            border-radius: 8px;
            box-shadow: 0 0 30px rgba(0,0,0,0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .lightbox-caption {
            color: var(--text-primary);
            font-size: 16px;
            font-weight: 500;
        }

        .lightbox-close {
            position: absolute;
            top: 24px;
            right: 24px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            font-size: 24px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .lightbox-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        /* Unified Attachments View */
        .evidence-explorer {
            display: grid;
            grid-template-columns: 280px 1fr;
            border: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.3);
            border-radius: 12px;
            min-height: 450px;
            overflow: hidden;
        }

        @media (max-width: 768px) {
            .evidence-explorer {
                grid-template-columns: 1fr;
            }
        }

        .evidence-sidebar {
            border-right: 1px solid var(--border-color);
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow-y: auto;
            max-height: 500px;
        }

        .evidence-sidebar-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 4px;
        }

        .evidence-test-item {
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.2s;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .evidence-test-item:hover {
            background: rgba(255, 255, 255, 0.02);
            color: var(--text-primary);
        }

        .evidence-test-item.active {
            background: var(--bg-hover);
            border-color: var(--border-color);
            color: var(--text-primary);
            font-weight: 500;
        }

        .evidence-viewer {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            overflow-y: auto;
            max-height: 500px;
        }

        .no-evidence-selected {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-secondary);
            font-size: 14px;
            height: 100%;
        }

        .evidence-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 16px;
        }

        .evidence-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .evidence-card-title {
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .evidence-card-preview {
            width: 100%;
            height: 120px;
            object-fit: cover;
            border-radius: 6px;
            background: #000;
            border: 1px solid rgba(255,255,255,0.05);
        }

        .no-preview {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 120px;
            background: rgba(0, 0, 0, 0.2);
            color: var(--text-secondary);
            font-size: 12px;
            border-radius: 6px;
            border: 1px dashed rgba(255,255,255,0.1);
        }
    </style>
</head>
<body>

    <header>
        <div class="logo-section">
            <h1>Test Execution Report</h1>
            <p>Generated on ${data.executionDate} &bull; Environment: <strong>${data.environment}</strong></p>
        </div>
        <div class="status-badge ${data.failed > 0 ? 'fail' : 'pass'}">
            <span class="status-dot ${data.failed > 0 ? 'failed' : 'passed'}"></span>
            <span>${data.failed > 0 ? 'FAIL' : 'PASS'}</span>
        </div>
    </header>

    <div class="nav-tabs">
        <button class="nav-tab active" onclick="switchTab('summary')">Summary</button>
        <button class="nav-tab" onclick="switchTab('failures')">Failed Tests (${data.failed})</button>
        <button class="nav-tab" onclick="switchTab('passes')">Passed Tests (${data.passed})</button>
        <button class="nav-tab" onclick="switchTab('metrics')">Execution Metrics</button>
        <button class="nav-tab" onclick="switchTab('attachments')">Attachments</button>
    </div>

    <main>
        <!-- Tab: Summary (LEVEL 1) -->
        <div id="tab-summary" class="tab-content active">
            <div class="summary-dashboard">
                <div class="kpi-grid">
                    <div class="glass-card kpi-card pass-card">
                        <div class="kpi-title">Passed Tests</div>
                        <div class="kpi-value" style="color: var(--color-pass);">${data.passed}</div>
                        <div class="kpi-meta">${data.passPercentage}% Success Rate</div>
                    </div>
                    <div class="glass-card kpi-card fail-card">
                        <div class="kpi-title">Failed Tests</div>
                        <div class="kpi-value" style="color: var(--color-fail);">${data.failed}</div>
                        <div class="kpi-meta">${data.uniqueDefects} Unique Failure Causes</div>
                    </div>
                    <div class="glass-card kpi-card skip-card">
                        <div class="kpi-title">Skipped Tests</div>
                        <div class="kpi-value" style="color: var(--color-skip);">${data.skipped}</div>
                        <div class="kpi-meta">No action required</div>
                    </div>
                    <div class="glass-card kpi-card duration-card">
                        <div class="kpi-title">Total Duration</div>
                        <div class="kpi-value">${data.totalDuration}</div>
                        <div class="kpi-meta">Across ${data.total} executed cases</div>
                    </div>
                </div>

                <div class="glass-card chart-card">
                    <div class="donut-container">
                        <svg class="donut-svg" width="160" height="160" viewBox="0 0 160 160">
                            <circle class="donut-circle-bg" cx="80" cy="80" r="70" />
                            <!-- Pass circle -->
                            <circle id="pass-circle" class="donut-circle-val" cx="80" cy="80" r="70" stroke="var(--color-pass)" />
                            <!-- Fail circle -->
                            <circle id="fail-circle" class="donut-circle-val" cx="80" cy="80" r="70" stroke="var(--color-fail)" />
                        </svg>
                        <div class="donut-center-text">
                            <div class="donut-pct">${data.passPercentage}%</div>
                            <div class="donut-lbl">Pass Rate</div>
                        </div>
                    </div>
                    <div class="chart-legend">
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: var(--color-pass);"></span>
                            <span>Passed (${data.passed})</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: var(--color-fail);"></span>
                            <span>Failed (${data.failed})</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background-color: var(--color-skip);"></span>
                            <span>Skipped (${data.skipped})</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="meta-banner">
                <div class="meta-item">
                    <span class="label">Environment:</span>
                    <span class="value">${data.environment}</span>
                </div>
                <div class="meta-item">
                    <span class="label">Browser:</span>
                    <span class="value">${data.browser}</span>
                </div>
                <div class="meta-item">
                    <span class="label">Host Time:</span>
                    <span class="value">${data.executionDate}</span>
                </div>
                <div class="meta-item">
                    <span class="label">Executed Cases:</span>
                    <span class="value">${data.total}</span>
                </div>
            </div>

            <!-- LEVEL 2 – Failed Tests Summary (Default view in Summary tab) -->
            <div class="section-header">
                <span>Failed Tests Summary</span>
                <span style="font-size: 12px; color: var(--text-secondary); font-weight: normal;">Critical errors needing immediate attention</span>
            </div>

            <div class="failed-list">
                ${data.failed === 0 ? `
                    <div class="glass-card" style="padding: 32px; align-items: center; justify-content: center; color: var(--color-pass); font-weight: 500;">
                        ✨ All tests passed! No failures detected.
                    </div>
                ` : data.tests.filter((t: any) => t.status === 'failed').map((t: any) => {
                    const failScreenshot = t.screenshots.find((s: any) => s.type === 'failure') || t.screenshots[t.screenshots.length - 1];
                    return `
                    <div class="failed-card">
                        <div class="failed-info">
                            <div class="failed-title-row">
                                <span class="failed-tag">FAIL</span>
                                <span class="severity-tag ${t.severity.toLowerCase()}">${t.severity} Severity</span>
                                <span class="failed-name">${t.title}</span>
                            </div>
                            <div class="failed-suite">Suite: ${t.suiteName} &bull; Browser: ${t.browser}</div>
                            
                            <div class="failure-reason-box">
                                <div class="reason-title">Failure Reason</div>
                                <div class="reason-text">${t.cleanError || 'Unknown exception.'}</div>
                            </div>

                            <div class="comparison-grid">
                                <div class="comparison-col">
                                    <div class="comp-lbl">Expected Result</div>
                                    <div class="comp-val">${t.expectedResult}</div>
                                </div>
                                <div class="comparison-col">
                                    <div class="comp-lbl">Actual Result</div>
                                    <div class="comp-val">${t.actualResult}</div>
                                </div>
                            </div>
                        </div>

                        ${failScreenshot ? `
                        <div class="failed-thumbnail-container">
                            <div class="comp-lbl">Failure Proof</div>
                            <img class="screenshot-thumb" src="${failScreenshot.path}" alt="Failure Screenshot" onclick="openLightbox('${failScreenshot.path}', '${t.title}')" loading="lazy" />
                            <span class="gallery-desc">Click to Zoom</span>
                        </div>
                        ` : ''}
                    </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- Tab: Failed Tests -->
        <div id="tab-failures" class="tab-content">
            <div class="filter-controls">
                <div class="search-bar">
                    <input type="text" class="search-input" id="search-failures" placeholder="Search failed tests..." onkeyup="filterTests('failures')" />
                </div>
                <div style="flex: 1; max-width: 250px;">
                    <select class="search-input" id="module-failures" onchange="filterTests('failures')">
                        <option value="">All Test Modules</option>
                        ${Array.from(new Set(data.tests.filter((t: any) => t.status === 'failed').map((t: any) => t.fileModule))).map(mod => `<option value="${mod}">${mod}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div class="test-list" id="list-failures">
                ${data.tests.filter((t: any) => t.status === 'failed').map((t: any) => this.renderTestRowHtml(t)).join('')}
                ${data.failed === 0 ? '<div class="glass-card" style="padding: 24px; text-align: center; color: var(--text-secondary);">No failed tests to show.</div>' : ''}
            </div>
        </div>

        <!-- Tab: Passed Tests -->
        <div id="tab-passes" class="tab-content">
            <div class="filter-controls">
                <div class="search-bar">
                    <input type="text" class="search-input" id="search-passes" placeholder="Search passed tests..." onkeyup="filterTests('passes')" />
                </div>
                <div style="flex: 1; max-width: 250px;">
                    <select class="search-input" id="module-passes" onchange="filterTests('passes')">
                        <option value="">All Test Modules</option>
                        ${Array.from(new Set(data.tests.filter((t: any) => t.status === 'passed').map((t: any) => t.fileModule))).map(mod => `<option value="${mod}">${mod}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="test-list" id="list-passes">
                ${data.tests.filter((t: any) => t.status === 'passed').map((t: any) => this.renderTestRowHtml(t)).join('')}
                ${data.passed === 0 ? '<div class="glass-card" style="padding: 24px; text-align: center; color: var(--text-secondary);">No passed tests to show.</div>' : ''}
            </div>
        </div>

        <!-- Tab: Execution Metrics -->
        <div id="tab-metrics" class="tab-content">
            <div class="metrics-card-grid">
                <div class="glass-card">
                    <div class="details-section-title">Run Configuration</div>
                    <div class="metric-list">
                        <div class="metric-row">
                            <span class="metric-label">Execution Environment</span>
                            <span class="metric-value">${data.environment}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Base URL</span>
                            <span class="metric-value" style="font-size: 12px; color: var(--color-brand);">${data.environment === 'Production' ? 'https://ui.q0.dev' : 'https://ui-uat.q0.dev'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Primary Browser</span>
                            <span class="metric-value">${data.browser}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Date & Time (Server)</span>
                            <span class="metric-value">${data.executionDate}</span>
                        </div>
                    </div>
                </div>

                <div class="glass-card">
                    <div class="details-section-title">Test Suite Totals</div>
                    <div class="metric-list">
                        <div class="metric-row">
                            <span class="metric-label">Total Test Cases Executed</span>
                            <span class="metric-value">${data.total}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Passed Tests</span>
                            <span class="metric-value" style="color: var(--color-pass);">${data.passed}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Failed Tests</span>
                            <span class="metric-value" style="color: var(--color-fail);">${data.failed}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Skipped Tests</span>
                            <span class="metric-value" style="color: var(--color-skip);">${data.skipped}</span>
                        </div>
                    </div>
                </div>

                <div class="glass-card">
                    <div class="details-section-title">Slowest Test Executions</div>
                    <div class="slowest-list">
                        ${data.tests
                            .slice()
                            .sort((a: any, b: any) => b.duration - a.duration)
                            .slice(0, 4)
                            .map((t: any) => `
                            <div class="slow-row">
                                <span class="slow-name" title="${t.title}">${t.title}</span>
                                <span class="slow-time">${this.formatDuration(t.duration)}</span>
                            </div>
                            `).join('')}
                    </div>
                </div>
            </div>
        </div>

        <!-- Tab: Attachments -->
        <div id="tab-attachments" class="tab-content">
            <div class="evidence-explorer">
                <div class="evidence-sidebar">
                    <div class="evidence-sidebar-title">Test Cases (${data.tests.filter((t: any) => t.screenshots.length > 0 || t.videos.length > 0 || t.traces.length > 0 || t.consoleLogs || t.networkLogs).length})</div>
                    ${data.tests.filter((t: any) => t.screenshots.length > 0 || t.videos.length > 0 || t.traces.length > 0 || t.consoleLogs || t.networkLogs).map((t: any, idx: number) => `
                        <div class="evidence-test-item ${idx === 0 ? 'active' : ''}" onclick="selectEvidenceTest(this, '${t.id}')" title="${t.title}">
                            ${t.title}
                        </div>
                    `).join('')}
                    ${data.tests.filter((t: any) => t.screenshots.length > 0 || t.videos.length > 0 || t.traces.length > 0 || t.consoleLogs || t.networkLogs).length === 0 ? `
                        <div style="color: var(--text-secondary); font-size: 13px; text-align: center; margin-top: 24px;">No attachments generated.</div>
                    ` : ''}
                </div>
                <div class="evidence-viewer" id="evidence-viewer-content">
                    <!-- Loaded dynamically via JavaScript -->
                    <div class="no-evidence-selected">Select a test case to view attachments</div>
                </div>
            </div>
        </div>
    </main>

    <!-- Lightbox Modal -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
        <button class="lightbox-close">&times;</button>
        <img id="lightbox-img" class="lightbox-img" src="" alt="Zoomed view" onclick="event.stopPropagation();" />
        <div id="lightbox-caption" class="lightbox-caption"></div>
    </div>

    <!-- Embedded Test Database -->
    <script>
        const testData = ${JSON.stringify(data.tests)};
        const totalTestsCount = ${data.total};
        const passedCount = ${data.passed};
        const failedCount = ${data.failed};
        const skippedCount = ${data.skipped};
    </script>

    <script>
        // Set up Donut chart stroke-dasharrays
        window.addEventListener('DOMContentLoaded', () => {
            const radius = 70;
            const circumference = 2 * Math.PI * radius;
            
            const total = totalTestsCount;
            const passPct = total > 0 ? (passedCount / total) : 0;
            const failPct = total > 0 ? (failedCount / total) : 0;
            
            const passStrokeVal = circumference * passPct;
            const failStrokeVal = circumference * failPct;

            const passCircle = document.getElementById('pass-circle');
            const failCircle = document.getElementById('fail-circle');

            if (passCircle) {
                passCircle.style.strokeDasharray = \`\${passStrokeVal} \${circumference}\`;
            }

            if (failCircle) {
                // Fail segment starts offset by the pass segment
                const offset = -passStrokeVal;
                failCircle.style.strokeDasharray = \`\${failStrokeVal} \${circumference}\`;
                failCircle.style.transform = \`rotate(\${(passPct * 360) - 90}deg)\`;
                failCircle.style.transformOrigin = '80px 80px';
            }

            // Auto-load first evidence if present
            const firstActive = document.querySelector('.evidence-test-item.active');
            if (firstActive) {
                firstActive.click();
            }
        });

        // Tab Navigation
        function switchTab(tabId) {
            document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            event.target.classList.add('active');
            document.getElementById('tab-' + tabId).classList.add('active');
        }

        // Accordion Toggle
        function toggleDetails(rowId) {
            const row = document.getElementById(rowId);
            if (row) {
                row.classList.toggle('open');
            }
        }

        // Real-time filters
        function filterTests(listType) {
            const query = document.getElementById('search-' + listType).value.toLowerCase();
            const moduleFilter = document.getElementById('module-' + listType).value;
            const listContainer = document.getElementById('list-' + listType);
            const rows = listContainer.getElementsByClassName('test-row');

            for (let row of rows) {
                const title = row.getAttribute('data-title').toLowerCase();
                const suite = row.getAttribute('data-suite').toLowerCase();
                const mod = row.getAttribute('data-module');
                
                const matchesSearch = title.includes(query) || suite.includes(query);
                const matchesModule = !moduleFilter || mod === moduleFilter;

                if (matchesSearch && matchesModule) {
                    row.style.display = 'block';
                } else {
                    row.style.display = 'none';
                }
            }
        }

        // Lightbox Control
        function openLightbox(src, caption) {
            const box = document.getElementById('lightbox');
            const img = document.getElementById('lightbox-img');
            const cap = document.getElementById('lightbox-caption');
            img.src = src;
            cap.innerText = caption || '';
            box.classList.add('active');
        }

        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
        }

        // Copy stdout/stderr logs
        function copyLogs(buttonId, textId) {
            const text = document.getElementById(textId).innerText;
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById(buttonId);
                const oldText = btn.innerText;
                btn.innerText = 'Copied!';
                setTimeout(() => {
                    btn.innerText = oldText;
                }, 2000);
            });
        }

        // Evidence Explorer Selector
        function selectEvidenceTest(elem, testId) {
            document.querySelectorAll('.evidence-test-item').forEach(item => item.classList.remove('active'));
            elem.classList.add('active');

            const testObj = testData.find(t => t.id === testId);
            const viewer = document.getElementById('evidence-viewer-content');
            
            if (!testObj) {
                viewer.innerHTML = '<div class="no-evidence-selected">Test details not found</div>';
                return;
            }

            let html = \`<div class="details-section-title" style="margin-bottom: 4px; font-size: 16px; color: var(--text-primary);">\${testObj.title}</div>\`;
            html += \`<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 20px;">Suite: \${testObj.suiteName} &bull; Browser: \${testObj.browser}</div>\`;

            html += '<div class="evidence-grid">';

            // Screenshots
            if (testObj.screenshots && testObj.screenshots.length > 0) {
                testObj.screenshots.forEach((s, i) => {
                    html += \`
                    <div class="evidence-card">
                        <div class="evidence-card-title">Screenshot: \${s.description}</div>
                        <img class="evidence-card-preview" src="\${s.path}" alt="Screenshot" onclick="openLightbox('\${s.path}', '\${s.description}')" style="cursor:pointer;" />
                        <a href="\${s.path}" download class="evidence-btn" style="padding: 6px 10px; font-size: 11px; margin-top: auto;">Download PNG</a>
                    </div>
                    \`;
                });
            }

            // Videos
            if (testObj.videos && testObj.videos.length > 0) {
                testObj.videos.forEach((v, i) => {
                    html += \`
                    <div class="evidence-card">
                        <div class="evidence-card-title">Execution Video</div>
                        <video class="evidence-card-preview" controls preload="none">
                            <source src="\${v}" type="video/webm">
                            Your browser does not support webm video.
                        </video>
                        <a href="\${v}" download class="evidence-btn" style="padding: 6px 10px; font-size: 11px; margin-top: auto;">Download Video</a>
                    </div>
                    \`;
                });
            }

            // Traces
            if (testObj.traces && testObj.traces.length > 0) {
                testObj.traces.forEach((t, i) => {
                    const traceViewerUrl = "https://trace.playwright.dev/?trace=" + encodeURIComponent(window.location.origin + '/' + t);
                    html += \`
                    <div class="evidence-card">
                        <div class="evidence-card-title">Playwright Trace</div>
                        <div class="no-preview">Trace Zip Archive</div>
                        <div style="display:flex; flex-direction:column; gap:6px; margin-top: auto;">
                            <a href="\${traceViewerUrl}" target="_blank" class="evidence-btn" style="padding: 6px 10px; font-size: 11px; justify-content: center;">Open Online Trace</a>
                            <a href="\${t}" download class="evidence-btn" style="padding: 6px 10px; font-size: 11px; justify-content: center;">Download Trace Zip</a>
                        </div>
                    </div>
                    \`;
                });
            }

            // Console Logs
            if (testObj.consoleLogs) {
                html += \`
                <div class="evidence-card" style="grid-column: 1 / -1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="evidence-card-title">Console Output</div>
                        <a href="data:text/plain;charset=utf-8,\${encodeURIComponent(testObj.consoleLogs)}" download="console_logs_\${testId}.txt" class="evidence-btn" style="padding: 4px 10px; font-size: 11px;">Download Logs</a>
                    </div>
                    <div class="log-block" id="logs-evid-\${testId}">\${testObj.consoleLogs}</div>
                </div>
                \`;
            }

            // Network Logs
            if (testObj.networkLogs) {
                html += \`
                <div class="evidence-card" style="grid-column: 1 / -1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="evidence-card-title">Network Transactions (XHR/Fetch)</div>
                        <a href="data:text/plain;charset=utf-8,\${encodeURIComponent(testObj.networkLogs)}" download="network_details_\${testId}.txt" class="evidence-btn" style="padding: 4px 10px; font-size: 11px;">Download Details</a>
                    </div>
                    <div class="log-block" id="net-evid-\${testId}">\${testObj.networkLogs}</div>
                </div>
                \`;
            }

            html += '</div>';
            viewer.innerHTML = html;
        }
    </script>
</body>
</html>`;
    }

    private renderTestRowHtml(t: ProcessedTestCase): string {
        const errorId = `error-${t.id}`;
        const copyBtnId = `copy-${t.id}`;
        const logId = `log-${t.id}`;
        const netId = `net-${t.id}`;

        const validationScreenshots = t.screenshots.filter(s => s.type === 'validation' || s.type === 'milestone');
        const startScreenshot = t.screenshots.find(s => s.type === 'start');
        const failScreenshot = t.screenshots.find(s => s.type === 'failure');

        return `
        <div class="test-row ${t.status}" id="row-${t.id}" data-title="${t.title}" data-suite="${t.suiteName}" data-module="${t.fileModule}">
            <div class="test-summary" onclick="toggleDetails('row-${t.id}')">
                <div class="test-header-left">
                    <span class="status-dot ${t.status}"></span>
                    <div class="test-title-container">
                        <span class="test-row-title">${t.title}</span>
                        <span class="test-row-meta">Suite: ${t.suiteName} &bull; Browser: ${t.browser} &bull; Severity: ${t.severity}</span>
                    </div>
                </div>
                <div class="test-header-right">
                    <span class="test-row-duration">${this.formatDuration(t.duration)}</span>
                    <span class="chevron">&#9662;</span>
                </div>
            </div>
            
            <div class="test-details">
                <div class="details-grid">
                    <!-- Steps LEVEL 3 -->
                    <div>
                        <div class="details-section-title">Steps Executed</div>
                        <div class="step-list">
                            ${t.steps.length === 0 ? `
                                <div style="color: var(--text-secondary); font-size: 13px;">No step-by-step detail recorded.</div>
                            ` : t.steps.map(s => `
                                <div class="step-item ${s.status}" style="margin-left: ${s.indent * 16}px;">
                                    <div class="step-info">
                                        <span class="step-icon ${s.status}">${s.status === 'passed' ? '&#10004;' : '&#10008;'}</span>
                                        <span class="step-text">${s.title}</span>
                                    </div>
                                    <span class="step-duration">${this.formatDuration(s.duration)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Details and Proofs -->
                    <div>
                        <div class="details-section-title">Test Context & Proofs</div>
                        
                        <div class="metric-list" style="margin-bottom: 16px;">
                            <div class="metric-row" style="font-size: 13px;">
                                <span class="metric-label">Execution Started</span>
                                <span class="metric-value">${new Date(t.startTime).toLocaleTimeString()}</span>
                            </div>
                            <div class="metric-row" style="font-size: 13px;">
                                <span class="metric-label">Project / Browser</span>
                                <span class="metric-value">${t.browser}</span>
                            </div>
                            <div class="metric-row" style="font-size: 13px;">
                                <span class="metric-label">Target URL Environment</span>
                                <span class="metric-value">${t.environment}</span>
                            </div>
                        </div>

                        <!-- Screenshots Gallery -->
                        ${t.screenshots.length > 0 ? `
                            <div class="details-section-title">Workflow Screenshots (${t.screenshots.length})</div>
                            <div class="screenshot-gallery">
                                ${t.screenshots.map(s => `
                                    <div class="gallery-item">
                                        <img class="gallery-img" src="${s.path}" alt="${s.description}" onclick="openLightbox('${s.path}', '${s.description}')" loading="lazy" />
                                        <div class="gallery-desc">${s.description}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}

                        <!-- Unified Evidence Buttons -->
                        <div class="details-section-title" style="margin-top: 16px;">Evidence Attachments</div>
                        <div class="evidence-links-grid">
                            ${startScreenshot ? `<button class="evidence-btn" onclick="openLightbox('${startScreenshot.path}', 'Start of Test')">🔍 View Start Screenshot</button>` : ''}
                            ${failScreenshot ? `<button class="evidence-btn" onclick="openLightbox('${failScreenshot.path}', 'Failure Screenshot')" style="border-color: rgba(239, 68, 68, 0.3); color: #fca5a5;">🔍 View Failure Screenshot</button>` : ''}
                            ${t.videos.map(v => `<a class="evidence-btn" href="${v}" download>🎥 Download Video</a>`).join('')}
                            ${t.traces.map(tr => `<a class="evidence-btn" href="${tr}" download>📦 Download Trace</a>`).join('')}
                        </div>
                    </div>
                </div>

                <!-- Errors and Stack traces -->
                ${t.status === 'failed' ? `
                    <div style="margin-top: 16px;">
                        <div class="details-section-title" style="color: var(--color-fail);">Error Stack Trace</div>
                        <div class="log-block" id="${errorId}">
                            <button class="copy-btn" id="${copyBtnId}" onclick="copyLogs('${copyBtnId}', '${errorId}')">Copy Stack</button>
                            ${t.fullError || 'No stack trace available.'}
                        </div>
                    </div>
                ` : ''}

                <!-- Console Logs -->
                ${t.consoleLogs ? `
                    <div style="margin-top: 16px;">
                        <div class="details-section-title">Console Logs</div>
                        <div class="log-block" id="${logId}">
                            <button class="copy-btn" id="btn-${logId}" onclick="copyLogs('btn-${logId}', '${logId}')">Copy Logs</button>
                            ${t.consoleLogs}
                        </div>
                    </div>
                ` : ''}

                <!-- Network Details -->
                ${t.networkLogs ? `
                    <div style="margin-top: 16px;">
                        <div class="details-section-title">Network Details (HTTP Request/Response Transactions)</div>
                        <div class="log-block" id="${netId}">
                            <button class="copy-btn" id="btn-${netId}" onclick="copyLogs('btn-${netId}', '${netId}')">Copy Logs</button>
                            ${t.networkLogs}
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }
}
