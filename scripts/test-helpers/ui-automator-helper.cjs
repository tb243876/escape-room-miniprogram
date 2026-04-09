'use strict';

const path = require('path');
const automator = require('miniprogram-automator');

const projectPath = path.resolve(__dirname, '..', '..');
const cliPath =
  process.env.WECHAT_DEVTOOLS_CLI ||
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(checker, label, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checker()) {
      return;
    }
    await sleep(300);
  }
  throw new Error(`${label} 等待超时`);
}

async function ensureElement(page, selector, label) {
  let target = null;
  await waitForCondition(async () => {
    target = await page.$(selector);
    return Boolean(target);
  }, label);
  return target;
}

async function findElementByText(page, selector, expectedText, label) {
  let matched = null;
  await waitForCondition(async () => {
    const list = await page.$$(selector);
    for (const item of list) {
      const text = await item.text();
      if (String(text || '').includes(expectedText)) {
        matched = item;
        return true;
      }
    }
    return false;
  }, label);
  return matched;
}

async function launchMiniProgram() {
  let lastError = null;
  const preferredPort = Number(process.env.WECHAT_AUTOMATOR_PORT || 9420);

  for (let index = 0; index < 3; index += 1) {
    const port = preferredPort + index;
    try {
      console.log(`[ui-helper] connect attempt ${index + 1} on port ${port}`);
      const connectedMiniProgram = await automator.connect({
        wsEndpoint: `ws://127.0.0.1:${port}`,
      });
      console.log(`[ui-helper] connect ok ${index + 1} on port ${port}`);
      return connectedMiniProgram;
    } catch (error) {
      lastError = error;
      console.log(
        `[ui-helper] connect failed ${index + 1} on port ${port}: ${
          error && error.message ? error.message : error
        }`
      );
    }

    try {
      console.log(`[ui-helper] launch attempt ${index + 1} on port ${port}`);
      const miniProgram = await automator.launch({
        cliPath,
        projectPath,
        timeout: 90000,
        trustProject: true,
        port,
      });
      console.log(`[ui-helper] launch ok ${index + 1} on port ${port}`);
      return miniProgram;
    } catch (error) {
      lastError = error;
      console.log(
        `[ui-helper] launch failed ${index + 1} on port ${port}: ${
          error && error.message ? error.message : error
        }`
      );
      await sleep(1500);
    }
  }

  throw lastError || new Error('mini program launch failed');
}

async function setupMockMode(miniProgram) {
  await miniProgram.evaluate(() => {
    const app = getApp();
    app.globalData.useMockData = true;
    app.globalData.useMockGroups = true;
    app.globalData.enablePerfTracing = false;
    return true;
  });
  await miniProgram.callWxMethod('clearStorageSync');
}

async function setupCloudMode(miniProgram) {
  await miniProgram.evaluate(() => {
    const app = getApp();
    app.globalData.useMockData = false;
    app.globalData.useMockGroups = false;
    app.globalData.enablePerfTracing = false;
    return true;
  });
  await miniProgram.callWxMethod('clearStorageSync');
}

module.exports = {
  sleep,
  waitForCondition,
  ensureElement,
  findElementByText,
  launchMiniProgram,
  setupMockMode,
  setupCloudMode,
};
