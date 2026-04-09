'use strict';

// 单场次详情页（session），区别于场次列表页（sessions/）。

const avatarService = require('../../../utils/platform/avatar');
const service = require('../../../utils/cloudbase');
const staffService = require('../../../utils/domain/staff');
const viewModel = require('./view-model');

const SESSION_PREVIEW_LIMITS = {
  members: 4,
  timeline: 4,
};

function buildPreviewSession(session = null, sectionState = {}) {
  if (!session) {
    return null;
  }
  const members = Array.isArray(session.members) ? session.members : [];
  const timeline = Array.isArray(session.timeline) ? session.timeline : [];
  return {
    ...session,
    visibleMembers: sectionState.showAllMembers
      ? members
      : members.slice(0, SESSION_PREVIEW_LIMITS.members),
    hiddenMemberCount: Math.max(0, members.length - SESSION_PREVIEW_LIMITS.members),
    visibleTimeline: sectionState.showAllTimeline
      ? timeline
      : timeline.slice(0, SESSION_PREVIEW_LIMITS.timeline),
    hiddenTimelineCount: Math.max(0, timeline.length - SESSION_PREVIEW_LIMITS.timeline),
  };
}

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
    sectionState: {
      showAllMembers: false,
      showAllTimeline: false,
    },
  },

  async onLoad(query = {}) {
    await this.loadSession(query.id || '', { force: true });
  },

  async onShow() {
    if (this.data.hasLoaded) {
      await this.refreshAvatarUrls();
      return;
    }
    if (this.data.sessionId) {
      await this.loadSession(this.data.sessionId, { force: true });
    }
  },

  async refreshAvatarUrls() {
    const nextSession = await avatarService.refreshAvatarUrlsDeep(this.data.session);
    if (nextSession !== this.data.session) {
      this.setData({
        session: buildPreviewSession(nextSession, this.data.sectionState),
      });
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
        if (
          staffService.handleStaffAuthFailure(this, response, {
            resetData: {
              session: null,
            },
            fallbackMessage: message,
          })
        ) {
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
        session: buildPreviewSession(viewModel.normalizeSession(response.session), this.data.sectionState),
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

  toggleSection(event) {
    const { key } = event.currentTarget.dataset;
    if (!key) {
      return;
    }
    const nextSectionState = {
      ...this.data.sectionState,
      [key]: !this.data.sectionState[key],
    };
    this.setData({
      sectionState: nextSectionState,
      session: buildPreviewSession(this.data.session, nextSectionState),
    });
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
        url: '/packages/staff/highlights/index',
      });
      return;
    }

    this.setData({
      dialogVisible: true,
      dialogTitle: targetAction.enabled ? targetAction.text : '流程说明',
      dialogContent: targetAction.hint || '请按照流程依次操作',
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
        session: buildPreviewSession(viewModel.normalizeSession(response.session), this.data.sectionState),
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
    const { openid } = event.currentTarget.dataset;
    const sessionId = this.data.session && this.data.session.id;
    if (!openid || !sessionId || this.data.isSubmittingAction) {
      return;
    }

    this.setData({ isSubmittingAction: true });
    try {
      const response = await service.updateStaffSessionMember(sessionId, openid);
      if (!response.ok) {
        wx.showToast({
          title: response.message || '更新失败',
          icon: 'none',
        });
        return;
      }

      this.setData({
        session: buildPreviewSession(viewModel.normalizeSession(response.session), this.data.sectionState),
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
