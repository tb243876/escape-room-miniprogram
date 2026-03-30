'use strict';

const assert = require('assert');
const {
  waitForCondition,
  ensureElement,
  launchMiniProgram,
  setupCloudMode,
} = require('./test-helpers/ui-automator-helper.cjs');

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
  await waitForCondition(async () => Boolean(await page.data('selectedPlayer.nickname')), '线上排行榜玩家资料卡');
  const playerName = await ensureElement(page, '.player-card-name', '线上排行榜玩家昵称');
  assert.equal((await playerName.text()).length > 0, true);
  const playerStats = await page.$$('.player-card-stat');
  assert.equal(playerStats.length >= 3, true);
  const closeButton = await ensureElement(page, '.leaderboard-player-btn', '线上排行榜资料关闭按钮');
  await closeButton.tap();
}

async function authStoreManager(miniProgram) {
  let page = await miniProgram.reLaunch('/pages/staff-auth-code/index');
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'pages/staff-auth-code/index';
  }, '线上授权页路由');

  const authInput = await ensureElement(page, '.staff-auth-input', '线上授权码输入框');
  await authInput.input('OWNER2026');
  const authButton = await ensureElement(page, '.staff-auth-submit', '线上授权提交按钮');
  await authButton.tap();
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'pages/staff-dashboard/index';
  }, '线上工作台跳转', 45000);

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
  let page = await miniProgram.navigateTo('/pages/staff-session/index?id=session-group-003');
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'pages/staff-session/index';
  }, '线上场次详情路由');
  page = await miniProgram.currentPage();

  await waitForCondition(async () => {
    const stageLabel = await page.data('session.stageLabel');
    return Boolean(stageLabel);
  }, '线上场次详情数据');

  assert.equal(await page.data('session.stageKey'), 'playing');
  await tapPrimaryActionAndConfirm(page, '结束场次');
  await waitForCondition(async () => (await page.data('session.stageKey')) === 'settled', '线上结束场次后结算', 45000);
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
    console.log('[ui-online] setup cloud mode');
    await setupCloudMode(miniProgram);

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
