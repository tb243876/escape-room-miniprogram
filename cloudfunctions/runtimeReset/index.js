'use strict';

const cloud = require('wx-server-sdk');
const seedData = require('./seed-data');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const CONFIRM_TEXT = 'RESET_GROUP_RUNTIME';

function stripInternalId(doc = {}) {
  const nextDoc = {
    ...doc,
  };
  delete nextDoc._id;
  return nextDoc;
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
    return 0;
  }

  await Promise.all(
    docs.map((item) => db.collection(collectionName).doc(String(item._id || '')).remove())
  );
  return docs.length;
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

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openId = String(wxContext.OPENID || '');

  if (!openId) {
    return {
      ok: false,
      message: '当前身份校验失败，未执行线上重置',
    };
  }

  if (String(event.confirmText || '') !== CONFIRM_TEXT) {
    return {
      ok: false,
      message: '确认口令不正确，未执行线上重置',
    };
  }

  const summary = {};

  summary.clearedGroups = await clearCollection('groups');
  summary.seededGroups = await seedCollection('groups', seedData.groups);

  summary.clearedSessions = await clearCollection('staff_sessions');
  summary.seededSessions = await seedCollection('staff_sessions', seedData.staffSessions);

  summary.clearedHighlights = await clearCollection('staff_highlights');
  summary.seededHighlights = await seedCollection('staff_highlights', seedData.staffHighlights);

  summary.clearedBindings = await clearCollection('staff_bindings');

  summary.clearedAuthCodes = await clearCollection('staff_auth_codes');
  summary.seededAuthCodes = await seedCollection('staff_auth_codes', seedData.staffAuthCodes);

  return {
    ok: true,
    message: '线上运行态数据已重置',
    summary,
  };
};
