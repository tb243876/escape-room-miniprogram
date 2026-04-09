'use strict';

const service = require('../../../utils/cloudbase');

const PREVIEW_LIMITS = {
  themeBreakdown: 6,
  monthlyTrend: 4,
};

function buildPreviewAnalytics(analytics = null, sectionState = {}) {
  if (!analytics) {
    return null;
  }
  const themeBreakdown = Array.isArray(analytics.themeBreakdown) ? analytics.themeBreakdown : [];
  const monthlyTrend = Array.isArray(analytics.monthlyTrend) ? analytics.monthlyTrend : [];
  return {
    ...analytics,
    visibleThemeBreakdown: sectionState.showAllThemes
      ? themeBreakdown
      : themeBreakdown.slice(0, PREVIEW_LIMITS.themeBreakdown),
    hiddenThemeCount: Math.max(0, themeBreakdown.length - PREVIEW_LIMITS.themeBreakdown),
    visibleMonthlyTrend: sectionState.showAllTrends
      ? monthlyTrend
      : monthlyTrend.slice(0, PREVIEW_LIMITS.monthlyTrend),
    hiddenTrendCount: Math.max(0, monthlyTrend.length - PREVIEW_LIMITS.monthlyTrend),
  };
}

Page({
  isFetching: false,

  data: {
    analytics: null,
    errorText: '',
    isLoading: false,
    hasLoaded: false,
    sectionState: {
      showAllThemes: false,
      showAllTrends: false,
    },
  },

  async onLoad() {
    await this.loadAnalytics();
  },

  async onShow() {
    await this.loadAnalytics();
  },

  async loadAnalytics(options = {}) {
    const { force = false } = options;
    if (this.isFetching || (this.data.hasLoaded && !force)) {
      return;
    }
    this.isFetching = true;
    this.setData({ isLoading: true, errorText: '' });
    try {
      const response = await service.getStaffAnalytics();
      if (!response.ok) {
        this.setData({
          analytics: null,
          errorText: response.message || '运营数据加载失败，请稍后重试',
          hasLoaded: false,
        });
        return;
      }
      this.setData({
        analytics: buildPreviewAnalytics(
          this.normalizeAnalytics(response.analytics || {}),
          this.data.sectionState
        ),
        hasLoaded: true,
      });
    } catch (error) {
      console.error('loadAnalytics failed:', error);
      this.setData({
        analytics: null,
        errorText: '运营数据加载失败，请检查网络后重试',
        hasLoaded: false,
      });
    } finally {
      this.isFetching = false;
      this.setData({ isLoading: false });
    }
  },

  normalizeAnalytics(raw) {
    const summary = raw.summary || {};
    const themeBreakdown = (raw.themeBreakdown || []).map((item) => ({
      theme: item.theme || '未知主题',
      sessionCount: Number(item.sessionCount || 0),
      totalPlayers: Number(item.totalPlayers || 0),
      avgTeamSize:
        item.sessionCount > 0
          ? (item.totalPlayers / item.sessionCount).toFixed(1)
          : '0',
    }));
    const monthlyTrend = (raw.monthlyTrend || []).map((item) => ({
      month: item.month || '',
      sessionCount: Number(item.sessionCount || 0),
      playerCount: Number(item.playerCount || 0),
    }));
    return {
      summaryCards: [
        { label: '累计已结算场次', value: String(summary.totalSessions || 0) },
        { label: '本月场次', value: String(summary.sessionsThisMonth || 0) },
        { label: '本周场次', value: String(summary.sessionsThisWeek || 0) },
        { label: '平均队伍人数', value: String(summary.avgTeamSize || '0') },
      ],
      themeBreakdown,
      monthlyTrend,
    };
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
      analytics: buildPreviewAnalytics(this.data.analytics, nextSectionState),
    });
  },

  retryLoad() {
    this.loadAnalytics({ force: true });
  },
});
