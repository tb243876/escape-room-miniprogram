'use strict';

const {
  launchMiniProgram,
  waitForCondition,
  sleep,
} = require('./test-helpers/ui-automator-helper.cjs');

const RELEASE_ENV_ID = 'mini-escape-main-9f3bjb2e7249ec8';
const CONFIRM_TEXT = 'CLEAR_ESCAPE_ROOM_DATA';
const FORCE_CONFIRM_TEXT = 'FORCE_CLEAR_ESCAPE_ROOM_DATA';

async function setupProdCloudMode(miniProgram) {
  const targetEnvVersion = process.env.APP_ENV_VERSION || 'release';
  const targetDataEnvTag = process.env.DATA_ENV_TAG || 'prod';

  await miniProgram.evaluate((envId, envVersion, dataEnvTag) => {
    const app = getApp();
    app.globalData.envVersion = envVersion;
    app.globalData.envId = envId;
    app.globalData.dataEnvTag = dataEnvTag;
    app.globalData.useMockData = false;
    app.globalData.useMockGroups = false;
    app.globalData.allowInitData = false;
    app.globalData.allowCloudDataReset = false;
    app.globalData.enablePerfTracing = false;

    if (wx.cloud && typeof wx.cloud.init === 'function') {
      wx.cloud.init({
        env: envId,
        traceUser: true,
      });
    }

    return true;
  }, RELEASE_ENV_ID, targetEnvVersion, targetDataEnvTag);

  await miniProgram.callWxMethod('clearStorageSync');
}

async function waitForProdCloudReady(miniProgram) {
  const targetDataEnvTag = process.env.DATA_ENV_TAG || 'prod';
  await waitForCondition(async () => {
    const runtimeState = await miniProgram.evaluate(() => {
      const app = getApp();
      return {
        hasCloud: Boolean(wx.cloud && typeof wx.cloud.callFunction === 'function'),
        envId: app && app.globalData ? app.globalData.envId : '',
        dataEnvTag: app && app.globalData ? app.globalData.dataEnvTag : '',
        useMockData: app && app.globalData ? app.globalData.useMockData : true,
      };
    });

    return Boolean(
        runtimeState &&
        runtimeState.hasCloud &&
        runtimeState.envId === RELEASE_ENV_ID &&
        runtimeState.dataEnvTag === targetDataEnvTag &&
        runtimeState.useMockData === false
    );
  }, `${targetDataEnvTag} 云环境就绪`, 30000);
}

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    await setupProdCloudMode(miniProgram);
    await miniProgram.reLaunch('/pages/home/index');
    await waitForCondition(async () => {
      const page = await miniProgram.currentPage();
      return page && page.path === 'pages/home/index';
    }, '首页路由');
    await sleep(1200);
    await waitForProdCloudReady(miniProgram);

    const forceConfirmText = process.env.FORCE_CLEAR === '1' ? FORCE_CONFIRM_TEXT : '';
    const targetDataEnvTag = process.env.DATA_ENV_TAG || 'prod';
    const targetEnvVersion = process.env.APP_ENV_VERSION || 'release';

    const result = await miniProgram.evaluate((
      confirmTextValue,
      forceConfirmTextValue,
      dataEnvTag,
      envVersion
    ) => {
      return wx.cloud
        .callFunction({
          name: 'clearData',
          data: {
            confirmText: confirmTextValue,
            forceConfirmText: forceConfirmTextValue,
            __dataEnvTag: dataEnvTag,
            __envVersion: envVersion,
          },
        })
        .then((response) => response.result || null);
    }, CONFIRM_TEXT, forceConfirmText, targetDataEnvTag, targetEnvVersion);

    console.log(JSON.stringify(result, null, 2));

    if (!result || !result.ok) {
      throw new Error((result && result.message) || 'prod-clear-failed');
    }
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('正式环境清空失败');
  console.error(error);
  process.exit(1);
});
