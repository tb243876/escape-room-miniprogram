'use strict';

const service = require('../../../utils/cloudbase');
const staffService = require('../../../utils/domain/staff');
const time = require('../../../utils/platform/time');
const viewModel = require('./view-model');

Page({
  data: {
    dashboard: null,
    errorText: '',
    redirectingToAuth: false,
    hasLoaded: false,
    lastRefreshText: '',
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
    // getStaffDashboard 仍是重接口，自动刷新保持低频避免持续打满云端读写额度。
    this.refreshTimer = setInterval(() => {
      wx.getNetworkType({
        success: (res) => {
          if (res.networkType === 'none') {
            return;
          }
          this.loadDashboard({ force: true });
        },
      });
    }, 30000);
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
        if (
          staffService.handleStaffAuthFailure(this, response, {
            resetData: {
              dashboard: null,
            },
            fallbackMessage: message,
          })
        ) {
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
        lastRefreshText: time.formatSyncTime(),
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
      url: '/packages/staff/highlights/index',
    });
  },

  openUsersPage() {
    wx.navigateTo({
      url: '/packages/staff/users/index',
    });
  },

  openSessionsPage() {
    wx.navigateTo({
      url: '/packages/staff/sessions/index',
    });
  },

  openStorePage() {
    wx.navigateTo({
      url: '/packages/staff/store/index',
    });
  },

  openRevenuePage() {
    wx.navigateTo({
      url: '/packages/staff/revenue/index',
    });
  },

  retryLoad() {
    this.loadDashboard({ force: true });
  },
});
