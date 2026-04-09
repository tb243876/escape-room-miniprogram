'use strict';

const avatarService = require('../../utils/platform/avatar');
const service = require('../../utils/cloudbase');
const viewModel = require('./view-model');

Page({
  data: {
    summary: null,
    leaderboard: [],
    errorText: '',
    hasLoaded: false,
    selectedPlayer: null,
    activePeriod: 'total',
    periodTabs: [
      { key: 'total', text: '总榜', active: true },
      { key: 'month', text: '近30天', active: false },
    ],
  },

  async onLoad() {
    await this.loadLeaderboard({ force: true });
  },

  async onShow() {
    if (this.data.hasLoaded) {
      await this.refreshAvatarUrls();
      return;
    }
    await this.loadLeaderboard({ force: true });
  },

  async refreshAvatarUrls() {
    const nextLeaderboard = await avatarService.refreshAvatarUrlsDeep(this.data.leaderboard || []);
    const nextSelectedPlayer = await avatarService.refreshAvatarUrlsDeep(this.data.selectedPlayer);
    if (
      nextLeaderboard !== this.data.leaderboard ||
      nextSelectedPlayer !== this.data.selectedPlayer
    ) {
      this.setData({
        leaderboard: nextLeaderboard,
        selectedPlayer: nextSelectedPlayer,
      });
    }
  },

  async loadLeaderboard(options = {}) {
    const { force = false } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    this.setData({
      errorText: '',
    });
    try {
      const response = await service.getLeaderboard(this.data.activePeriod);
      if (!response.ok) {
        this.setData({
          summary: null,
          leaderboard: [],
          errorText: response.message || '排行榜加载失败，请稍后重试',
        });
        return;
      }

      this.setData({
        ...viewModel.normalizePageData(response),
        selectedPlayer: null,
        hasLoaded: true,
      });
    } catch (error) {
      console.error('loadLeaderboard failed:', error);
      this.setData({
        summary: null,
        leaderboard: [],
        errorText: '排行榜加载失败，请检查网络后重试',
        hasLoaded: false,
      });
    }
  },

  changePeriod(event) {
    const { key } = event.currentTarget.dataset;
    if (!key || key === this.data.activePeriod) {
      return;
    }
    this.setData({
      activePeriod: key,
      hasLoaded: false,
      periodTabs: this.data.periodTabs.map((tab) => ({ ...tab, active: tab.key === key })),
    });
    this.loadLeaderboard({ force: true });
  },

  retryLoad() {
    this.loadLeaderboard({ force: true });
  },

  async openPlayerCard(event) {
    const { openid, rank } = event.currentTarget.dataset;
    const leaderboard = this.data.leaderboard || [];
    const target = leaderboard.find((item) =>
      openid
        ? String(item.openId || '') === String(openid || '')
        : Number(item.rank || 0) === Number(rank || 0)
    );
    if (!target || !target.playerCard) {
      return;
    }

    this.setData({
      selectedPlayer: await avatarService.refreshAvatarUrlsDeep(target.playerCard),
    });
  },

  closePlayerCard() {
    this.setData({
      selectedPlayer: null,
    });
  },

  noop() {},

  onShareAppMessage() {
    service.recordProfileShare('leaderboard').catch(() => {});
    return {
      title: '一起来挑战密室排行榜',
      path: '/pages/leaderboard/index',
    };
  },
});
