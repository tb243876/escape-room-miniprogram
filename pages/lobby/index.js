'use strict';

const service = require('../../utils/cloudbase');
const perf = require('../../utils/platform/perf');
const viewModel = require('./view-model');

Page({
  refreshTimer: null,

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
    joinFormVisible: false,
    joinFormThemeName: '',
    joinFormGroupId: '',
    joinFormContactName: '',
    joinFormContactPhone: '',
    joinFormErrorField: '',
    joinFormErrorText: '',
    pendingAction: null,
    errorText: '',
    isLoading: false,
    hasLoaded: false,
  },

  async onLoad() {
    try {
      await this.loadLobbyData({ force: true, showLoading: false });
    } catch (error) {
      this.setData({
        groups: [],
        errorText: '组局大厅初始化失败，请重新进入页面',
      });
    }
  },

  async onShow() {
    if (this.data.isLoading) {
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

  async loadLobbyData(options = {}) {
    const { force = false } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    this.setData({
      isLoading: true,
      errorText: '',
    });
    try {
      await perf.traceAsync('lobby.loadLobbyData', async (trace) => {
        const groups = await service.getLobbyList();
        perf.stepTrace(trace, 'service.getLobbyList', {
          count: (groups || []).length,
        });
        const normalizedGroups = viewModel.normalizeLobbyList(groups || []);
        this.setData({
          groups: normalizedGroups,
          hasLoaded: true,
        });
        this.refreshViewState();
        perf.stepTrace(trace, 'setData.success');
      });
    } catch (error) {
      this.setData({
        groups: [],
        errorText: '组局大厅加载失败，请检查网络后重试',
        hasLoaded: false,
      });
      wx.showToast({
        title: '组局大厅加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      if (this.data.isLoading || this.data.joinFormVisible) {
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
    }, 3500);
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

  promptCancelGroup(event) {
    const { id } = event.currentTarget.dataset;
    const targetGroup = (this.data.groups || []).find((item) => item.id === id);

    // 找不到组局
    if (!targetGroup) {
      wx.showToast({ title: '没有找到这支队伍', icon: 'none' });
      return;
    }

    // 组局已取消
    if (targetGroup.rawStatus === 'cancelled') {
      wx.showToast({ title: '这场组局已经取消了', icon: 'none' });
      return;
    }

    // 组局已结算
    if (targetGroup.rawStatus === 'settled') {
      wx.showToast({ title: '这场组局已经结算完成', icon: 'none' });
      return;
    }

    // 不是自己的组局
    if (!targetGroup.isMyActiveGroup) {
      wx.showToast({ title: '你不在这个组局中', icon: 'none' });
      return;
    }

    this.setData({
      confirmDialogVisible: true,
      confirmDialogTitle: targetGroup.myGroupRole === '我发起的' ? '取消组局' : '退出组局',
      confirmDialogContent:
        targetGroup.myGroupRole === '我发起的'
          ? `确认取消 ${targetGroup.themeName} 这场组局吗？取消后大厅会显示为已取消。`
          : `确认退出 ${targetGroup.themeName} 这场组局吗？退出后你就不再占用这个位置。`,
      pendingAction: {
        type: 'cancel',
        groupId: id,
      },
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

    wx.showLoading({ title: '处理中', mask: true });
    try {
      if (pendingAction.type === 'cancel') {
        const response = await service.cancelActiveGroup(pendingAction.groupId);
        wx.showToast({
          title: response.message || '操作完成',
          icon: response.ok ? 'success' : 'none',
        });
        if (response.ok) {
          await this.loadLobbyData({ force: true, showLoading: false });
        }
        return;
      }

      if (pendingAction.type === 'delete') {
        const response = await service.deleteGroupRecord(pendingAction.groupId);
        wx.showToast({
          title: response.message || '删除完成',
          icon: response.ok ? 'success' : 'none',
        });
        if (response.ok) {
          await this.loadLobbyData({ force: true, showLoading: false });
        }
      }
    } catch (error) {
      wx.showToast({
        title:
          (error && error.message) ||
          (pendingAction.type === 'join' ? '加入失败，请稍后重试' : '操作失败，请稍后重试'),
        icon: 'none',
      });
    } finally {
      wx.hideLoading();
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
        joinFormErrorText: '没有找到要加入的组局，请返回大厅重试',
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
});
