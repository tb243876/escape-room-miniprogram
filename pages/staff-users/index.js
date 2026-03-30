'use strict';

const service = require('../../utils/cloudbase');
const viewModel = require('../staff-dashboard/view-model');

Page({
  data: {
    dashboard: null,
    errorText: '',
    redirectingToAuth: false,
    hasLoaded: false,
  },

  async onLoad() {
    await this.loadData({ force: true });
  },

  async onShow() {
    await this.loadData({ force: true });
  },

  async loadData(options = {}) {
    const { force = false } = options;
    if (this.data.redirectingToAuth || (this.data.hasLoaded && !force)) {
      return;
    }
    this.setData({ errorText: '' });
    try {
      const response = await service.getStaffDashboard();
      if (!response.ok) {
        const message = response.message || '用户看板加载失败';
        if (message.includes('请先完成授权绑定')) {
          this.setData({
            dashboard: null,
            errorText: '',
            redirectingToAuth: true,
            hasLoaded: false,
          });
          wx.showToast({
            title: '请先输入授权码',
            icon: 'none',
          });
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/staff-auth-code/index',
            });
          }, 180);
          return;
        }
        this.setData({
          dashboard: null,
          errorText: message,
        });
        return;
      }
      this.setData({
        redirectingToAuth: false,
        dashboard: viewModel.normalizeDashboard(response.dashboard),
        hasLoaded: true,
      });
    } catch (error) {
      this.setData({
        dashboard: null,
        errorText: '用户看板加载失败，请稍后重试',
        redirectingToAuth: false,
        hasLoaded: false,
      });
    }
  },

  retryLoad() {
    this.loadData({ force: true });
  },
});
