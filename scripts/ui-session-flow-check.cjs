'use strict';

const assert = require('assert');
const {
  waitForCondition,
  ensureElement,
  findElementByText,
  launchMiniProgram,
  setupMockMode,
} = require('./test-helpers/ui-automator-helper.cjs');

async function openFirstSession(miniProgram) {
  let page = await miniProgram.reLaunch('/packages/staff/auth-code/index');
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'packages/staff/auth-code/index';
  }, '授权页路由');
  const authInput = await ensureElement(page, '.staff-auth-input', '授权码输入框');
  await authInput.input('OWN826');
  const authButton = await ensureElement(page, '.staff-auth-submit', '授权提交按钮');
  await authButton.tap();
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return currentPage.path === 'packages/staff/dashboard/index';
  }, '工作台跳转', 45000);

  page = await miniProgram.currentPage();
  const openSessionButton = await ensureElement(
    page,
    '.dashboard-card-btn',
    '工作台进入场次管理按钮'
  );
  await openSessionButton.tap();
  await waitForCondition(async () => {
    const currentPage = await miniProgram.currentPage();
    return (
      currentPage.path === 'packages/staff/sessions/index' ||
      currentPage.path === 'packages/staff/session/index'
    );
  }, '进入场次管理');

  page = await miniProgram.currentPage();
  if (page.path === 'packages/staff/sessions/index') {
    const sessionEntryButton = await ensureElement(
      page,
      '.session-btn',
      '场次列表进入详情按钮'
    );
    await sessionEntryButton.tap();
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'packages/staff/session/index';
    }, '进入场次详情');
  }

  return miniProgram.currentPage();
}

async function tapPrimaryActionAndConfirm(page, actionLabel) {
  const primaryAction = await ensureElement(
    page,
    '.action-list .button-primary',
    `${actionLabel}主按钮`
  );
  assert.equal((await primaryAction.text()).includes(actionLabel), true);
  await primaryAction.tap();
  const confirmActionButton = await findElementByText(
    page,
    '.staff-session-dialog-btn',
    '确认执行',
    `${actionLabel}确认按钮`
  );
  await confirmActionButton.tap();
}

async function confirmAllPendingMembers(page) {
  const toggleButtons = await page.$$('.staff-session-member-toggle');
  for (const button of toggleButtons) {
    const text = await button.text();
    if (text.includes('确认到店')) {
      await button.tap();
      await page.waitFor(150);
    }
  }
}

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    console.log('[ui-session] setup');
    await setupMockMode(miniProgram);

    console.log('[ui-session] open');
    let page = await openFirstSession(miniProgram);
    const sessionTitle = await ensureElement(page, '.staff-session-title', '场次管理标题');
    assert.equal((await sessionTitle.text()).length > 0, true);

    console.log('[ui-session] confirm');
    await confirmAllPendingMembers(page);
    await waitForCondition(
      async () => Boolean(await page.data('session.canConfirmMembers')),
      '成员全部确认到店'
    );
    await tapPrimaryActionAndConfirm(page, '确认成员');
    await waitForCondition(
      async () => (await page.data('session.stageLabel')) === '开始场次',
      '确认成员后进入待开始'
    );

    console.log('[ui-session] start');
    await tapPrimaryActionAndConfirm(page, '开始场次');
    await waitForCondition(
      async () => (await page.data('session.stageLabel')) === '结束场次',
      '开始场次后进入进行中'
    );

    console.log('[ui-session] end');
    await tapPrimaryActionAndConfirm(page, '结束场次');
    await waitForCondition(
      async () => (await page.data('session.stageLabel')) === '上传集锦',
      '结束场次后进入待上传集锦'
    );

    console.log('UI 场次链路校验通过');
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('UI 场次链路校验失败');
  console.error(error);
  process.exit(1);
});
