'use strict';

const assert = require('assert');
const {
  waitForCondition,
  ensureElement,
  launchMiniProgram,
  setupMockMode,
} = require('./test-helpers/ui-automator-helper.cjs');

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    console.log('[ui-staff] setup');
    await setupMockMode(miniProgram);

    console.log('[ui-staff] auth');
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

    console.log('[ui-staff] dashboard');
    page = await miniProgram.currentPage();
    const dashboardTitle = await ensureElement(page, '.dashboard-title', '工作台标题');
    assert.equal((await dashboardTitle.text()).includes('店长'), true);
    const openSessionButton = await ensureElement(
      page,
      '.dashboard-card-btn',
      '工作台进入场次管理按钮'
    );
    assert.equal((await openSessionButton.text()).includes('进入场次管理'), true);

    console.log('UI 员工链路校验通过');
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('UI 员工链路校验失败');
  console.error(error);
  process.exit(1);
});
