'use strict';

const cloud = require('wx-server-sdk');
const {
  normalizeDataEnvTag,
  getCollectionName,
  getStoreManagerBinding,
} = require('./utils');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const CONFIRM_TEXT = 'CLEAR_ESCAPE_ROOM_DATA';

const COLLECTIONS_TO_CLEAR = [
  'themes',
  'activities',
  'profiles',
  'groups',
  'staff_auth_codes',
  'staff_bindings',
  'staff_sessions',
  'staff_highlights',
  'punch_codes',
];

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
      ok: true,
      cleared: 0,
    };
  }

  const deleteResults = await Promise.allSettled(
    docs.map((doc) => db.collection(collectionName).doc(String(doc._id || '')).remove())
  );
  const failed = deleteResults
    .map((item, index) => ({
      status: item.status,
      id: String((docs[index] && docs[index]._id) || ''),
      reason: item.status === 'rejected' ? item.reason : null,
    }))
    .filter((item) => item.status === 'rejected');

  if (failed.length) {
    console.warn('clearCollection partial failure:', {
      collectionName,
      failedIds: failed.map((item) => item.id).filter(Boolean),
      failedMessages: failed.map((item) =>
        item.reason && item.reason.message ? item.reason.message : String(item.reason || '')
      ),
    });
  }

  return {
    ok: failed.length === 0,
    cleared: docs.length - failed.length,
    failed: failed.length,
    message: failed.length ? `${collectionName} 清除失败 ${failed.length} 条` : '',
  };
}

exports.main = async (event = {}) => {
  const dataEnvTag = normalizeDataEnvTag(event.__dataEnvTag);

  if (dataEnvTag === 'prod') {
    return fail('MAINTENANCE_FORBIDDEN', '正式运营环境禁止执行云端清除');
  }

  const wxContext = cloud.getWXContext();
  const openId = String(wxContext.OPENID || '');

  if (!openId) {
    return fail('AUTH_OPENID_MISSING', '当前身份校验失败，未执行清除');
  }

  if (String(event.confirmText || '') !== CONFIRM_TEXT) {
    return fail('REQUEST_PARAM_INVALID', '确认口令不正确，未执行清除');
  }

  const binding = await getStoreManagerBinding(db, openId, dataEnvTag);
  if (!binding || String(binding.role || '') !== 'store_manager') {
    return fail('STAFF_PERMISSION_DENIED', '仅店长账号可以清除云端运行数据');
  }

  const results = {};
  let hasError = false;

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    const targetCollectionName = getCollectionName(collectionName, dataEnvTag);
    try {
      results[collectionName] = await clearCollection(targetCollectionName);
    } catch (error) {
      results[collectionName] = {
        ok: false,
        cleared: 0,
        failed: 0,
        message: error && error.message ? error.message : 'clear-failed',
      };
    }
    if (!results[collectionName].ok) {
      hasError = true;
    }
  }

  return {
    ok: !hasError,
    message: hasError ? '部分云端运行数据清除失败' : '云端运行数据已清除',
    results,
  };
};
