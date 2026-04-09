'use strict';

const {
  launchMiniProgram,
  waitForCondition,
  sleep,
} = require('./test-helpers/ui-automator-helper.cjs');

const RELEASE_ENV_ID = 'mini-escape-main-9f3bjb2e7249ec8';

async function setupProdRuntime(miniProgram) {
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

    return app.globalData;
  }, RELEASE_ENV_ID);

  await miniProgram.callWxMethod('clearStorageSync');
}

async function waitForCloudReady(miniProgram) {
  await waitForCondition(async () => {
    const runtimeState = await miniProgram.evaluate(() => {
      const app = getApp();
      return {
        hasCloud: Boolean(wx.cloud && typeof wx.cloud.database === 'function'),
        envId: app && app.globalData ? app.globalData.envId : '',
        dataEnvTag: app && app.globalData ? app.globalData.dataEnvTag : '',
      };
    });

    return Boolean(
      runtimeState &&
        runtimeState.hasCloud &&
        runtimeState.envId === RELEASE_ENV_ID &&
        runtimeState.dataEnvTag === 'prod'
    );
  }, 'trial/prod 云能力就绪', 30000);
}

async function main() {
  const miniProgram = await launchMiniProgram();

  try {
    await setupProdRuntime(miniProgram);
    await miniProgram.reLaunch('/pages/home/index');
    await waitForCondition(async () => {
      const page = await miniProgram.currentPage();
      return page && page.path === 'pages/home/index';
    }, '首页路由');
    await sleep(1200);
    await waitForCloudReady(miniProgram);

    const result = await miniProgram.evaluate(async () => {
      const db = wx.cloud.database();

      async function inspectCollection(collectionName, options = {}) {
        const collection = db.collection(collectionName);
        const countResult = await collection.count();
        let query = collection;

        if (options.where) {
          query = query.where(options.where);
        }
        if (options.orderBy) {
          query = query.orderBy(options.orderBy.field, options.orderBy.order);
        }

        const listResult = await query.limit(options.limit || 5).get();
        return {
          total: Number((countResult && countResult.total) || 0),
          sample: listResult.data || [],
        };
      }

      const themesOnline = await inspectCollection('themes', {
        where: { status: 'online' },
        orderBy: { field: 'sort', order: 'asc' },
      });
      const activities = await inspectCollection('activities', {
        orderBy: { field: 'sort', order: 'asc' },
      });
      const authCodes = await inspectCollection('staff_auth_codes', {
        orderBy: { field: 'createdAt', order: 'asc' },
      });

      return {
        ok: true,
        themesOnline,
        activities,
        authCodes,
      };
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('正式目录数据检查失败');
  console.error(error);
  process.exit(1);
});
