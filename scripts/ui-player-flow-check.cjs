'use strict';

const assert = require('assert');
const {
  waitForCondition,
  ensureElement,
  findElementByText,
  launchMiniProgram,
  setupMockMode,
} = require('./test-helpers/ui-automator-helper.cjs');

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    console.log('[ui-player] setup');
    await setupMockMode(miniProgram);

    console.log('[ui-player] home');
    let page = await miniProgram.reLaunch('/pages/home/index');
    await waitForCondition(async () => {
      const data = await page.data();
      return Boolean((Array.isArray(data.themeGroups) && data.themeGroups.length) || data.errorText);
    }, '首页数据');
    const homeData = await page.data();
    assert.equal(Array.isArray(homeData.themeGroups), true);
    assert.equal(Boolean(homeData.errorText), false);

    console.log('[ui-player] lobby');
    page = await miniProgram.switchTab('/pages/lobby/index');
    await waitForCondition(async () => {
      const data = await page.data();
      return Boolean((Array.isArray(data.groups) && data.groups.length) || data.errorText);
    }, '大厅数据');
    const lobbyCreateEntry = await findElementByText(page, '.section-title text', '去发起', '大厅发起入口');
    assert.equal((await lobbyCreateEntry.text()).includes('去发起'), true);
    const currentLobbyPage = await miniProgram.currentPage();
    assert.equal(currentLobbyPage.path, 'pages/lobby/index');

    console.log('[ui-player] lobby-create');
    page = await miniProgram.navigateTo('/pages/lobby-create/index');
    await waitForCondition(async () => {
      const data = await page.data();
      return Boolean((Array.isArray(data.themeOptions) && data.themeOptions.length) || data.errorText);
    }, '发起组局页数据');
    const targetPeopleInput = await ensureElement(page, '.create-target-input', '目标人数输入框');
    const contactNameInput = await ensureElement(page, '.create-contact-input', '联系人称呼输入框');
    const contactPhoneInput = await ensureElement(page, '.create-phone-input', '联系人手机号输入框');
    assert.equal(Boolean(targetPeopleInput && contactNameInput && contactPhoneInput), true);
    await contactNameInput.input('阿杰');
    await contactPhoneInput.input('12345');
    const submitButton = await ensureElement(page, '.create-action-row .button-primary', '创建组局提交按钮');
    await submitButton.tap();
    await page.waitFor(600);
    assert.equal(await page.data('errorField'), 'contactPhone');
    await contactPhoneInput.input('13900000000');
    await submitButton.tap();
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'pages/lobby/index';
    }, '创建组局成功回到大厅', 45000);

    page = await miniProgram.currentPage();
    await waitForCondition(async () => {
      const data = await page.data();
      return Array.isArray(data.groups) && data.groups.some((item) => item.isMyActiveGroup);
    }, '大厅出现我发起的组局');
    const myTab = await findElementByText(page, '.lobby-filter-chip', '我的', '我的组局切换');
    await myTab.tap();
    await waitForCondition(async () => (await page.data('activePage')) === 'mine', '切换到我的组局');
    const ownerSeal = await ensureElement(page, '.lobby-owner-seal', '我发起的标识');
    assert.equal((await ownerSeal.text()).includes('我发起的'), true);

    const openRoomButton = await findElementByText(
      page,
      '.lobby-owner-actions .button-secondary',
      '看',
      '我发起组局查看房间按钮'
    );
    await openRoomButton.tap();
    await waitForCondition(async () => {
      const currentPage = await miniProgram.currentPage();
      return currentPage.path === 'pages/team-room/index';
    }, '进入队伍房间');
    page = await miniProgram.currentPage();
    const roomTitle = await ensureElement(page, '.room-title', '队伍房间标题');
    assert.equal((await roomTitle.text()).length > 0, true);
    const memberCard = await ensureElement(page, '.member-item', '队伍成员卡片');
    await memberCard.tap();
    const playerCardName = await ensureElement(page, '.player-card-name', '玩家卡片昵称');
    assert.equal((await playerCardName.text()).length > 0, true);
    const playerCardStats = await page.$$('.player-card-stat');
    assert.equal(playerCardStats.length >= 3, true);

    console.log('UI 玩家链路校验通过');
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('UI 玩家链路校验失败');
  console.error(error);
  process.exit(1);
});
