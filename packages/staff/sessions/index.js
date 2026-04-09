'use strict';

// 场次列表页（sessions），区别于单场次详情页（session/）。
// 已知性能约束：当前页面复用 getStaffDashboard()，会触发完整 buildDashboard，
// 包含 profiles/groups/sessions/bindings 全量读取与补档写操作；后续应拆独立 action。

const service = require('../../../utils/cloudbase');
const staffService = require('../../../utils/domain/staff');
const viewModel = require('../dashboard/view-model');

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
        const message = response.message || '场次管理加载失败';
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
      });
    } catch (error) {
      this.setData({
        dashboard: null,
        errorText: '场次管理加载失败，请稍后重试',
        redirectingToAuth: false,
        hasLoaded: false,
      });
    }
  },

  openSession(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: `/packages/staff/session/index?id=${id}`,
    });
  },

  retryLoad() {
    this.loadData({ force: true });
  },
});
