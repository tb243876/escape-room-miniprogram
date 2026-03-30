'use strict';

function getAppConfig() {
  try {
    return getApp().globalData || {};
  } catch (error) {
    return {};
  }
}

function useMock() {
  const appConfig = getAppConfig();
  return appConfig.useMockData !== false || !wx.cloud;
}

function useMockGroups() {
  const appConfig = getAppConfig();
  return appConfig.useMockGroups !== false;
}

function getDb() {
  console.info('[runtime] getDb', {
    hasWxCloud: Boolean(wx.cloud),
  });
  return wx.cloud.database();
}

async function callCloudFunction(name, data, timeout) {
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    console.error('[runtime] callCloudFunction unavailable', {
      name,
    });
    throw new Error('cloud-call-unavailable');
  }
  console.info('[runtime] callCloudFunction.start', {
    name,
    data,
  });

  const callPromise = wx.cloud.callFunction({
    name,
    data,
  });

  const effectiveTimeout = timeout || 15000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('cloud-call-timeout')), effectiveTimeout);
  });
  const response = await Promise.race([callPromise, timeoutPromise]);

  console.info('[runtime] callCloudFunction.success', {
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
};
