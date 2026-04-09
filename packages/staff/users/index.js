'use strict';

const avatarService = require('../../../utils/platform/avatar');
const service = require('../../../utils/cloudbase');
const staffService = require('../../../utils/domain/staff');
const viewModel = require('../dashboard/view-model');

const PANEL_PREVIEW_LIMIT = 8;

function buildPreviewPanel(panel = null, panelState = {}) {
  if (!panel) {
    return null;
  }
  const items = Array.isArray(panel.items) ? panel.items : [];
  const showAll = Boolean(panelState.showAllItems);
  return {
    ...panel,
    visibleItems: showAll ? items : items.slice(0, PANEL_PREVIEW_LIMIT),
    hiddenItemCount: Math.max(0, items.length - PANEL_PREVIEW_LIMIT),
  };
}

Page({
  data: {
    dashboard: null,
    errorText: '',
    redirectingToAuth: false,
    hasLoaded: false,
    selectedPanel: null,
    selectedUserProfile: null,
    panelState: {
      showAllItems: false,
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
    const nextSelectedUserProfile = await avatarService.refreshAvatarUrlsDeep(
      this.data.selectedUserProfile
    );
    let nextSelectedPanel = this.data.selectedPanel;
    if (nextSelectedPanel && nextDashboard && nextDashboard.memberPanels) {
      nextSelectedPanel =
        nextDashboard.memberPanels[nextSelectedPanel.key] || this.data.selectedPanel;
      nextSelectedPanel = buildPreviewPanel(nextSelectedPanel, this.data.panelState);
    }
    if (
      nextDashboard !== this.data.dashboard ||
      nextSelectedUserProfile !== this.data.selectedUserProfile ||
      nextSelectedPanel !== this.data.selectedPanel
    ) {
      this.setData({
        dashboard: nextDashboard,
        selectedPanel: nextSelectedPanel,
        selectedUserProfile: nextSelectedUserProfile,
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
        const message = response.message || '用户看板加载失败';
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
        selectedPanel: null,
        selectedUserProfile: null,
        panelState: {
          showAllItems: false,
        },
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

  openMemberPanel(event) {
    const { key } = event.currentTarget.dataset;
    const dashboard = this.data.dashboard;
    const panel = dashboard && dashboard.memberPanels ? dashboard.memberPanels[key] : null;
    if (!panel) {
      return;
    }
    const nextPanelState = {
      showAllItems: false,
    };
    this.setData({
      selectedPanel: buildPreviewPanel(panel, nextPanelState),
      selectedUserProfile: null,
      panelState: nextPanelState,
    });
  },

  togglePanelItems() {
    const selectedPanel = this.data.selectedPanel;
    if (!selectedPanel) {
      return;
    }
    const dashboard = this.data.dashboard;
    const sourcePanel =
      dashboard &&
      dashboard.memberPanels &&
      selectedPanel.key &&
      dashboard.memberPanels[selectedPanel.key]
        ? dashboard.memberPanels[selectedPanel.key]
        : selectedPanel;
    const nextPanelState = {
      ...this.data.panelState,
      showAllItems: !this.data.panelState.showAllItems,
    };
    this.setData({
      panelState: nextPanelState,
      selectedPanel: buildPreviewPanel(sourcePanel, nextPanelState),
    });
  },

  async openUserProfile(event) {
    const { openid } = event.currentTarget.dataset;
    const selectedPanel = this.data.selectedPanel;
    const panelItems =
      selectedPanel && Array.isArray(selectedPanel.items) ? selectedPanel.items : [];
    const target = panelItems.find((item) => String(item.openId || '') === String(openid || ''));
    if (!target || !target.profileCard) {
      return;
    }

    this.setData({
      selectedUserProfile: await avatarService.refreshAvatarUrlsDeep(target.profileCard),
    });
  },

  closeUserProfile() {
    this.setData({
      selectedUserProfile: null,
    });
  },

  closePanel() {
    this.setData({
      selectedPanel: null,
      selectedUserProfile: null,
    });
  },

  noop() {},
});
