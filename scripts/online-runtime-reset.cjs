'use strict';

const { launchMiniProgram, waitForCondition } = require('./test-helpers/ui-automator-helper.cjs');

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    await miniProgram.reLaunch('/pages/home/index');
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'pages/home/index';
    }, '首页路由');

    const result = await miniProgram.evaluate(() => new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'runtimeReset',
        data: {
          confirmText: 'RESET_GROUP_RUNTIME',
          __dataEnvTag: 'prod',
        },
      }).then((res) => {
        resolve(res && res.result ? res.result : { ok: false, message: 'no-result' });
      }).catch((error) => {
        resolve({
          ok: false,
          message: error && error.message ? error.message : 'runtime-reset-failed',
        });
      });
    }));

    if (!result || !result.ok) {
      throw new Error((result && result.message) || '线上运行态重置失败');
    }

    console.log('线上运行态重置完成');
    console.log(JSON.stringify(result.summary || {}, null, 2));
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('线上运行态重置失败');
  console.error(error);
  process.exit(1);
});
