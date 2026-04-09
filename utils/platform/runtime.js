'use strict';

const dataEnv = require('./data-env');

function getAppConfig() {
  return dataEnv.getAppConfig();
}

function useMock() {
  const appConfig = getAppConfig();
  const enabled = appConfig.useMockData === true;
  if (!wx.cloud && enabled) {
    console.warn('[runtime] useMock explicitly enabled while wx.cloud is unavailable');
  }
  return enabled;
}

function useMockGroups() {
  const appConfig = getAppConfig();
  return appConfig.useMockGroups === true;
}

function getDb() {
  if (!wx.cloud || typeof wx.cloud.database !== 'function') {
    console.error('[runtime] getDb unavailable', {
      hasWxCloud: Boolean(wx.cloud),
    });
    throw new Error('cloud-db-unavailable');
  }
  return wx.cloud.database();
}

function shouldLogRuntimeInfo() {
  const appConfig = getAppConfig();
  return appConfig.enablePerfTracing === true && appConfig.enableVerboseRuntimeLogs === true;
}

function logRuntimeInfo(message, payload) {
  if (!shouldLogRuntimeInfo()) {
    return;
  }
  console.info(message, payload);
}

async function callCloudFunction(name, data, timeout) {
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    console.error('[runtime] callCloudFunction unavailable', {
      name,
    });
    throw new Error('cloud-call-unavailable');
  }
  const appConfig = getAppConfig();
  const payload = {
    ...(data || {}),
    __dataEnvTag: dataEnv.getDataEnvTag(),
    __envVersion: String(appConfig.envVersion || '').trim() || 'develop',
  };
  logRuntimeInfo('[runtime] callCloudFunction.start', {
    name,
    data: payload,
  });

  const callPromise = wx.cloud.callFunction({
    name,
    data: payload,
  });

  const effectiveTimeout = timeout || 15000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('cloud-call-timeout')), effectiveTimeout);
  });
  const response = await Promise.race([callPromise, timeoutPromise]);

  logRuntimeInfo('[runtime] callCloudFunction.success', {
    name,
    result: response.result || {},
  });
  return response.result || {};
}

function delay(data) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), 120);
  });
}

module.exports = {
  getAppConfig,
  useMock,
  useMockGroups,
  getDb,
  callCloudFunction,
  delay,
  getDataEnvTag: dataEnv.getDataEnvTag,
  resolveCollectionName: dataEnv.resolveCollectionName,
};
