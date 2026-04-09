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
    console.log('[ui-online] runtimeState', runtimeState);

    return Boolean(
      runtimeState &&
      runtimeState.hasCloud &&
      runtimeState.envId === RELEASE_ENV_ID &&
      runtimeState.useMockData === false &&
      runtimeState.dataEnvTag === 'prod'
    );
  }, '线上正式云环境就绪');
}

async function bootstrapTestEnv(miniProgram) {
  let lastError = null;
  for (let index = 0; index < 3; index += 1) {
    try {
      console.log(`[ui-online] bootstrap attempt ${index + 1}`);
      let page = await miniProgram.reLaunch('/packages/staff/auth-code/index');
      await waitForCondition(async () => {
        const currentPage = await miniProgram.currentPage();
        return currentPage.path === 'packages/staff/auth-code/index';
      }, '线上授权页路由');

      const authInput = await ensureElement(page, '.staff-auth-input', '线上授权码输入框');
      await authInput.input(STORE_MANAGER_AUTH_CODE);
      console.log('[ui-online] auth code input done');
      const authButton = await ensureElement(page, '.staff-auth-submit', '线上授权提交按钮');
      await authButton.tap();
      console.log('[ui-online] auth submit tapped');
      await waitForCondition(
        async () => {
          const currentPage = await miniProgram.currentPage();
          if (currentPage.path === 'packages/staff/auth-code/index') {
            console.log('[ui-online] auth page state', {
              errorText: await currentPage.data('errorText'),
              isSubmitting: await currentPage.data('isSubmitting'),
            });
          }
          return currentPage.path === 'packages/staff/dashboard/index';
        },
        '线上工作台跳转',
        45000
      );

      page = await miniProgram.reLaunch('/pages/home/index');
      console.log('[ui-online] relaunched home');
      await waitForCondition(async () => {
        const currentPage = await miniProgram.currentPage();
        return currentPage.path === 'pages/home/index';
      }, '线上首页路由');
      await waitForCloudReady(miniProgram);
      await sleep(2000);

      page = await miniProgram.currentPage();
      const themeGroups = (await page.data('themeGroups')) || [];
      console.log('[ui-online] home data', {
        emptyStateTitle: await page.data('emptyStateTitle'),
        emptyStateText: await page.data('emptyStateText'),
        themeGroupCount: Array.isArray(themeGroups) ? themeGroups.length : 0,
      });
      if (!Array.isArray(themeGroups) || !themeGroups.length) {
        throw new Error('首页当前没有可用主题数据，初始化入口已下线，请先通过后台准备测试数据');
      }
      return;
    } catch (error) {
      console.error(`[ui-online] bootstrap attempt ${index + 1} failed`);
      console.error(error);
      lastError = error;
    }
    await sleep(1500);
  }

  throw lastError || new Error('测试环境初始化失败');
}

async function openLeaderboardAndCheck(miniProgram) {
  let page = await miniProgram.reLaunch('/pages/leaderboard/index');
  await waitForCondition(async () => {
    const data = await page.data();
    return Boolean((Array.isArray(data.leaderboard) && data.leaderboard.length) || data.errorText);
  }, '线上排行榜数据');

  const summary = await page.data('summary');
  assert.equal(Number(summary.totalPlayers || 0) > 0, true);

  const firstCard = await ensureElement(page, '.leaderboard-card', '线上排行榜首条');
  await firstCard.tap();
  await waitForCondition(
    async () => Boolean(await page.data('selectedPlayer.nickname')),
    '线上排行榜玩家资料卡'
  );
  const playerName = await ensureElement(page, '.player-card-name', '线上排行榜玩家昵称');
  assert.equal((await playerName.text()).length > 0, true);
  const playerStats = await page.$$('.player-card-stat');
  assert.equal(playerStats.length >= 3, true);
  const closeButton = await ensureElement(
    page,
    '.leaderboard-player-btn',
    '线上排行榜资料关闭按钮'
  );
  await closeButton.tap();
}

async function authStoreManager(miniProgram) {
  let page = await miniProgram.reLaunch('/packages/staff/auth-code/index');
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'packages/staff/auth-code/index';
  }, '线上授权页路由');

  const authInput = await ensureElement(page, '.staff-auth-input', '线上授权码输入框');
  await authInput.input(STORE_MANAGER_AUTH_CODE);
  const authButton = await ensureElement(page, '.staff-auth-submit', '线上授权提交按钮');
  await authButton.tap();
  await waitForCondition(
    async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'packages/staff/dashboard/index';
    },
    '线上工作台跳转',
    45000
  );

  page = await miniProgram.currentPage();
  const dashboardTitle = await ensureElement(page, '.dashboard-title', '线上工作台标题');
  assert.equal((await dashboardTitle.text()).includes('店长'), true);
}

async function tapPrimaryActionAndConfirm(page, actionLabel) {
  const primaryAction = await ensureElement(
    page,
    '.action-list .button-primary',
    `线上${actionLabel}主按钮`
  );
  assert.equal((await primaryAction.text()).includes(actionLabel), true);
  await primaryAction.tap();
  const dialogButtons = await page.$$('.staff-session-dialog-btn');
  let confirmButton = null;
  for (const button of dialogButtons) {
    const text = await button.text();
    if (String(text || '').includes('确认执行')) {
      confirmButton = button;
      break;
    }
  }
  assert.equal(Boolean(confirmButton), true);
  await confirmButton.tap();
}

async function endOnlinePlayingSession(miniProgram) {
  let page = await miniProgram.navigateTo('/packages/staff/session/index?id=session-group-003');
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'packages/staff/session/index';
  }, '线上场次详情路由');
  page = await miniProgram.currentPage();

  await waitForCondition(async () => {
    const stageLabel = await page.data('session.stageLabel');
    return Boolean(stageLabel);
  }, '线上场次详情数据');

  assert.equal(await page.data('session.stageKey'), 'playing');
  await tapPrimaryActionAndConfirm(page, '结束场次');
  await waitForCondition(
    async () => (await page.data('session.stageKey')) === 'settled',
    '线上结束场次后结算',
    45000
  );
}

async function checkOnlineTeamRoom(miniProgram) {
  let page = await miniProgram.navigateTo('/pages/team-room/index?groupId=group-003');
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'pages/team-room/index';
  }, '线上队伍房间路由');
  page = await miniProgram.currentPage();

  await waitForCondition(async () => {
    const stage = await page.data('room.stage');
    return Boolean(stage);
  }, '线上队伍房间数据');

  assert.equal(await page.data('room.stage'), 'settled');
  const memberCard = await ensureElement(page, '.member-item', '线上队伍成员卡片');
  await memberCard.tap();
  const playerCardName = await ensureElement(page, '.player-card-name', '线上队伍成员资料卡');
  assert.equal((await playerCardName.text()).length > 0, true);
}

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    console.log('[ui-online] setup prod cloud mode');
    await setupProdCloudMode(miniProgram);

    console.log('[ui-online] bootstrap trial/prod runtime');
    await bootstrapTestEnv(miniProgram);

    console.log('[ui-online] leaderboard');
    await openLeaderboardAndCheck(miniProgram);

    console.log('[ui-online] staff auth');
    await authStoreManager(miniProgram);

    console.log('[ui-online] end session');
    await endOnlinePlayingSession(miniProgram);

    console.log('[ui-online] team room');
    await checkOnlineTeamRoom(miniProgram);

    console.log('UI 线上链路校验通过');
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('UI 线上链路校验失败');
  console.error(error);
  process.exit(1);
});
