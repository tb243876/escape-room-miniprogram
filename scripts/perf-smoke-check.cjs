'use strict';

const { performance } = require('perf_hooks');
const { setupMockMiniappEnv } = require('./test-helpers/mock-miniapp-env.cjs');

setupMockMiniappEnv();

const service = require('../utils/cloudbase');

async function measure(name, fn, repeat = 3) {
  const costList = [];
  for (let index = 0; index < repeat; index += 1) {
    const start = performance.now();
    await fn();
    costList.push(performance.now() - start);
  }

  const avg = costList.reduce((sum, item) => sum + item, 0) / costList.length;
  const max = Math.max(...costList);
  return { name, avg, max };
}

function assertThreshold(result, threshold) {
  if (result.max > threshold) {
    throw new Error(
      `${result.name} 性能超阈值，max=${result.max.toFixed(2)}ms threshold=${threshold}ms`
    );
  }
}

async function main() {
  service.clearLocalUserData();

  const cases = await Promise.all([
    measure('getHomeData', () => service.getHomeData()),
    measure('getThemes', () => service.getThemes()),
    measure('getActivities', () => service.getActivities()),
    measure('getLobbyList', () => service.getLobbyList()),
    measure('getProfile', () => service.getProfile()),
    measure('getLeaderboard', () => service.getLeaderboard()),
  ]);

  cases.forEach((item) => assertThreshold(item, 500));
  cases.forEach((item) => {
    console.log(`${item.name}: avg=${item.avg.toFixed(2)}ms max=${item.max.toFixed(2)}ms`);
  });
  console.log('性能冒烟校验通过');
}

main().catch((error) => {
  console.error('性能冒烟校验失败');
  console.error(error);
  process.exit(1);
});
