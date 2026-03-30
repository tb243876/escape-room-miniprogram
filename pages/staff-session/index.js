'use strict';

const service = require('../../utils/cloudbase');
const viewModel = require('./view-model');

Page({
  data: {
    session: null,
    errorText: '',
    dialogVisible: false,
    dialogTitle: '',
    dialogContent: '',
    dialogMode: 'info',
    pendingActionKey: '',
    isSubmittingAction: false,
    hasLoaded: false,
    sessionId: '',
  },

  async onLoad(query = {}) {
    await this.loadSession(query.id || '', { force: true });
  },

  async onShow() {
    if (this.data.sessionId) {
      await this.loadSession(this.data.sessionId, { force: true });
    }
  },

  async loadSession(sessionId, options = {}) {
    const currentSessionId = sessionId || this.data.sessionId;
    const { force = false } = options;
    if (!currentSessionId) {
      this.setData({
        session: null,
        errorText: '场次参数缺失，请返回工作台重新进入',
      });
      return;
    }
    if (this.data.hasLoaded && !force && this.data.sessionId === currentSessionId) {
      return;
    }
    this.setData({
      errorText: '',
    });
    try {
      const response = await service.getStaffSession(currentSessionId);
      if (!response.ok) {
        const message = response.message || '场次加载失败，请稍后重试';
        if (message.includes('请先完成授权绑定')) {
          this.setData({
            session: null,
            errorText: '',
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
          session: null,
          errorText: message,
          hasLoaded: false,
        });
        return;
      }

      this.setData({
        session: viewModel.normalizeSession(response.session),
        hasLoaded: true,
        sessionId: currentSessionId,
      });
    } catch (error) {
      console.error('loadSession failed:', error);
      this.setData({
        session: null,
        errorText: '场次加载失败，请检查网络后重试',
        hasLoaded: false,
        sessionId: currentSessionId,
      });
    }
  },

  showActionTip(event) {
    const { action } = event.currentTarget.dataset;
    const targetAction = ((this.data.session && this.data.session.actions) || []).find(
      (item) => item.key === action
    );
    if (!targetAction) {
      return;
    }

    if (targetAction.key === 'highlight' && targetAction.enabled) {
      wx.navigateTo({
        url: '/pages/staff-highlights/index',
      });
      return;
    }

    this.setData({
      dialogVisible: true,
      dialogTitle: targetAction.enabled ? targetAction.text : '流程说明',
      dialogContent: targetAction.hint || '这里后续会接真实操作。',
      dialogMode: targetAction.enabled ? 'confirm' : 'info',
      pendingActionKey: targetAction.enabled ? targetAction.key : '',
    });
  },

  closeDialog() {
    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
      dialogMode: 'info',
      pendingActionKey: '',
    });
  },

  async confirmDialogAction() {
    const actionKey = this.data.pendingActionKey;
    const sessionId = this.data.session && this.data.session.id;
    if (!actionKey || !sessionId || this.data.isSubmittingAction) {
      this.closeDialog();
      return;
    }

    this.setData({ isSubmittingAction: true });
    this.closeDialog();
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const response = await service.runStaffSessionAction(sessionId, actionKey);
      if (!response.ok) {
        wx.showToast({
          title: response.message || '操作失败',
          icon: 'none',
        });
        return;
      }
      this.setData({
        session: viewModel.normalizeSession(response.session),
      });
      wx.showToast({
        title: '操作成功',
        icon: 'success',
      });
    } catch (error) {
      wx.showToast({
        title: '操作失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSubmittingAction: false });
      wx.hideLoading();
    }
  },

  async toggleMemberConfirm(event) {
    const { nickname } = event.currentTarget.dataset;
    const sessionId = this.data.session && this.data.session.id;
    if (!nickname || !sessionId || this.data.isSubmittingAction) {
      return;
    }

    this.setData({ isSubmittingAction: true });
    try {
      const response = await service.updateStaffSessionMember(sessionId, nickname);
      if (!response.ok) {
        wx.showToast({
          title: response.message || '更新失败',
          icon: 'none',
        });
        return;
      }

      this.setData({
        session: viewModel.normalizeSession(response.session),
      });
    } catch (error) {
      wx.showToast({
        title: '更新失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      this.setData({ isSubmittingAction: false });
    }
  },

  retryLoad() {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    const options = (current && current.options) || {};
    this.loadSession(options.id || '', { force: true });
  },

  noop() {},
});
