'use strict';

function createWxStub() {
  return {
    __storage: Object.create(null),
    cloud: null,
    getStorageSync(key) {
      return this.__storage[key];
    },
    setStorageSync(key, value) {
      this.__storage[key] = value;
    },
    removeStorageSync(key) {
      delete this.__storage[key];
    },
    getStorageInfoSync() {
      return { keys: Object.keys(this.__storage) };
    },
  };
}

function setupMockMiniappEnv(overrides = {}) {
  global.wx = createWxStub();
  global.getApp = () => ({
    globalData: {
      useMockData: true,
      useMockGroups: true,
      enablePerfTracing: false,
      storeName: '迷场档案馆',
      ...overrides,
    },
  });
}

module.exports = {
  setupMockMiniappEnv,
};
