'use strict';

const {
  launchMiniProgram,
  waitForCondition,
  sleep,
} = require('./test-helpers/ui-automator-helper.cjs');

const RELEASE_ENV_ID = 'mini-escape-main-9f3bjb2e7249ec8';

async function setupCloudMode(miniProgram, envVersion, dataEnvTag) {
  await miniProgram.evaluate((envId, nextEnvVersion, nextDataEnvTag) => {
    const app = getApp();
    app.globalData.envVersion = nextEnvVersion;
    app.globalData.envId = envId;
    app.globalData.dataEnvTag = nextDataEnvTag;
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
  }, RELEASE_ENV_ID, envVersion, dataEnvTag);

  await miniProgram.callWxMethod('clearStorageSync');
}

async function waitForCloudReady(miniProgram, dataEnvTag) {
  await waitForCondition(async () => {
    const runtimeState = await miniProgram.evaluate(() => {
      const app = getApp();
      return {
        hasCloud: Boolean(wx.cloud && typeof wx.cloud.database === 'function'),
        envId: app && app.globalData ? app.globalData.envId : '',
        dataEnvTag: app && app.globalData ? app.globalData.dataEnvTag : '',
        useMockData: app && app.globalData ? app.globalData.useMockData : true,
      };
    });

    return Boolean(
      runtimeState &&
        runtimeState.hasCloud &&
        runtimeState.envId === RELEASE_ENV_ID &&
        runtimeState.dataEnvTag === dataEnvTag &&
        runtimeState.useMockData === false
    );
  }, `${dataEnvTag} 环境就绪`, 30000);
}

async function seedCode(miniProgram, options) {
  const {
    envVersion,
    dataEnvTag,
    code,
    storeName = '迷场档案馆',
  } = options;

  await setupCloudMode(miniProgram, envVersion, dataEnvTag);
  await miniProgram.reLaunch('/pages/home/index');
  await waitForCondition(async () => {
    const page = await miniProgram.currentPage();
    return page && page.path === 'pages/home/index';
  }, '首页路由');
  await sleep(1200);
  await waitForCloudReady(miniProgram, dataEnvTag);

  const result = await miniProgram.evaluate((payload) => {
    const db = wx.cloud.database();
    const collectionName = 'staff_auth_codes';
    return db
      .collection(collectionName)
      .doc(payload.code)
      .set({
        data: {
          role: 'store_manager',
          roleLabel: '店长',
          storeName: payload.storeName,
          status: 'active',
          createdAt: new Date().toISOString(),
        },
      })
      .then(() => ({
        ok: true,
        collectionName,
        code: payload.code,
      }))
      .catch((error) => ({
        ok: false,
        collectionName,
        code: payload.code,
        message: error && error.message ? error.message : 'seed-failed',
      }));
  }, {
    dataEnvTag,
    code,
    storeName,
  });

  if (!result || !result.ok) {
    throw new Error((result && result.message) || `${dataEnvTag}-seed-failed`);
  }

  return result;
}

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    const prodResult = await seedCode(miniProgram, {
      envVersion: 'trial',
      dataEnvTag: 'prod',
      code: 'OWN826',
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          seeded: [prodResult],
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
  console.error('店长授权码补写失败');
  console.error(error);
  process.exit(1);
});
