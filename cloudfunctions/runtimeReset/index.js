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
const CONFIRM_TEXT = 'RESET_GROUP_RUNTIME';

function fail(errorCode, message, retryable = false, extra = {}) {
  return {
    ok: false,
    errorCode,
    message,
    retryable,
    ...extra,
  };
}

async function listAll(collectionName) {
  const collection = db.collection(collectionName);
  const countResult = await collection.count();
  const total = Number((countResult && countResult.total) || 0);
  const pageSize = 100;
  const jobs = [];

  for (let offset = 0; offset < total; offset += pageSize) {
    jobs.push(collection.skip(offset).limit(pageSize).get());
  }

  if (!jobs.length) {
    return [];
  }

  const results = await Promise.all(jobs);
  return results.reduce((list, item) => list.concat(item.data || []), []);
}

async function clearCollection(collectionName) {
  const docs = await listAll(collectionName);
  if (!docs.length) {
    return {
      cleared: 0,
      failedIds: [],
    };
  }

  if (docs.length > 200) {
    console.warn('runtimeReset clearCollection large batch:', {
      collectionName,
      total: docs.length,
    });
  }

  const deleteResults = await Promise.allSettled(
    docs.map((item) => db.collection(collectionName).doc(String(item._id || '')).remove())
  );
  const failed = deleteResults
    .map((item, index) => ({
      status: item.status,
      id: String((docs[index] && docs[index]._id) || ''),
      reason: item.status === 'rejected' ? item.reason : null,
    }))
    .filter((item) => item.status === 'rejected');

  if (failed.length) {
    console.warn('runtimeReset clearCollection partial failure:', {
      collectionName,
      failedIds: failed.map((item) => item.id).filter(Boolean),
      failedMessages: failed.map((item) =>
        item.reason && item.reason.message ? item.reason.message : String(item.reason || '')
      ),
    });
  }

  return {
    cleared: docs.length - failed.length,
    failedIds: failed.map((item) => item.id).filter(Boolean),
  };
}

async function seedCollection(collectionName, docs = []) {
  if (!Array.isArray(docs) || !docs.length) {
    return 0;
  }

  await Promise.all(
    docs.map((item) =>
      db.collection(collectionName).doc(String(item._id || '')).set({
        data: stripInternalId(item),
      })
    )
  );
  return docs.length;
}

async function clearCollectionOrThrow(collectionName, label) {
  const result = await clearCollection(collectionName);
  if (result.failedIds.length) {
    throw new Error(`${label} 清空失败：${result.failedIds.join(', ')}`);
  }
  return result.cleared;
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = String(wxContext.OPENID || '');
  const dataEnvTag = normalizeDataEnvTag(event.__dataEnvTag);

  if (!openId) {
    return fail('AUTH_OPENID_MISSING', '当前身份校验失败，未执行线上重置');
  }

  if (String(event.confirmText || '') !== CONFIRM_TEXT) {
    return fail('REQUEST_PARAM_INVALID', '确认口令不正确，未执行线上重置');
  }

  if (dataEnvTag === 'prod') {
    return fail('MAINTENANCE_FORBIDDEN', '正式运营环境禁止通过小程序重置运行态数据');
  }

  const binding = await getStoreManagerBinding(db, openId, dataEnvTag);
  if (!binding || String(binding.role || '') !== 'store_manager') {
    return fail('STAFF_PERMISSION_DENIED', '仅店长账号可以执行线上运行态重置');
  }

  const summary = {};

  try {
    summary.clearedGroups = await clearCollectionOrThrow(getCollectionName('groups', dataEnvTag), 'groups');
    summary.seededGroups = await seedCollection(getCollectionName('groups', dataEnvTag), seedData.groups);

    summary.clearedSessions = await clearCollectionOrThrow(
      getCollectionName('staff_sessions', dataEnvTag),
      'staff_sessions'
    );
    summary.seededSessions = await seedCollection(
      getCollectionName('staff_sessions', dataEnvTag),
      seedData.staffSessions
    );

    summary.clearedHighlights = await clearCollectionOrThrow(
      getCollectionName('staff_highlights', dataEnvTag),
      'staff_highlights'
    );
    summary.seededHighlights = await seedCollection(
      getCollectionName('staff_highlights', dataEnvTag),
      seedData.staffHighlights
    );

    summary.clearedBindings = await clearCollectionOrThrow(
      getCollectionName('staff_bindings', dataEnvTag),
      'staff_bindings'
    );

    summary.clearedAuthCodes = await clearCollectionOrThrow(
      getCollectionName('staff_auth_codes', dataEnvTag),
      'staff_auth_codes'
    );
    summary.seededAuthCodes = await seedCollection(
      getCollectionName('staff_auth_codes', dataEnvTag),
      seedData.staffAuthCodes
    );
  } catch (error) {
    console.error('runtimeReset failed:', {
      message: error.message,
      stack: error.stack,
      openId,
      dataEnvTag,
      summary,
    });
    return fail('INTERNAL_SERVICE_ERROR', error.message || '测试环境运行态重置失败', true, {
      summary,
    });
  }

  return {
    ok: true,
    message: '测试环境运行态数据已重置',
    summary,
  };
};
