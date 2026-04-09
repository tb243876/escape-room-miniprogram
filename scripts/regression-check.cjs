'use strict';

const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

const baseSteps = [
  { label: 'lint', command: 'npm', args: ['run', 'lint'] },
  { label: 'phase1', command: 'npm', args: ['run', 'test:phase1'] },
  { label: 'business', command: 'npm', args: ['run', 'test:business'] },
];

const uiSteps = [
  { label: 'ui-smoke', command: 'npm', args: ['run', 'test:ui'] },
  { label: 'ui-player', command: 'npm', args: ['run', 'test:ui:player'] },
  { label: 'ui-staff', command: 'npm', args: ['run', 'test:ui:staff'] },
  { label: 'ui-session', command: 'npm', args: ['run', 'test:ui:session'] },
];

function shouldIncludeUiSteps() {
  return String(process.env.INCLUDE_UI_REGRESSION || '').trim() === '1';
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n[regression] start ${step.label}`);

    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
      cwd: projectRoot,
    });

    child.on('error', (error) => {
      reject(new Error(`${step.label} 启动失败: ${error.message}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`[regression] pass ${step.label}`);
        resolve();
        return;
      }
      reject(new Error(`${step.label} 失败，退出码 ${code}`));
    });
  });
}

async function main() {
  const startedAt = Date.now();
  const includeUiSteps = shouldIncludeUiSteps();
  const steps = includeUiSteps ? baseSteps.concat(uiSteps) : baseSteps;

  if (!includeUiSteps) {
    console.log('[regression] skip UI steps (set INCLUDE_UI_REGRESSION=1 to enable)');
    console.log('[regression] UI steps require WeChat DevTools/automator process and are disabled for plain CI by default');
  }

  for (const step of steps) {
    await runStep(step);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[regression] 全量回归通过，耗时 ${elapsed}s`);
}

main().catch((error) => {
  console.error('\n[regression] 全量回归失败');
  console.error(error.message || error);
  process.exit(1);
});
