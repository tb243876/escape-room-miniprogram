'use strict';

const cloud = require('wx-server-sdk');
const seedData = require('./seed-data');
const {
  normalizeDataEnvTag,
  getCollectionName,
  stripInternalId,
  getStoreManagerBinding,
} = require('./utils');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const CONFIRM_TEXT = 'INIT_ESCAPE_ROOM_DATA';

function fail(errorCode, message, retryable = false, extra = {}) {
  return {
    ok: false,
    errorCode,
    message,
    retryable,
    ...extra,
  };
}

async function upsertSeedDocs(collectionName, docs = [], getDocId) {
  let count = 0;
  for (const item of docs) {
    const docId = String(getDocId(item) || '').trim();
    if (!docId) {
      continue;
    }
    await db
      .collection(collectionName)
      .doc(docId)
      .set({
        data: stripInternalId({
          ...item,
          id: item.id || docId,
          updatedAt: new Date().toISOString(),
        }),
      });
    count += 1;
  }
  console.info('initData upsertSeedDocs done', {
    collectionName,
    count,
  });
  return count;
}

function buildSeedTasks(dataEnvTag) {
  const baseTasks = [
    {
      key: 'themes',
      collectionName: getCollectionName('themes', dataEnvTag),
      docs: seedData.themes,
      getDocId: (item) => item._id || item.id,
    },
    {
      key: 'activities',
      collectionName: getCollectionName('activities', dataEnvTag),
      docs: seedData.activities,
      getDocId: (item) => item._id || item.id,
    },
  ];

  // `prod` is blocked at function entry. This branch is intentionally omitted so this helper
  // only models the executable test-environment seed plan.

  return baseTasks.concat([
    {
      key: 'profiles',
      collectionName: getCollectionName('profiles', dataEnvTag),
      docs: seedData.profiles,
      getDocId: (item) => item._id || item.id,
    },
    {
      key: 'groups',
      collectionName: getCollectionName('groups', dataEnvTag),
      docs: seedData.groups,
      getDocId: (item) => item._id || item.id,
    },
    {
      key: 'staffAuthCodes',
      collectionName: getCollectionName('staff_auth_codes', dataEnvTag),
      docs: seedData.staffAuthCodes,
      getDocId: (item) => item._id || item.id,
    },
    {
      key: 'staffSessions',
      collectionName: getCollectionName('staff_sessions', dataEnvTag),
      docs: seedData.staffSessions,
      getDocId: (item) => item._id || item.id,
    },
    {
      key: 'staffHighlights',
      collectionName: getCollectionName('staff_highlights', dataEnvTag),
      docs: seedData.staffHighlights,
      getDocId: (item) => item._id || item.id,
    },
    {
      key: 'punchCodes',
      collectionName: getCollectionName('punch_codes', dataEnvTag),
      docs: seedData.punchCodes,
      getDocId: (item) => item._id || item.id,
    },
  ]);
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = String(wxContext.OPENID || '');
  const dataEnvTag = normalizeDataEnvTag(event.__dataEnvTag);
  console.info('initData start', {
    openId,
    dataEnvTag,
    envVersion: String(event.__envVersion || ''),
    hasConfirmText: Boolean(event.confirmText),
  });

  if (!openId) {
    console.warn('initData blocked', {
      reason: 'openid-missing',
    });
    return fail('AUTH_OPENID_MISSING', '当前身份校验失败，未执行初始化');
  }

  if (String(event.confirmText || '') !== CONFIRM_TEXT) {
    console.warn('initData blocked', {
      reason: 'confirm-text-invalid',
      confirmText: String(event.confirmText || ''),
    });
    return fail('REQUEST_PARAM_INVALID', '确认口令不正确，未执行初始化');
  }

  if (dataEnvTag === 'prod') {
    console.warn('initData blocked', {
      reason: 'prod-env-forbidden',
    });
    return fail('MAINTENANCE_FORBIDDEN', '正式运营环境禁止通过小程序初始化种子数据');
  }

  const binding = await getStoreManagerBinding(db, openId, dataEnvTag);
  console.info('initData binding', {
    hasBinding: Boolean(binding),
    role: binding && binding.role ? binding.role : '',
  });
  if (!binding || String(binding.role || '') !== 'store_manager') {
    console.warn('initData blocked', {
      reason: 'permission-denied',
      role: binding && binding.role ? binding.role : '',
    });
    return fail('STAFF_PERMISSION_DENIED', '仅店长账号可以初始化测试环境种子数据');
  }

  const results = {};

  try {
    const seedTasks = buildSeedTasks(dataEnvTag);
    for (const task of seedTasks) {
      console.info('initData task start', {
        key: task.key,
        collectionName: task.collectionName,
        docsCount: Array.isArray(task.docs) ? task.docs.length : 0,
      });
      results[task.key] = await upsertSeedDocs(task.collectionName, task.docs, task.getDocId);
      console.info('initData task done', {
        key: task.key,
        count: results[task.key],
      });
    }
  } catch (error) {
    console.error('init data failed:', error);
    return fail('INTERNAL_SERVICE_ERROR', '云端演示数据初始化失败', true);
  }

  console.info('initData success', {
    results,
  });

  return {
    ok: true,
    message: '测试环境种子数据已同步',
    results,
  };
};
