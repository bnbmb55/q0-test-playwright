const { spawnSync } = require('child_process');

const suppliedArguments = process.argv.slice(2);
const smokeIndex = suppliedArguments.indexOf('--smoke');
const environment = { ...process.env };

if (smokeIndex >= 0) {
    suppliedArguments.splice(smokeIndex, 1);
    environment.PLAYWRIGHT_SMOKE = 'true';
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['playwright', 'test', ...suppliedArguments], {
    stdio: 'inherit',
    env: environment
});

process.exit(result.status ?? 1);
