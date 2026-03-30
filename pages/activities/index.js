'use strict';

const service = require('../../utils/cloudbase');
const perf = require('../../utils/platform/perf');
const viewModel = require('./view-model');

Page({
  data: {
    activities: [],
    errorText: '',
    hasLoaded: false,
  },

  async onLoad() {
    try {
      await this.loadActivities({ force: true });
    } catch (error) {
      this.setData({
        activities: [],
        errorText: '活动页初始化失败，请重新进入页面',
      });
    }
  },

  async loadActivities(options = {}) {
    const { force = false } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    this.setData({ errorText: '' });
    try {
      await perf.traceAsync('activities.loadActivities', async (trace) => {
        const activities = await service.getActivities();
        perf.stepTrace(trace, 'service.getActivities');
        this.setData({ activities: viewModel.enrichActivities(activities), hasLoaded: true });
        perf.stepTrace(trace, 'setData');
      });
    } catch (error) {
      this.setData({
        activities: [],
        errorText: '活动加载失败，请检查网络后重试',
        hasLoaded: false,
      });
      wx.showToast({
        title: '活动加载失败',
        icon: 'none',
      });
    }
  },

  retryLoad() {
    this.loadActivities({ force: true });
  },
});
