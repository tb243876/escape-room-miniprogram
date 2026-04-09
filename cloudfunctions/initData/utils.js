'use strict';

function normalizeDataEnvTag(_value) {
  return 'prod';
}

function getCollectionName(baseCollectionName, _dataEnvTag) {
  return String(baseCollectionName || '').trim();
}

function stripInternalId(doc = {}) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  const nextDoc = {
    ...doc,
  };
  delete nextDoc._id;
  return nextDoc;
}

async function getStoreManagerBinding(db, openId, dataEnvTag) {
  if (!openId) {
    return null;
  }

  try {
    const result = await db
      .collection(getCollectionName('staff_bindings', dataEnvTag))
      .doc(openId)
      .get();
    return result && result.data ? result.data : null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  normalizeDataEnvTag,
  getCollectionName,
  stripInternalId,
  getStoreManagerBinding,
};
