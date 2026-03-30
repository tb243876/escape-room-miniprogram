'use strict';

const service = require('../../utils/cloudbase');
const staffService = require('../../utils/domain/staff');
const perf = require('../../utils/platform/perf');
const viewModel = require('./view-model');

Page({
  data: {
    profile: null,
    errorText: '',
    showBadgesPanel: false,
    showPerksPanel: false,
    selectedBadge: null,
    hasLoaded: false,
  },

  async onLoad() {
    try {
      await this.loadProfile({ force: true });
    } catch (error) {
      console.error('profile onLoad failed:', error);
      this.setData({
        profile: null,
        errorText: '个人主页初始化失败，请重新进入页面',
      });
    }
  },

  async onShow() {
    try {
      await this.loadProfile({ force: true });
    } catch (error) {
      console.error('profile onShow failed:', error);
      this.setData({
        profile: null,
        errorText: '个人主页刷新失败，请稍后重试',
      });
    }
  },

  async loadProfile(options = {}) {
    const { force = false } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    this.setData({
      errorText: '',
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
    });
    try {
      await perf.traceAsync('profile.loadProfile', async (trace) => {
        const profile = await service.getProfile();
        console.info('profile page data:', profile);
        perf.stepTrace(trace, 'service.getProfile');
        this.setData({
          profile: viewModel.normalizeProfile(profile),
          hasLoaded: true,
        });
        perf.stepTrace(trace, 'setData');
      });
    } catch (error) {
      console.error('loadProfile failed:', error);
      this.setData({
        profile: null,
        errorText: '个人主页加载失败，请稍后重试',
      });
      wx.showToast({
        title: '个人主页加载失败',
        icon: 'none',
      });
    }
  },

  goBadges() {
    this.setData({
      showBadgesPanel: true,
      showPerksPanel: false,
      selectedBadge: null,
    });
  },

  showPerks() {
    const profile = this.data.profile;
    if (!profile || !Array.isArray(profile.perks) || !profile.perks.length) {
      wx.showToast({
        title: '当前还没有权益内容',
        icon: 'none',
      });
      return;
    }
    this.setData({
      showPerksPanel: true,
      showBadgesPanel: false,
      selectedBadge: null,
    });
  },

  closePanels() {
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
    });
  },

  openBadgeDetail(event) {
    const { key } = event.currentTarget.dataset;
    const selectedBadge = viewModel.findSelectedBadge(this.data.profile, key);
    if (!selectedBadge) {
      return;
    }
    this.setData({ selectedBadge });
  },

  closeBadgeDetail() {
    this.setData({ selectedBadge: null });
  },

  contactStore() {
    const phone = this.data.profile && this.data.profile.contactPhone;
    if (!phone) {
      wx.showToast({
        title: '暂未配置门店电话',
        icon: 'none',
      });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
    });
  },

  openWorkbench() {
    const binding = staffService.getLocalStaffBinding();
    wx.navigateTo({
      url: binding ? '/pages/staff-dashboard/index' : '/pages/staff-auth-code/index',
    });
  },

  openLeaderboard() {
    wx.navigateTo({
      url: '/pages/leaderboard/index',
    });
  },

  openProfileEdit() {
    wx.navigateTo({
      url: '/pages/profile-edit/index',
    });
  },

  retryLoad() {
    this.loadProfile({ force: true });
  },

  noop() {},
});
