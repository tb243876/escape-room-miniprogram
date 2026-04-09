'use strict';

const service = require('../../utils/cloudbase');
const perf = require('../../utils/platform/perf');
const viewModel = require('./view-model');

function buildGroupListSignature(groups = []) {
  return (Array.isArray(groups) ? groups : [])
    .map((item) => [
      item.id || '',
      item.themeId || '',
      item.themeName || '',
      item.dateValue || '',
      item.timeSlot || '',
      item.currentPeople || 0,
      item.targetPeople || 0,
      item.rawStatus || '',
      item.roomStage || '',
      item.viewerRole || '',
      item.viewerStatus || '',
      item.viewerContactName || '',
      item.myGroupRole || '',
      item.myContactName || '',
      item.isMyActiveGroup ? 1 : 0,
      item.isMyRecentGroup ? 1 : 0,
      item.hasOtherActiveGroup ? 1 : 0,
      Array.isArray(item.participantNames) ? item.participantNames.join(',') : '',
      Array.isArray(item.joinedPhones) ? item.joinedPhones.join(',') : '',
    ].join('|'))
    .join('||');
}

Page({
  refreshTimer: null,
  isFetchingLobby: false,
  loadingTask: null,
  lastGroupListSignature: '',

  data: {
    groups: [],
    visibleGroups: [],
    primaryTabs: [],
    filterTabs: [],
    themeFilters: [],
    activePage: 'lobby',
    activeFilter: '',
    activeThemeFilter: 'all',
    activeThemeSummary: '',
    summaryCards: [],
    filterPanelVisible: false,
    filterPanelTitle: '',
    filterPanelType: '',
    filterPanelOptions: [],
    confirmDialogVisible: false,
    confirmDialogTitle: '',
    confirmDialogContent: '',
    confirmDialogPenaltyPreview: null,
    joinFormVisible: false,
    joinFormThemeName: '',
    joinFormGroupId: '',
    joinFormContactName: '',
    joinFormContactPhone: '',
    joinFormErrorField: '',
    joinFormErrorText: '',
    isSubmittingJoin: false,
    pendingAction: null,
    errorText: '',
    isLoading: false,
    hasLoaded: false,
    exitReasonVisible: false,
    exitReasonGroupId: '',
    exitReasonGroupName: '',
    exitReasonIsCreator: false,
    selectedExitReason: '',
    exitReasonOptions: ['时间有冲突', '人数凑不上', '找到其他队了', '临时有事', '其他原因'],
  },

  async onLoad() {
    this.__skipNextOnShowRefresh = true;
    try {
      await this.loadLobbyData({ force: true, showLoading: false });
      this.startAutoRefresh();
    } catch (error) {
      this.setData({
        groups: [],
        errorText: '队伍大厅初始化失败，请重新进入页面',
      });
    }
  },

  async onShow() {
    if (this.__skipNextOnShowRefresh) {
      this.__skipNextOnShowRefresh = false;
      this.startAutoRefresh();
      return;
    }
    if (this.isFetchingLobby) {
      return;
    }
    await this.loadLobbyData({ force: true, showLoading: false });
    this.startAutoRefresh();
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  async onPullDownRefresh() {
    try {
      await this.loadLobbyData({ force: true, showLoading: false });
    } finally {
      if (typeof wx.stopPullDownRefresh === 'function') {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadLobbyData(options = {}) {
    const { force = false, showLoading = true } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    if (this.loadingTask) {
      return this.loadingTask;
    }

    const isSilentRefresh = !showLoading && this.data.hasLoaded;
    this.isFetchingLobby = true;
    if (showLoading) {
      this.setData({
        isLoading: true,
        errorText: '',
      });
    }

    this.loadingTask = perf
      .traceAsync('lobby.loadLobbyData', async (trace) => {
        const groups = await service.getLobbyList();
        perf.stepTrace(trace, 'service.getLobbyList', {
          count: (groups || []).length,
        });
        const groupListSignature = buildGroupListSignature(groups || []);
        const groupsChanged = groupListSignature !== this.lastGroupListSignature;
        if (groupsChanged || !this.data.hasLoaded || this.data.errorText) {
          const normalizedGroups = viewModel.normalizeLobbyList(groups || []);
          this.lastGroupListSignature = groupListSignature;
          this.setData({
            groups: normalizedGroups,
            errorText: '',
            hasLoaded: true,
          });
          this.refreshViewState();
        } else {
          this.lastGroupListSignature = groupListSignature;
          this.setData({
            errorText: '',
            hasLoaded: true,
          });
        }
        perf.stepTrace(trace, 'setData.success');
      })
      .catch((error) => {
        if (isSilentRefresh) {
          console.warn('loadLobbyData silent refresh failed:', error);
          return;
        }
        this.setData({
          groups: [],
          errorText: '队伍大厅加载失败，请检查网络后重试',
          hasLoaded: false,
        });
        this.lastGroupListSignature = '';
        wx.showToast({
          title: '队伍大厅加载失败',
          icon: 'none',
        });
      })
      .finally(() => {
        this.isFetchingLobby = false;
        this.loadingTask = null;
        if (this.data.isLoading) {
          this.setData({ isLoading: false });
        }
      });

    return this.loadingTask;
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (this.isFetchingLobby || this.data.joinFormVisible) {
        return;
      }
      wx.getNetworkType({
        success: (res) => {
          if (res.networkType === 'none') {
            return;
          }
          this.loadLobbyData({ force: true, showLoading: false });
        },
      });
    }, 10000);
  },

  stopAutoRefresh() {
    if (!this.refreshTimer) {
      return;
    }
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  },

  changePage(event) {
    const { key } = event.currentTarget.dataset;
    this.refreshViewState({
      activePage: key || 'lobby',
      activeFilter: '',
      activeThemeFilter: 'all',
    });
  },

  changeFilter(event) {
    const { key } = event.currentTarget.dataset;
    this.refreshViewState({
      activeFilter: key || '',
    });
  },

  openThemeFilterModal() {
    const themeFilters = this.data.themeFilters || [];
    if (!themeFilters.length) {
      return;
    }
    this.setData({
      filterPanelVisible: true,
      filterPanelTitle: '选择主题',
      filterPanelType: 'theme',
      filterPanelOptions: themeFilters,
    });
  },

  closeFilterModal() {
    this.setData({
      filterPanelVisible: false,
      filterPanelTitle: '',
      filterPanelType: '',
      filterPanelOptions: [],
    });
  },

  selectFilterOption(event) {
    const { key } = event.currentTarget.dataset;
    const filterType = this.data.filterPanelType;
    this.closeFilterModal();
    if (filterType === 'theme') {
      this.refreshViewState({
        activeThemeFilter: key || 'all',
      });
    }
  },

  clearFilterSelection() {
    const filterType = this.data.filterPanelType;
    this.closeFilterModal();
    if (filterType === 'theme') {
      this.refreshViewState({
        activeThemeFilter: 'all',
      });
    }
  },

  openCreatePage() {
    const currentActiveGroup = (this.data.groups || []).find((item) => item.isMyActiveGroup);
    if (currentActiveGroup) {
      wx.showToast({
        title: `你已在参与${currentActiveGroup.themeName}`,
        icon: 'none',
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/lobby-create/index',
    });
  },

  openRoom(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
      return;
    }
    wx.navigateTo({
      url: `/pages/team-room/index?groupId=${id}`,
    });
  },

  async promptJoinGroup(event) {
    const { id } = event.currentTarget.dataset;
    const targetGroup = (this.data.groups || []).find((item) => item.id === id);
    if (!targetGroup || !targetGroup.canJoin) {
      return;
    }

    let profile = null;
    try {
      profile = await service.getProfile();
    } catch (error) {
      profile = null;
    }

    this.setData({
      joinFormVisible: true,
      joinFormThemeName: targetGroup.themeName || '',
      joinFormGroupId: id,
      joinFormContactName: (profile && profile.nickname) || '',
      joinFormContactPhone: (profile && profile.contactPhone) || '',
      joinFormErrorField: '',
      joinFormErrorText: '',
    });
  },

  async promptCancelGroup(event) {
    const { id } = event.currentTarget.dataset;
    const targetGroup = (this.data.groups || []).find((item) => item.id === id);

    if (!targetGroup) {
      wx.showToast({ title: '没有找到这支队伍', icon: 'none' });
      return;
    }
    if (targetGroup.rawStatus === 'cancelled') {
      wx.showToast({ title: '这场队伍已经取消了', icon: 'none' });
      return;
    }
    if (targetGroup.rawStatus === 'settled') {
      wx.showToast({ title: '这场队伍已经结算完成', icon: 'none' });
      return;
    }
    if (!targetGroup.canCancel) {
      wx.showToast({ title: '你不在这个队伍中', icon: 'none' });
      return;
    }

    const isCreator = targetGroup.myGroupRole === '我发起的';
    if (!isCreator) {
      // Non-creator: show reason picker first
      this.setData({
        exitReasonVisible: true,
        exitReasonGroupId: id,
        exitReasonGroupName: targetGroup.themeName || '',
        exitReasonIsCreator: false,
        selectedExitReason: '',
      });
      return;
    }

    // Creator: show confirm dialog directly
    let penaltyPreview = null;
    try {
      const previewResult = await service.previewGroupCancelPenalty(id);
      if (previewResult && previewResult.ok) {
        penaltyPreview = previewResult.preview || null;
      }
    } catch (error) {
      console.warn('previewGroupCancelPenalty failed:', error);
    }

    this.setData({
      confirmDialogVisible: true,
      confirmDialogTitle: '取消队伍',
      confirmDialogContent:
        penaltyPreview && penaltyPreview.shouldWarn
          ? `确认取消 ${targetGroup.themeName} 这场队伍吗？当前已有其他玩家加入，取消会影响你的信誉分。`
          : `确认取消 ${targetGroup.themeName} 这场队伍吗？取消后大厅会显示为已取消。`,
      confirmDialogPenaltyPreview: penaltyPreview,
      pendingAction: {
        type: 'cancel',
        groupId: id,
        reason: '',
      },
    });
  },

  selectExitReason(event) {
    const { reason } = event.currentTarget.dataset;
    this.setData({ selectedExitReason: reason || '' });
  },

  confirmExitWithReason() {
    const reason = this.data.selectedExitReason;
    if (!reason) {
      wx.showToast({ title: '请选择一个退出原因', icon: 'none' });
      return;
    }
    const groupId = this.data.exitReasonGroupId;
    const groupName = this.data.exitReasonGroupName;
    this.setData({
      exitReasonVisible: false,
      exitReasonGroupId: '',
      exitReasonGroupName: '',
      selectedExitReason: '',
      confirmDialogVisible: true,
      confirmDialogTitle: '退出队伍',
      confirmDialogContent: `确认退出 ${groupName} 这场队伍吗？退出后你就不再占用这个位置。`,
      confirmDialogPenaltyPreview: null,
      pendingAction: {
        type: 'cancel',
        groupId,
        reason,
      },
    });
  },

  closeExitReasonPanel() {
    this.setData({
      exitReasonVisible: false,
      exitReasonGroupId: '',
      exitReasonGroupName: '',
      selectedExitReason: '',
    });
  },

  promptDeleteGroup(event) {
    const { id } = event.currentTarget.dataset;
    const targetGroup = (this.data.groups || []).find((item) => item.id === id && item.canDelete);
    if (!targetGroup) {
      return;
    }

    this.setData({
      confirmDialogVisible: true,
      confirmDialogTitle: '删除队伍记录',
      confirmDialogContent: `确认删除 ${targetGroup.themeName} 这条队伍记录吗？删除后不会再出现在“我的”里。`,
      confirmDialogPenaltyPreview: null,
      pendingAction: {
        type: 'delete',
        groupId: id,
      },
    });
  },

  closeConfirmDialog() {
    this.setData({
      confirmDialogVisible: false,
      confirmDialogTitle: '',
      confirmDialogContent: '',
      confirmDialogPenaltyPreview: null,
      pendingAction: null,
    });
  },

  closeJoinForm() {
    this.setData({
      joinFormVisible: false,
      joinFormThemeName: '',
      joinFormGroupId: '',
      joinFormContactName: '',
      joinFormContactPhone: '',
      joinFormErrorField: '',
      joinFormErrorText: '',
    });
  },

  onJoinFormInput(event) {
    const { field } = event.currentTarget.dataset;
    if (!field) {
      return;
    }

    const fieldMap = {
      contactName: 'joinFormContactName',
      contactPhone: 'joinFormContactPhone',
    };
    const dataKey = fieldMap[field];
    if (!dataKey) {
      return;
    }

    this.setData({
      [dataKey]: event.detail.value,
      joinFormErrorField:
        this.data.joinFormErrorField === field ? '' : this.data.joinFormErrorField,
      joinFormErrorText: this.data.joinFormErrorField === field ? '' : this.data.joinFormErrorText,
    });
  },

  validateJoinForm() {
    const contactName = String(this.data.joinFormContactName || '').trim();
    const contactPhone = String(this.data.joinFormContactPhone || '')
      .replace(/\D/g, '')
      .slice(0, 11);

    if (!contactName) {
      return {
        ok: false,
        field: 'contactName',
        message: '请输入联系人称呼',
      };
    }

    if (!/^1\d{10}$/.test(contactPhone)) {
      return {
        ok: false,
        field: 'contactPhone',
        message: '请输入正确的手机号',
      };
    }

    return {
      ok: true,
      payload: {
        contactName,
        contactPhone,
      },
    };
  },

  async confirmDialogAction() {
    const pendingAction = this.data.pendingAction;
    this.closeConfirmDialog();
    if (!pendingAction || !pendingAction.type) {
      return;
    }

    try {
      if (pendingAction.type === 'cancel') {
        const response = await service.cancelActiveGroup(pendingAction.groupId, pendingAction.reason || '');
        if (response.ok) {
          await this.loadLobbyData({ force: true, showLoading: false });
        } else {
          wx.showToast({
            title: response.message || '操作失败，请稍后重试',
            icon: 'none',
          });
        }
        return;
      }

      if (pendingAction.type === 'delete') {
        const response = await service.deleteGroupRecord(pendingAction.groupId);
        if (response.ok) {
          await this.loadLobbyData({ force: true, showLoading: false });
        } else {
          wx.showToast({
            title: response.message || '删除失败，请稍后重试',
            icon: 'none',
          });
        }
      }
    } catch (error) {
      wx.showToast({
        title: (error && error.message) || '操作失败，请稍后重试',
        icon: 'none',
      });
    }
  },

  async submitJoinForm() {
    if (this.data.isSubmittingJoin) {
      return;
    }
    const validation = this.validateJoinForm();
    if (!validation.ok) {
      this.setData({
        joinFormErrorField: validation.field,
        joinFormErrorText: validation.message,
      });
      return;
    }

    if (!this.data.joinFormGroupId) {
      this.setData({
        joinFormErrorText: '没有找到要加入的队伍，请返回大厅重试',
      });
      return;
    }

    this.setData({ isSubmittingJoin: true });
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const response = await service.joinGroup(this.data.joinFormGroupId, validation.payload);
      if (!response.ok) {
        this.setData({
          joinFormErrorText: response.message || '加入失败，请稍后重试',
        });
        return;
      }

      this.closeJoinForm();
      wx.showToast({
        title: '加入成功',
        icon: 'success',
      });
      await this.loadLobbyData({ force: true, showLoading: false });
    } catch (error) {
      this.setData({
        joinFormErrorText: '加入失败，请稍后重试',
      });
    } finally {
      this.setData({ isSubmittingJoin: false });
      wx.hideLoading();
    }
  },

  retryLoad() {
    this.loadLobbyData({ force: true, showLoading: false });
  },

  noop() {},

  refreshViewState(nextState = {}) {
    const groups = this.data.groups || [];
    const activePage = nextState.activePage || this.data.activePage || 'lobby';
    const activeFilter =
      nextState.activeFilter !== undefined ? nextState.activeFilter : this.data.activeFilter || '';
    const pageScopedGroups = viewModel.filterByPage(groups, activePage);
    const scopedGroups =
      activePage === 'mine'
        ? viewModel.filterByScope(pageScopedGroups, activeFilter)
        : pageScopedGroups;

    const themeFilters = viewModel.buildThemeFilters(
      scopedGroups,
      nextState.activeThemeFilter || this.data.activeThemeFilter || 'all'
    );
    const resolvedThemeFilter = themeFilters.some(
      (item) => item.key === (nextState.activeThemeFilter || this.data.activeThemeFilter || 'all')
    )
      ? nextState.activeThemeFilter || this.data.activeThemeFilter || 'all'
      : 'all';
    const resolvedThemeFilters = viewModel.buildThemeFilters(scopedGroups, resolvedThemeFilter);
    const visibleGroups = viewModel.filterLobbyList(scopedGroups, {
      activeThemeFilter: resolvedThemeFilter,
    });
    const summaryCards =
      activePage === 'mine'
        ? [
            {
              label: '我的记录',
              value: String(visibleGroups.length),
            },
            {
              label: '进行中',
              value: String((visibleGroups || []).filter((item) => item.isMyActiveGroup).length),
            },
            {
              label: '可清理',
              value: String((visibleGroups || []).filter((item) => item.canDelete).length),
            },
          ]
        : [
            {
              label: '招募中',
              value: String(visibleGroups.length),
            },
            {
              label: '我发起的',
              value: String(
                (visibleGroups || []).filter((item) => item.myGroupRole === '我发起的').length
              ),
            },
            {
              label: '可加入',
              value: String((visibleGroups || []).filter((item) => item.canJoin).length),
            },
          ];

    this.setData({
      activePage,
      activeFilter,
      activeThemeFilter: resolvedThemeFilter,
      primaryTabs: viewModel.buildPrimaryTabs(activePage),
      filterTabs: viewModel.buildFilterTabs(pageScopedGroups, activeFilter),
      themeFilters: resolvedThemeFilters,
      activeThemeSummary: viewModel.getFilterSummary(resolvedThemeFilters, resolvedThemeFilter, ''),
      visibleGroups,
      summaryCards,
    });
  },

  onShareAppMessage() {
    const visibleGroups = this.data.visibleGroups || [];
    const recruitingCount = visibleGroups.filter((item) => item.rawStatus === 'recruiting').length;
    return {
      title: recruitingCount
        ? `大厅现在有 ${recruitingCount} 支队伍在凑人，快来拼场`
        : '密室大厅等你来组队，和朋友一起开场',
      path: '/pages/lobby/index',
    };
  },
});
