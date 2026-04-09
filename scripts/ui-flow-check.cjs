'use strict';

const assert = require('assert');
const {
  waitForCondition,
  ensureElement,
  launchMiniProgram,
  setupMockMode,
} = require('./test-helpers/ui-automator-helper.cjs');

async function main() {
  console.log('[ui] launch');
  const miniProgram = await launchMiniProgram();

  try {
    console.log('[ui] setup');
    await setupMockMode(miniProgram);

    console.log('[ui] home');
    let page = await miniProgram.reLaunch('/pages/home/index');
    await waitForCondition(async () => {
      const data = await page.data();
      return Boolean(
        (Array.isArray(data.themeGroups) && data.themeGroups.length) || data.errorText
      );
    }, '首页数据');
    const homeData = await page.data();
    assert.equal(Array.isArray(homeData.themeGroups), true);
    assert.equal(Boolean(homeData.errorText), false);

    console.log('[ui] lobby');
    page = await miniProgram.switchTab('/pages/lobby/index');
    await waitForCondition(async () => {
      const data = await page.data();
      return Boolean((Array.isArray(data.groups) && data.groups.length) || data.errorText);
    }, '大厅数据');
    const lobbyButton = await ensureElement(page, '.lobby-hero-btn', '大厅发起按钮');
    assert.equal((await lobbyButton.text()).includes('去发起队伍'), true);

    console.log('[ui] lobby-create');
    page = await miniProgram.navigateTo('/pages/lobby-create/index');
    await waitForCondition(async () => {
      const data = await page.data();
      return Boolean(
        (Array.isArray(data.themeOptions) && data.themeOptions.length) || data.errorText
      );
    }, '发起组局页数据');
    const targetPeopleInput = await ensureElement(page, '.create-target-input', '目标人数输入框');
    const contactNameInput = await ensureElement(page, '.create-contact-input', '联系人称呼输入框');
    const contactPhoneInput = await ensureElement(
      page,
      '.create-phone-input',
      '联系人手机号输入框'
    );
    assert.equal(Boolean(targetPeopleInput && contactNameInput && contactPhoneInput), true);
    await contactNameInput.input('阿杰');
    await contactPhoneInput.input('12345');
    const submitButton = await ensureElement(
      page,
      '.create-action-row .button-primary',
      '创建组局提交按钮'
    );
    await submitButton.tap();
    await page.waitFor(600);
    assert.equal(await page.data('errorField'), 'contactPhone');

    console.log('[ui] profile');
    page = await miniProgram.reLaunch('/pages/profile/index');
    await waitForCondition(async () => {
      const data = await page.data();
      return Boolean(data.profile || data.errorText);
    }, '档案页数据');
    const profileName = await ensureElement(page, '.profile-name', '档案昵称');
    assert.equal((await profileName.text()).length > 0, true);
    const editLink = await ensureElement(page, '.profile-edit-link', '档案编辑入口');
    await editLink.tap();
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
        return currentPage.path === 'packages/profile/edit/index';
    }, '进入资料编辑页');
    page = await miniProgram.currentPage();
    const editInputs = await page.$$('.edit-input');
    assert.equal(editInputs.length >= 1, true);
    await editInputs[0].input('自动化昵称');
    const editTextarea = await ensureElement(page, '.edit-textarea', '档案签名输入框');
    await editTextarea.input('这是 UI 自动化改写的签名');
    const saveButton = await ensureElement(page, '.edit-actions .button-primary', '资料保存按钮');
    await saveButton.tap();
    await waitForCondition(
      async () => {
        const currentPage = await miniProgram.currentPage();
        return currentPage.path === 'pages/profile/index';
      },
      '保存资料返回档案页',
      45000
    );
    page = await miniProgram.currentPage();
    await waitForCondition(async () => {
      const nickname = await page.data('profile.nickname');
      return String(nickname || '').includes('自动化昵称');
    }, '档案昵称刷新');
    const refreshedProfileName = await ensureElement(page, '.profile-name', '保存后的档案昵称');
    assert.equal((await refreshedProfileName.text()).includes('自动化昵称'), true);

    console.log('[ui] staff-auth');
    page = await miniProgram.reLaunch('/packages/staff/auth-code/index');
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'packages/staff/auth-code/index';
    }, '授权页路由');
    const authInput = await ensureElement(page, '.staff-auth-input', '授权码输入框');
    await authInput.input('OWN826');
    const authButton = await ensureElement(page, '.staff-auth-submit', '授权提交按钮');
    await authButton.tap();
    await waitForCondition(
      async () => {
        const currentPage = await miniProgram.currentPage();
        return currentPage.path === 'packages/staff/dashboard/index';
      },
      '工作台跳转',
      45000
    );

    console.log('[ui] staff-dashboard');
    page = await miniProgram.currentPage();
    const dashboardTitle = await ensureElement(page, '.dashboard-title', '工作台标题');
    assert.equal((await dashboardTitle.text()).includes('店长'), true);

    console.log('UI 自动化校验通过');
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('UI 自动化校验失败');
  console.error(error);
  process.exit(1);
});
