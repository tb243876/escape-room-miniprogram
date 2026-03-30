'use strict';

const service = require('../../utils/cloudbase');
const viewModel = require('../staff-dashboard/view-model');

Page({
  data: {
    dashboard: null,
    errorText: '',
    redirectingToAuth: false,
    hasLoaded: false,
    dialogVisible: false,
    dialogTitle: '',
    dialogContent: '',
    pendingAction: null,
    selectedStaffProfile: null,
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
        const message = response.message || '门店管理加载失败';
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
        errorText: '门店管理加载失败，请稍后重试',
        redirectingToAuth: false,
        hasLoaded: false,
      });
    }
  },

  retryLoad() {
    this.loadData({ force: true });
  },

  async generateAuthCode(event) {
    const { role } = event.currentTarget.dataset;
    if (!role) {
      return;
    }
    wx.showLoading({ title: '生成中', mask: true });
    try {
      const result = await service.generateStaffAuthCode(role);
      if (!result.ok) {
        wx.showToast({ title: result.message || '授权码生成失败', icon: 'none' });
        return;
      }
      this.setData({
        dashboard: result.dashboard ? viewModel.normalizeDashboard(result.dashboard) : this.data.dashboard,
      });
      wx.showToast({
        title: result.authCode && result.authCode.code ? result.authCode.code : '授权码已生成',
        icon: 'none',
        duration: 2600,
      });
    } catch (error) {
      wx.showToast({ title: '授权码生成失败，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  promptRemoveStaff(event) {
    const { openid } = event.currentTarget.dataset;
    if (!openid) {
      return;
    }
    this.setData({
      dialogVisible: true,
      dialogTitle: '移除员工',
      dialogContent: '移除后该账号将失去工作台权限，需要重新绑定授权码。',
      pendingAction: {
        type: 'removeStaff',
        openId: openid,
      },
      selectedStaffProfile: null,
    });
  },

  async removeStaff(openid) {
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const response = await service.removeStaffBinding(openid);
      wx.showToast({ title: response.message || '处理完成', icon: 'none' });
      if (response.ok && response.dashboard) {
        this.setData({
          dashboard: viewModel.normalizeDashboard(response.dashboard),
        });
      }
    } catch (error) {
      wx.showToast({ title: '操作失败，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  promptTransferManager(event) {
    const { openid } = event.currentTarget.dataset;
    if (!openid) {
      return;
    }
    this.setData({
      dialogVisible: true,
      dialogTitle: '转移店长',
      dialogContent: '确认后，对方将成为新店长，当前账号会降为副店长。',
      pendingAction: {
        type: 'transferManager',
        openId: openid,
      },
      selectedStaffProfile: null,
    });
  },

  async transferManager(openid) {
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const response = await service.transferManager(openid);
      wx.showToast({ title: response.message || '处理完成', icon: 'none' });
      if (response.ok && response.dashboard) {
        this.setData({
          dashboard: viewModel.normalizeDashboard(response.dashboard),
        });
      }
    } finally {
      wx.hideLoading();
    }
  },

  openStaffProfile(event) {
    const { openid } = event.currentTarget.dataset;
    const dashboard = this.data.dashboard;
    const staffMembers = (dashboard && dashboard.staffMembers) || [];
    const target = staffMembers.find((item) => String(item.openId || '') === String(openid || ''));
    if (!target || !target.profileCard) {
      return;
    }

    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
      pendingAction: null,
      selectedStaffProfile: target.profileCard,
    });
  },

  closeDialog() {
    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
      pendingAction: null,
      selectedStaffProfile: null,
    });
  },

  async confirmDialogAction() {
    const pendingAction = this.data.pendingAction;
    this.closeDialog();
    if (!pendingAction || !pendingAction.type || !pendingAction.openId) {
      return;
    }

    if (pendingAction.type === 'removeStaff') {
      await this.removeStaff(pendingAction.openId);
      return;
    }

    if (pendingAction.type === 'transferManager') {
      await this.transferManager(pendingAction.openId);
    }
  },

  noop() {},
});
