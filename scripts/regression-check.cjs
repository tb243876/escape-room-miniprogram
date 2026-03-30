'use strict';

const { spawn } = require('child_process');

const steps = [
  { label: 'lint', command: 'npm', args: ['run', 'lint'] },
  { label: 'phase1', command: 'npm', args: ['run', 'test:phase1'] },
  { label: 'business', command: 'npm', args: ['run', 'test:business'] },
  { label: 'groups', command: 'npm', args: ['run', 'test:groups'] },
  { label: 'flows', command: 'npm', args: ['run', 'test:flows'] },
  { label: 'api', command: 'npm', args: ['run', 'test:api'] },
  { label: 'perf', command: 'npm', args: ['run', 'test:perf'] },
  { label: 'ui-smoke', command: 'npm', args: ['run', 'test:ui'] },
  { label: 'ui-player', command: 'npm', args: ['run', 'test:ui:player'] },
  { label: 'ui-staff', command: 'npm', args: ['run', 'test:ui:staff'] },
  { label: 'ui-session', command: 'npm', args: ['run', 'test:ui:session'] },
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    console.log(`\n[regression] start ${step.label}`);

    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
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
