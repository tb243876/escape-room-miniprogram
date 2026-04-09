'use strict';

function getAppConfig() {
  try {
    return getApp().globalData || {};
  } catch (error) {
    return {};
  }
}

function getDataEnvTag() {
  return 'prod';
}

function resolveCollectionName(baseCollectionName, _dataEnvTag) {
  const baseName = String(baseCollectionName || '').trim();
  if (!baseName) {
    return '';
  }
  return baseName;
}

module.exports = {
  getAppConfig,
  getDataEnvTag,
  resolveCollectionName,
};
