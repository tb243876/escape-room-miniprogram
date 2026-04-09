'use strict';

const envConfig = require('./utils/platform/env-config');

function detectMiniProgramEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return (
      accountInfo &&
      accountInfo.miniProgram &&
      accountInfo.miniProgram.envVersion
    ) || 'develop';
  } catch (error) {
    return 'develop';
  }
}

function resolveRuntimeConfig() {
  return envConfig.getRuntimeConfig(detectMiniProgramEnvVersion());
}

App({
  globalData: envConfig.getDefaultGlobalData(),

  onLaunch() {
    const runtimeConfig = resolveRuntimeConfig();
    Object.assign(this.globalData, runtimeConfig);

    if (!this.globalData.envId && !this.globalData.useMockData) {
      console.error('[app] missing envId', {
        envVersion: this.globalData.envVersion,
      });
    }

    console.info('[app] launch config', {
      envVersion: this.globalData.envVersion,
      envId: this.globalData.envId,
      dataEnvTag: this.globalData.dataEnvTag,
      useMockData: this.globalData.useMockData,
      useMockGroups: this.globalData.useMockGroups,
      allowMockFallback: this.globalData.allowMockFallback,
      allowInitData: this.globalData.allowInitData,
      allowCloudDataReset: this.globalData.allowCloudDataReset,
      hasWxCloud: Boolean(wx.cloud),
    });

    if (this.globalData.useMockData) {
      console.warn('[app] useMockData enabled, skip cloud init');
      return;
    }

    if (!wx.cloud) {
      console.error('[app] wx.cloud unavailable', {
        envVersion: this.globalData.envVersion,
      });
      return;
    }

    try {
      wx.cloud.init({
        env: this.globalData.envId,
        traceUser: true,
      });
      console.info('[app] cloud init success', {
        envId: this.globalData.envId,
      });
    } catch (error) {
      console.error('[app] cloud init failed', {
        message: error && error.message,
        stack: error && error.stack,
      });
    }
  },
});
