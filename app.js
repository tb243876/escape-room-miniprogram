'use strict';

App({
  globalData: {
    envId: 'mini-escape-main-9f3bjb2e7249ec8',
    useMockData: false,
    useMockGroups: false,
    enablePerfTracing: true,
    storeName: '迷场档案馆',
  },

  onLaunch() {
    console.info('[app] launch config', {
      envId: this.globalData.envId,
      useMockData: this.globalData.useMockData,
      useMockGroups: this.globalData.useMockGroups,
      hasWxCloud: Boolean(wx.cloud),
    });

    if (this.globalData.useMockData) {
      console.warn('[app] useMockData enabled, skip cloud init');
      return;
    }

    if (!wx.cloud) {
      console.error('[app] wx.cloud unavailable, fallback to mock mode');
      this.globalData.useMockData = true;
      return;
    }

    if (wx.cloud) {
      try {
        wx.cloud.init({
          env: this.globalData.envId,
          traceUser: true,
        });
        console.info('[app] cloud init success', {
          envId: this.globalData.envId,
        });
      } catch (error) {
        console.error('[app] cloud init failed, fallback to mock mode', {
          message: error && error.message,
          stack: error && error.stack,
        });
        this.globalData.useMockData = true;
      }
    }
  },
});
