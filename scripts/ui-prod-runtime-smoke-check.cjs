'use strict';

const assert = require('assert');
const {
  waitForCondition,
  ensureElement,
  launchMiniProgram,
} = require('./test-helpers/ui-automator-helper.cjs');

async function setupProdRuntime(miniProgram) {
  await miniProgram.evaluate(() => {
    const app = getApp();
    app.globalData.envVersion = 'trial';
    app.globalData.dataEnvTag = 'prod';
    app.globalData.useMockData = false;
    app.globalData.useMockGroups = false;
    app.globalData.allowMockFallback = false;
    app.globalData.allowInitData = false;
    app.globalData.enablePerfTracing = false;
    return app.globalData;
  });
  await miniProgram.callWxMethod('clearStorageSync');
}

async function waitPageReady(page, successChecker, label) {
  await waitForCondition(async () => {
    const data = await page.data();
    if (data && data.errorText) {
      return true;
    }
    return successChecker(data || {});
  }, label, 45000);
}

async function ensureNoError(page, label) {
  const errorText = await page.data('errorText');
  assert.equal(Boolean(errorText), false, `${label} 出现错误：${errorText || ''}`);
}

async function openFirstRoomIfPossible(miniProgram) {
  let page = await miniProgram.switchTab('/pages/lobby/index');
  await waitPageReady(
    page,
    (data) => Array.isArray(data.groups) && data.hasLoaded,
    '正式环境大厅数据'
  );
  await ensureNoError(page, '正式环境大厅');

  const groups = await page.data('groups');
  const targetGroup = (groups || []).find((item) => item.canOpenRoom);
  if (!targetGroup || !targetGroup.id) {
    return false;
  }

  page = await miniProgram.navigateTo(`/pages/team-room/index?groupId=${targetGroup.id}`);
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'pages/team-room/index';
  }, '正式环境队伍房间路由');
  page = await miniProgram.currentPage();
  await waitPageReady(
    page,
    (data) => Boolean(data.room && data.room.groupId),
    '正式环境队伍房间数据'
  );
  await ensureNoError(page, '正式环境队伍房间');

  const room = await page.data('room');
  assert.equal(Boolean(room && room.groupId), true);

  const members = Array.isArray(room.members) ? room.members : [];
  if (members.length) {
    const memberCard = await ensureElement(page, '.member-item', '正式环境队伍成员卡片');
    await memberCard.tap();
    await waitForCondition(
      async () => Boolean(await page.data('selectedMember.nickname')),
      '正式环境玩家资料卡'
    );
    const playerCardName = await ensureElement(page, '.player-card-name', '正式环境玩家昵称');
    assert.equal((await playerCardName.text()).length > 0, true);
  }

  return true;
}

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    console.log('[ui-prod-smoke] setup prod runtime');
    await setupProdRuntime(miniProgram);

    console.log('[ui-prod-smoke] home');
    let page = await miniProgram.reLaunch('/pages/home/index');
    await waitPageReady(
      page,
      (data) => data.hasLoaded || Array.isArray(data.themeGroups),
      '正式环境首页数据'
    );
    await ensureNoError(page, '正式环境首页');

    console.log('[ui-prod-smoke] lobby');
    page = await miniProgram.switchTab('/pages/lobby/index');
    await waitPageReady(
      page,
      (data) => data.hasLoaded || Array.isArray(data.groups),
      '正式环境大厅数据'
    );
    await ensureNoError(page, '正式环境大厅');

    console.log('[ui-prod-smoke] profile');
    page = await miniProgram.switchTab('/pages/profile/index');
    await waitPageReady(
      page,
      (data) => Boolean(data.profile && data.profile.nickname),
      '正式环境档案数据'
    );
    await ensureNoError(page, '正式环境档案');
    assert.equal(Boolean(await page.data('profile.nickname')), true);

    console.log('[ui-prod-smoke] leaderboard');
    page = await miniProgram.navigateTo('/pages/leaderboard/index');
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'pages/leaderboard/index';
    }, '正式环境排行榜路由');
    page = await miniProgram.currentPage();
    await waitPageReady(
      page,
      (data) => Array.isArray(data.leaderboard),
      '正式环境排行榜数据'
    );
    await ensureNoError(page, '正式环境排行榜');

    console.log('[ui-prod-smoke] team room if available');
    await openFirstRoomIfPossible(miniProgram);

    console.log('正式环境 UI 冒烟校验通过');
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('正式环境 UI 冒烟校验失败');
  console.error(error);
  process.exit(1);
});
