'use strict';

const service = require('../../utils/cloudbase');
const viewModel = require('./view-model');

Page({
  data: {
    dashboard: null,
    errorText: '',
    redirectingToAuth: false,
    hasLoaded: false,
  },

  async onLoad() {
    await this.loadDashboard({ force: true });
  },

  async onShow() {
    await this.loadDashboard({ force: true });
    this.startAutoRefresh();
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      wx.getNetworkType({
        success: (res) => {
          if (res.networkType === 'none') {
            return;
          }
          this.loadDashboard({ force: true });
        },
      });
    }, 5000);
  },

  stopAutoRefresh() {
    if (!this.refreshTimer) {
      return;
    }
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  },

  async loadDashboard(options = {}) {
    const { force = false } = options;
    if (this.data.redirectingToAuth || (this.data.hasLoaded && !force)) {
      return;
    }
    this.setData({
      errorText: '',
    });
    try {
      const response = await service.getStaffDashboard();
      if (!response.ok) {
        const message = response.message || '工作台加载失败';
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
        errorText: '工作台加载失败，请稍后重试',
        redirectingToAuth: false,
        hasLoaded: false,
      });
    }
  },

  openHighlights() {
    wx.navigateTo({
      url: '/pages/staff-highlights/index',
    });
  },

  openUsersPage() {
    wx.navigateTo({
      url: '/pages/staff-users/index',
    });
  },

  openSessionsPage() {
    wx.navigateTo({
      url: '/pages/staff-sessions/index',
    });
  },

  openStorePage() {
    wx.navigateTo({
      url: '/pages/staff-store/index',
    });
  },

  retryLoad() {
    this.loadDashboard({ force: true });
  },
});
