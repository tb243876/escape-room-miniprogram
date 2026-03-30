'use strict';

const service = require('../../utils/cloudbase');
const viewModel = require('./view-model');

Page({
  data: {
    summary: null,
    leaderboard: [],
    errorText: '',
    hasLoaded: false,
    selectedPlayer: null,
  },

  async onLoad() {
    await this.loadLeaderboard({ force: true });
  },

  async onShow() {
    await this.loadLeaderboard({ force: true });
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
      const response = await service.getLeaderboard();
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

  retryLoad() {
    this.loadLeaderboard({ force: true });
  },

  openPlayerCard(event) {
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
      selectedPlayer: target.playerCard,
    });
  },

  closePlayerCard() {
    this.setData({
      selectedPlayer: null,
    });
  },

  noop() {},
});
