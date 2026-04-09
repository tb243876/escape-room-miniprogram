'use strict';

const RELEASE_ENV_ID = 'mini-escape-main-9f3bjb2e7249ec8';

const ENV_CONFIG_MAP = {
  release: {
    envId: RELEASE_ENV_ID,
    dataEnvTag: 'prod',
    useMockData: false,
    useMockGroups: false,
    allowMockFallback: false,
    allowInitData: false,
    allowCloudDataReset: false,
    enablePerfTracing: false,
  },
  trial: {
    envId: RELEASE_ENV_ID,
    dataEnvTag: 'prod',
    useMockData: false,
    useMockGroups: false,
    allowMockFallback: false,
    allowInitData: false,
    allowCloudDataReset: false,
    enablePerfTracing: true,
  },
  develop: {
    envId: RELEASE_ENV_ID,
    dataEnvTag: 'prod',
    useMockData: false,
    useMockGroups: false,
    allowMockFallback: false,
    allowInitData: false,
    allowCloudDataReset: false,
    enablePerfTracing: true,
  },
};

function normalizeEnvVersion(value) {
  const normalizedValue = String(value || '').trim();
  if (Object.prototype.hasOwnProperty.call(ENV_CONFIG_MAP, normalizedValue)) {
    return normalizedValue;
  }
  return 'develop';
}

function getRuntimeConfig(envVersion) {
  const normalizedEnvVersion = normalizeEnvVersion(envVersion);
  return {
    envVersion: normalizedEnvVersion,
    ...ENV_CONFIG_MAP[normalizedEnvVersion],
  };
}

function getDefaultGlobalData() {
  return {
    ...getRuntimeConfig('develop'),
    useMockData: false,
    useMockGroups: false,
    storeName: '迷场档案馆',
  };
}

module.exports = {
  RELEASE_ENV_ID,
  ENV_CONFIG_MAP,
  normalizeEnvVersion,
  getRuntimeConfig,
  getDefaultGlobalData,
};
