'use strict';

const {
  launchMiniProgram,
  waitForCondition,
  sleep,
} = require('./test-helpers/ui-automator-helper.cjs');

const RELEASE_ENV_ID = 'mini-escape-main-9f3bjb2e7249ec8';
const SEED_GROUP_IDS = ['group-001', 'group-002', 'group-003'];
const SEED_SESSION_IDS = ['session-group-001', 'session-group-002', 'session-group-003'];
const TARGET_COLLECTIONS = [
  'profiles',
  'groups',
  'staff_sessions',
  'staff_highlights',
  'staff_bindings',
];

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
  }, 'trial/prod 云环境就绪', 30000);
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

    const result = await miniProgram.evaluate((payload) => {
      const db = wx.cloud.database();

      function hasSeedOpenId(value) {
        return String(value || '').startsWith('seed-user-');
      }

      function getDocId(doc = {}) {
        return String((doc && doc._id) || (doc && doc.id) || '').trim();
      }

      async function listAll(collectionName) {
        const collection = db.collection(collectionName);
        const countResult = await collection.count();
        const total = Number((countResult && countResult.total) || 0);
        const pageSize = 100;
        const tasks = [];

        for (let offset = 0; offset < total; offset += pageSize) {
          tasks.push(collection.skip(offset).limit(pageSize).get());
        }

        const results = await Promise.all(tasks);
        return results.reduce((list, item) => list.concat(item.data || []), []);
      }

      function shouldDeleteProfile(doc = {}) {
        return hasSeedOpenId(doc._id);
      }

      function shouldDeleteGroup(doc = {}) {
        if (payload.seedGroupIds.includes(getDocId(doc))) {
          return true;
        }
        if (hasSeedOpenId(doc.creatorOpenId)) {
          return true;
        }
        return Array.isArray(doc.participants) && doc.participants.some((item) => hasSeedOpenId(item && item.openId));
      }

      function shouldDeleteSession(doc = {}) {
        if (payload.seedSessionIds.includes(getDocId(doc))) {
          return true;
        }
        if (payload.seedGroupIds.includes(String(doc.groupId || '').trim())) {
          return true;
        }
        return Array.isArray(doc.members) && doc.members.some((item) => hasSeedOpenId(item && item.openId));
      }

      function shouldDeleteHighlight(doc = {}) {
        if (payload.seedSessionIds.includes(String(doc.sessionId || '').trim())) {
          return true;
        }
        if (payload.seedGroupIds.includes(String(doc.groupId || '').trim())) {
          return true;
        }
        return Array.isArray(doc.members) && doc.members.some((item) => hasSeedOpenId(item && item.openId));
      }

      function shouldDeleteBinding(doc = {}) {
        return hasSeedOpenId(doc._id);
      }

      const matchers = {
        profiles: shouldDeleteProfile,
        groups: shouldDeleteGroup,
        staff_sessions: shouldDeleteSession,
        staff_highlights: shouldDeleteHighlight,
        staff_bindings: shouldDeleteBinding,
      };

      return Promise.all(
        payload.collections.map(async (collectionName) => {
          const docs = await listAll(collectionName);
          const matchedDocs = docs.filter((doc) => {
            const matcher = matchers[collectionName];
            return matcher ? matcher(doc) : false;
          });

          const deleteResults = await Promise.allSettled(
            matchedDocs.map((doc) => db.collection(collectionName).doc(getDocId(doc)).remove())
          );
          const failedIds = deleteResults
            .map((item, index) => ({
              status: item.status,
              id: getDocId(matchedDocs[index]),
            }))
            .filter((item) => item.status === 'rejected')
            .map((item) => item.id);

          return {
            collectionName,
            scanned: docs.length,
            matched: matchedDocs.length,
            deleted: matchedDocs.length - failedIds.length,
            failedIds,
          };
        })
      ).then((collections) => ({
        ok: collections.every((item) => !item.failedIds.length),
        collections,
      }));
    }, {
      collections: TARGET_COLLECTIONS,
      seedGroupIds: SEED_GROUP_IDS,
      seedSessionIds: SEED_SESSION_IDS,
    });

    console.log(JSON.stringify(result, null, 2));

    if (!result || !result.ok) {
      throw new Error('cleanup-seed-runtime-data failed');
    }
  } finally {
    await miniProgram.close();
  }
}

main().catch((error) => {
  console.error('线上 seed 运行数据清理失败');
  console.error(error);
  process.exit(1);
});
