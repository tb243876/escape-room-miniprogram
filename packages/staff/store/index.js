'use strict';

const avatarService = require('../../../utils/platform/avatar');
const service = require('../../../utils/cloudbase');
const staffService = require('../../../utils/domain/staff');
const viewModel = require('../dashboard/view-model');

const PREVIEW_LIMITS = {
  authCodes: 3,
  staffMembers: 4,
  transferCandidates: 3,
};

function buildPreviewDashboard(dashboard = null, sectionState = {}) {
  if (!dashboard) {
    return null;
  }

  const authCodeList = Array.isArray(dashboard.authCodeList) ? dashboard.authCodeList : [];
  const staffMembers = Array.isArray(dashboard.staffMembers) ? dashboard.staffMembers : [];
  const candidateList =
    dashboard.managerTransfer && Array.isArray(dashboard.managerTransfer.candidateList)
      ? dashboard.managerTransfer.candidateList
      : [];

  const showAllAuthCodes = Boolean(sectionState.showAllAuthCodes);
  const showAllStaffMembers = Boolean(sectionState.showAllStaffMembers);
  const showAllTransferCandidates = Boolean(sectionState.showAllTransferCandidates);

  return {
    ...dashboard,
    visibleAuthCodeList: showAllAuthCodes
      ? authCodeList
      : authCodeList.slice(0, PREVIEW_LIMITS.authCodes),
    hiddenAuthCodeCount: Math.max(0, authCodeList.length - PREVIEW_LIMITS.authCodes),
    visibleStaffMembers: showAllStaffMembers
      ? staffMembers
      : staffMembers.slice(0, PREVIEW_LIMITS.staffMembers),
    hiddenStaffMemberCount: Math.max(0, staffMembers.length - PREVIEW_LIMITS.staffMembers),
    managerTransfer: {
      ...(dashboard.managerTransfer || {}),
      visibleCandidateList: showAllTransferCandidates
        ? candidateList
        : candidateList.slice(0, PREVIEW_LIMITS.transferCandidates),
      hiddenCandidateCount: Math.max(0, candidateList.length - PREVIEW_LIMITS.transferCandidates),
    },
  };
}

Page({
  data: {
    dashboard: null,
    errorText: '',
    redirectingToAuth: false,
    hasLoaded: false,
    authCodeDialogVisible: false,
    generatedAuthCode: '',
    generatedAuthRoleLabel: '',
    dialogVisible: false,
    dialogTitle: '',
    dialogContent: '',
    pendingAction: null,
    selectedStaffProfile: null,
    sectionState: {
      showAllAuthCodes: false,
      showAllStaffMembers: false,
      showAllTransferCandidates: false,
    },
  },

  async onLoad() {
    await this.loadData({ force: true });
  },

  async onShow() {
    if (this.data.hasLoaded) {
      await this.refreshAvatarUrls();
      return;
    }
    await this.loadData({ force: true });
  },

  async refreshAvatarUrls() {
    const nextDashboard = await avatarService.refreshAvatarUrlsDeep(this.data.dashboard);
    const nextSelectedStaffProfile = await avatarService.refreshAvatarUrlsDeep(
      this.data.selectedStaffProfile
    );
    if (
      nextDashboard !== this.data.dashboard ||
      nextSelectedStaffProfile !== this.data.selectedStaffProfile
    ) {
      this.setData({
        dashboard: buildPreviewDashboard(nextDashboard, this.data.sectionState),
        selectedStaffProfile: nextSelectedStaffProfile,
      });
    }
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
      const normalizedDashboard = viewModel.normalizeDashboard(response.dashboard);
      this.setData({
        redirectingToAuth: false,
        dashboard: buildPreviewDashboard(normalizedDashboard, this.data.sectionState),
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
      dashboard: buildPreviewDashboard(this.data.dashboard, nextSectionState),
    });
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
      const nextDashboard = result.dashboard
        ? buildPreviewDashboard(
            viewModel.normalizeDashboard(result.dashboard),
            this.data.sectionState
          )
        : this.data.dashboard;
      this.setData({
        dashboard: nextDashboard,
        authCodeDialogVisible: true,
        generatedAuthCode: result.authCode && result.authCode.code ? result.authCode.code : '',
        generatedAuthRoleLabel:
          result.authCode && result.authCode.roleLabel ? result.authCode.roleLabel : '授权码',
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
          dashboard: buildPreviewDashboard(
            viewModel.normalizeDashboard(response.dashboard),
            this.data.sectionState
          ),
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
          dashboard: buildPreviewDashboard(
            viewModel.normalizeDashboard(response.dashboard),
            this.data.sectionState
          ),
        });
      }
    } catch (error) {
      wx.showToast({ title: '操作失败，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async openStaffProfile(event) {
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
      selectedStaffProfile: await avatarService.refreshAvatarUrlsDeep(target.profileCard),
    });
  },

  closeDialog() {
    this.setData({
      authCodeDialogVisible: false,
      generatedAuthCode: '',
      generatedAuthRoleLabel: '',
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
      pendingAction: null,
      selectedStaffProfile: null,
    });
  },

  copyGeneratedAuthCode() {
    const authCode = String(this.data.generatedAuthCode || '').trim();
    if (!authCode) {
      return;
    }
    wx.setClipboardData({
      data: authCode,
      success: () => {
        wx.showToast({
          title: '授权码已复制',
          icon: 'success',
        });
      },
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
