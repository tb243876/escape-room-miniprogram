'use strict';

const service = require('../../utils/cloudbase');
const perf = require('../../utils/platform/perf');
const viewModel = require('./view-model');

Page({
  data: {
    profile: null,
    errorText: '',
    hasLoaded: false,
  },

  async onLoad() {
    try {
      await this.loadBadges({ force: true });
    } catch (error) {
      this.setData({
        profile: null,
        errorText: '徽章页初始化失败，请重新进入页面',
      });
    }
  },

  async onShow() {
    try {
      await this.loadBadges({ force: true });
    } catch (error) {
      this.setData({
        profile: null,
        errorText: '徽章页刷新失败，请稍后重试',
      });
    }
  },

  async loadBadges(options = {}) {
    const { force = false } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    this.setData({ errorText: '' });
    try {
      await perf.traceAsync('badges.loadBadges', async (trace) => {
        const profile = await service.getProfile();
        perf.stepTrace(trace, 'service.getProfile');
        this.setData({ profile: viewModel.normalizeBadgeCatalog(profile), hasLoaded: true });
        perf.stepTrace(trace, 'setData');
      });
    } catch (error) {
      this.setData({
        profile: null,
        errorText: '徽章加载失败，请检查网络后重试',
        hasLoaded: false,
      });
      wx.showToast({
        title: '徽章加载失败',
        icon: 'none',
      });
    }
  },

  retryLoad() {
    this.loadBadges({ force: true });
  },
});
