'use strict';

const seedData = require('../cloudfunctions/initData/seed-data');
const {
  launchMiniProgram,
  waitForCondition,
  sleep,
} = require('./test-helpers/ui-automator-helper.cjs');

const RELEASE_ENV_ID = 'mini-escape-main-9f3bjb2e7249ec8';

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
    app.globalData.allowCloudDataReset = false;
    app.globalData.enablePerfTracing = false;

    if (wx.cloud && typeof wx.cloud.init === 'function') {
      wx.cloud.init({
        env: envId,
        traceUser: true,
      });
    }

    return true;
  }, RELEASE_ENV_ID);

  await miniProgram.callWxMethod('clearStorageSync');
}

async function waitForProdCloudReady(miniProgram) {
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
        runtimeState.dataEnvTag === 'prod' &&
        runtimeState.useMockData === false
    );
  }, '正式环境云能力就绪', 30000);
}

function buildDocPayload(item = {}) {
  const nextDoc = {
    ...item,
    updatedAt: new Date().toISOString(),
  };
  delete nextDoc._id;
  return nextDoc;
}

async function seedCollection(miniProgram, collectionName, docs = []) {
  return miniProgram.evaluate(
    async (payload) => {
      const db = wx.cloud.database();
      let successCount = 0;

      for (const item of payload.docs) {
        const docId = String(item._id || item.id || '').trim();
        if (!docId) {
          continue;
        }

        try {
          await db.collection(payload.collectionName).doc(docId).set({
            data: item.data,
          });
          successCount += 1;
        } catch (error) {
          return {
            ok: false,
            collectionName: payload.collectionName,
            successCount,
            failedId: docId,
            message: error && error.message ? error.message : 'seed-failed',
          };
        }
      }

      return {
        ok: true,
        collectionName: payload.collectionName,
        successCount,
      };
    },
    {
      collectionName,
      docs: docs.map((item) => ({
        _id: item._id || item.id,
        id: item.id || item._id,
        data: buildDocPayload(item),
      })),
    }
  );
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

    const themeResult = await seedCollection(miniProgram, 'themes', seedData.themes || []);
    if (!themeResult.ok) {
      throw new Error(themeResult.message || 'themes-seed-failed');
    }

    const activityResult = await seedCollection(
      miniProgram,
      'activities',
      seedData.activities || []
    );
    if (!activityResult.ok) {
      throw new Error(activityResult.message || 'activities-seed-failed');
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          results: {
            themes: themeResult.successCount,
            activities: activityResult.successCount,
          },
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
  console.error('正式环境基础主数据补写失败');
  console.error(error);
  process.exit(1);
});
