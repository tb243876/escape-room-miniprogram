'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const CONFIRM_TEXT = 'CLEAR_ESCAPE_ROOM_DATA';

const COLLECTIONS_TO_CLEAR = ['profiles', 'groups', 'staff_sessions', 'staff_highlights'];

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

async function getStoreManagerBinding(openId) {
  if (!openId) {
    return null;
  }
  try {
    const result = await db.collection('staff_bindings').doc(openId).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
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
  const failed = deleteResults.filter((item) => item.status === 'rejected');

  return {
    ok: failed.length === 0,
    cleared: docs.length - failed.length,
    failed: failed.length,
    message: failed.length ? `${collectionName} 清除失败 ${failed.length} 条` : '',
  };
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = String(wxContext.OPENID || '');

  if (!openId) {
    return {
      ok: false,
      message: '当前身份校验失败，未执行清除',
    };
  }

  if (String(event.confirmText || '') !== CONFIRM_TEXT) {
    return {
      ok: false,
      message: '确认口令不正确，未执行清除',
    };
  }

  const binding = await getStoreManagerBinding(openId);
  if (!binding || String(binding.role || '') !== 'store_manager') {
    return {
      ok: false,
      message: '仅店长账号可以清除云端运行数据',
    };
  }

  const results = {};
  let hasError = false;

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    try {
      results[collectionName] = await clearCollection(collectionName);
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
