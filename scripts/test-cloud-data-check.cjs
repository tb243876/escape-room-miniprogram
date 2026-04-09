'use strict';

const assert = require('assert');
const {
  waitForCondition,
  ensureElement,
  launchMiniProgram,
  sleep,
} = require('./test-helpers/ui-automator-helper.cjs');

const RELEASE_ENV_ID = 'mini-escape-main-9f3bjb2e7249ec8';
const STORE_MANAGER_AUTH_CODE = 'OWN826';

async function setupProdCloudMode(miniProgram) {
  await miniProgram.evaluate((envId) => {
    const app = getApp();
    app.globalData.envVersion = 'trial';
    app.globalData.envId = envId;
    app.globalData.dataEnvTag = 'prod';
    app.globalData.useMockData = false;
    app.globalData.useMockGroups = false;
    app.globalData.allowMockFallback = false;
    app.globalData.allowInitData = false;
    app.globalData.enablePerfTracing = false;

    if (wx.cloud && typeof wx.cloud.init === 'function') {
      wx.cloud.init({
        env: envId,
        traceUser: true,
      });
    }

    return app.globalData;
  }, RELEASE_ENV_ID);
  await miniProgram.callWxMethod('clearStorageSync');
}

async function waitForCloudReady(miniProgram) {
  await waitForCondition(async () => {
    const runtimeState = await miniProgram.evaluate(() => {
      const app = getApp();
      return {
        hasCloud: Boolean(wx.cloud && typeof wx.cloud.callFunction === 'function'),
        envId: app && app.globalData ? app.globalData.envId : '',
        useMockData: app && app.globalData ? app.globalData.useMockData : true,
        dataEnvTag: app && app.globalData ? app.globalData.dataEnvTag : '',
      };
    });
    console.log('[test-cloud] runtimeState', runtimeState);

    return Boolean(
      runtimeState &&
      runtimeState.hasCloud &&
      runtimeState.envId === RELEASE_ENV_ID &&
      runtimeState.useMockData === false &&
      runtimeState.dataEnvTag === 'prod'
    );
  }, '正式云环境就绪');
}

async function bootstrapTestEnv(miniProgram) {
  let lastError = null;
  for (let index = 0; index < 3; index += 1) {
    try {
      console.log(`[test-cloud] bootstrap attempt ${index + 1}`);
      let page = await miniProgram.reLaunch('/packages/staff/auth-code/index');
      await waitForCondition(async () => {
        const currentPage = await miniProgram.currentPage();
        return currentPage.path === 'packages/staff/auth-code/index';
      }, '授权页路由');
      const authInput = await ensureElement(page, '.staff-auth-input', '授权码输入框');
      await authInput.input(STORE_MANAGER_AUTH_CODE);
      console.log('[test-cloud] auth code input done');
      const authButton = await ensureElement(page, '.staff-auth-submit', '授权提交按钮');
      await authButton.tap();
      console.log('[test-cloud] auth submit tapped');
      await waitForCondition(
        async () => {
          const currentPage = await miniProgram.currentPage();
          if (currentPage.path === 'packages/staff/auth-code/index') {
            console.log('[test-cloud] auth page state', {
              errorText: await currentPage.data('errorText'),
              isSubmitting: await currentPage.data('isSubmitting'),
            });
          }
          return currentPage.path === 'packages/staff/dashboard/index';
        },
        '工作台跳转',
        45000
      );

      page = await miniProgram.reLaunch('/pages/home/index');
      console.log('[test-cloud] relaunched home');
      await waitForCondition(async () => {
        const currentPage = await miniProgram.currentPage();
        return currentPage.path === 'pages/home/index';
      }, '首页路由');
      await waitForCloudReady(miniProgram);
      await sleep(2000);

      page = await miniProgram.currentPage();
      const themeGroups = (await page.data('themeGroups')) || [];
      console.log('[test-cloud] home data', {
        emptyStateTitle: await page.data('emptyStateTitle'),
        emptyStateText: await page.data('emptyStateText'),
        themeGroupCount: Array.isArray(themeGroups) ? themeGroups.length : 0,
      });
      if (!Array.isArray(themeGroups) || !themeGroups.length) {
        throw new Error('首页当前没有可用主题数据，初始化入口已下线，请先通过后台准备测试数据');
      }
      return {
        ok: true,
        themeGroups,
      };
    } catch (error) {
      console.error(`[test-cloud] bootstrap attempt ${index + 1} failed`);
      console.error(error);
      lastError = error;
    }
    await sleep(1500);
  }

  throw lastError || new Error('测试环境初始化失败');
}

async function verifyLeaderboard(miniProgram) {
  console.log('[test-cloud] verify leaderboard');
  let page = await miniProgram.reLaunch('/pages/leaderboard/index');
  await waitForCondition(async () => {
    const data = await page.data();
    return Boolean((Array.isArray(data.leaderboard) && data.leaderboard.length) || data.errorText);
  }, '排行榜数据');

  const summary = await page.data('summary');
  console.log('[test-cloud] leaderboard summary', summary);
  assert.equal(Number(summary.totalPlayers || 0) > 0, true);

  const firstCard = await ensureElement(page, '.leaderboard-card', '排行榜首条');
  await firstCard.tap();
  await waitForCondition(
    async () => Boolean(await page.data('selectedPlayer.nickname')),
    '排行榜玩家资料卡'
  );
}

async function verifyStaffSession(miniProgram) {
  console.log('[test-cloud] verify staff session');
  const page = await miniProgram.navigateTo('/packages/staff/session/index?id=session-group-003');
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'packages/staff/session/index';
  }, '场次详情路由');

  const currentPage = await miniProgram.currentPage();
  await waitForCondition(
    async () => Boolean(await currentPage.data('session.stageKey')),
    '场次详情数据'
  );
  console.log('[test-cloud] session data', await currentPage.data('session'));
  assert.equal(await currentPage.data('session.stageKey'), 'playing');
}

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    await setupProdCloudMode(miniProgram);
    await miniProgram.reLaunch('/pages/home/index');
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'pages/home/index';
    }, '首页路由');

    const bootstrap = await bootstrapTestEnv(miniProgram);
    assert.equal(Array.isArray(bootstrap.themeGroups) && bootstrap.themeGroups.length > 0, true);

    await verifyLeaderboard(miniProgram);
    await verifyStaffSession(miniProgram);

    console.log('测试环境数据校验通过');
    console.log(
      JSON.stringify(
        {
          themeGroupCount: bootstrap.themeGroups.length,
          verifiedFlow: ['home', 'leaderboard', 'staff-auth', 'staff-session'],
        },
        null,
        2
      )
    );
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('测试环境数据校验失败');
  console.error(error);
  process.exit(1);
});
