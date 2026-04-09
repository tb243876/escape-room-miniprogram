'use strict';

const service = require('../../utils/cloudbase');
const staffService = require('../../utils/domain/staff');
const perf = require('../../utils/platform/perf');
const storage = require('../../utils/platform/storage');
const viewModel = require('./view-model');

const MY_REVIEW_READ_STORAGE_KEY = 'escape-room-my-review-read-ids-v1';

function formatDateTime(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '暂无记录';
  }
  return normalized.replace('T', ' ').slice(0, 16) || '暂无记录';
}

function buildPenaltyReasonText(reason) {
  const normalized = String(reason || '').trim();
  if (normalized === 'creator_cancel_group') {
    return '房主取消了已有人加入的队伍';
  }
  return normalized || '暂无';
}

function getBeijingDaySerial(value) {
  const timestamp = new Date(value || '').getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 0;
  }
  return Math.floor((timestamp + 8 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000));
}

function getDailyRecoveryGain(elapsedDays) {
  if (elapsedDays <= 0) {
    return 0;
  }
  if (elapsedDays <= 5) {
    return 1;
  }
  if (elapsedDays <= 10) {
    return 2;
  }
  return 5;
}

function buildRecoveryRuleText(reputationMeta = {}, currentScore = 100) {
  if (currentScore >= 100) {
    return '当前已满分，暂不触发自然恢复。';
  }

  const lastPenaltyAt = String(reputationMeta.lastPenaltyAt || '').trim();
  if (!lastPenaltyAt) {
    return '暂无扣分记录，后续若发生扣分，将按自然日自动恢复。';
  }

  const todaySerial = getBeijingDaySerial(Date.now());
  const penaltyDaySerial = getBeijingDaySerial(lastPenaltyAt);
  const elapsedDays =
    todaySerial && penaltyDaySerial && todaySerial > penaltyDaySerial
      ? todaySerial - penaltyDaySerial
      : 0;

  return elapsedDays > 0
    ? `已进入自然恢复第 ${elapsedDays} 天：前 5 天每天 +1，第 6 到 10 天每天 +2，10 天后每天 +5。`
    : '自然恢复将在次日开始生效：前 5 天每天 +1，第 6 到 10 天每天 +2，10 天后每天 +5。';
}

function buildTomorrowRecoveryText(reputationMeta = {}, currentScore = 100) {
  if (currentScore >= 100) {
    return '明日预计 +0';
  }

  const lastPenaltyAt = String(reputationMeta.lastPenaltyAt || '').trim();
  if (!lastPenaltyAt) {
    return '明日预计 +0';
  }

  const penaltyDaySerial = getBeijingDaySerial(lastPenaltyAt);
  const tomorrowSerial = getBeijingDaySerial(Date.now()) + 1;
  if (!penaltyDaySerial || !tomorrowSerial || tomorrowSerial <= penaltyDaySerial) {
    return '明日预计 +0';
  }

  const tomorrowElapsedDays = tomorrowSerial - penaltyDaySerial;
  const gain = Math.min(getDailyRecoveryGain(tomorrowElapsedDays), Math.max(0, 100 - currentScore));
  return `明日预计 +${gain}`;
}

function buildReputationPanel(profile = {}) {
  const reputationMeta =
    profile && profile.reputationMeta && typeof profile.reputationMeta === 'object'
      ? profile.reputationMeta
      : {};
  const currentScore = Math.max(0, Number(profile.reputationScore || 0));
  const creatorCancelCount = Math.max(0, Number(reputationMeta.creatorCancelCount || 0));
  const creatorLateCancelCount = Math.max(0, Number(reputationMeta.creatorLateCancelCount || 0));
  const cancelCount = Math.max(0, Number(profile.cancelCount || 0));
  const penaltyTotal = Math.max(0, Number(reputationMeta.penaltyTotal || 0));
  const items = [
    {
      label: '当前信誉状态',
      value: String(profile.reputationTierLabel || '正常').trim() || '正常',
      note: String(profile.reputationRestrictionText || '正常用户，无额外限制').trim(),
    },
    {
      label: '主动退出次数',
      value: `${cancelCount} 次`,
      note: '主动退出会记入信誉记录。',
    },
    {
      label: '房主取消次数',
      value: `${creatorCancelCount} 次`,
      note: `其中临近开场取消 ${creatorLateCancelCount} 次。`,
    },
    {
      label: '累计扣分',
      value: `${penaltyTotal} 分`,
      note:
        penaltyTotal > 0
          ? '包含房主取消队伍产生的扣分。'
          : '暂时还没有扣分记录。',
    },
    {
      label: '最近一次扣分',
      value: formatDateTime(reputationMeta.lastPenaltyAt),
      note: buildPenaltyReasonText(reputationMeta.lastPenaltyReason),
    },
    {
      label: '自然恢复',
      value: currentScore >= 100 ? '已满分' : '恢复中',
      note: buildRecoveryRuleText(reputationMeta, currentScore),
    },
  ];

  return {
    type: 'reputation',
    title: '信誉分明细',
    subtitle: `当前信誉 ${currentScore} 分，${String(
      profile.reputationRestrictionText || '正常用户，无额外限制'
    ).trim()}`,
    score: currentScore,
    tierLabel: String(profile.reputationTierLabel || '正常').trim() || '正常',
    tomorrowRecoveryText: buildTomorrowRecoveryText(reputationMeta, currentScore),
    items,
  };
}

function buildGrowthPanel(profile = {}) {
  const growthValue = Math.max(0, Number(profile.growthValue || 0));
  const nextLevelName = String(profile.nextLevelName || '').trim();
  const nextLevelRemainingGrowth = Math.max(0, Number(profile.nextLevelRemainingGrowth || 0));
  const growthProgressPercent = Math.max(0, Math.min(100, Number(profile.growthProgressPercent || 0)));
  const recentItems = Array.isArray(profile.growthRecentEvents) ? profile.growthRecentEvents : [];
  return {
    type: 'growth',
    title: '成长值进度',
    subtitle: nextLevelName
      ? `当前称号「${profile.level || '入局新人'}」，距离「${nextLevelName}」还差 ${nextLevelRemainingGrowth} 成长值`
      : `当前称号「${profile.level || '传说破局者'}」，已经达到最高称号`,
    score: growthValue,
    progressPercent: growthProgressPercent,
    nextLevelName,
    remainingGrowth: nextLevelRemainingGrowth,
    items: recentItems.map((item) => ({
      label: item.themeName,
      value: `+${item.total}`,
      note: `${item.dateText || '时间待更新'} · ${item.noteText || '成长值已入账'}`,
    })),
  };
}

function buildLevelBenefitsPanel(profile = {}) {
  const benefits = Array.isArray(profile.levelBenefits) ? profile.levelBenefits : [];
  return {
    type: 'levelBenefits',
    title: '称号福利',
    subtitle: `当前称号「${profile.level || '入局新人'}」可享权益`,
    levelName: String(profile.level || '入局新人').trim() || '入局新人',
    items: benefits.map((item) => ({
      label: item,
      note: '达到当前称号后自动生效。',
    })),
  };
}

function buildPendingReviewPanel(items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];
  return {
    type: 'pendingReviews',
    title: '待评价',
    subtitle: normalizedItems.length
      ? `你还有 ${normalizedItems.length} 场体验可以补上感受。`
      : '',
    items: normalizedItems.map((item, index) => ({
      ...item,
      pendingKey: item.sessionId || item.themeId || `pending-${index}`,
      playedAtText: formatDateTime(item.playedAt),
    })),
  };
}

function buildMyReviewPanel(items = []) {
  const normalizedItems = Array.isArray(items) ? items : [];
  return {
    type: 'myReviews',
    title: '我的评价',
    subtitle: normalizedItems.length
      ? `这里会显示你最近写过的 ${normalizedItems.length} 条评价。`
      : '你还没写过评价。',
    items: normalizedItems.map((item, index) => ({
      ...item,
      reviewKey: item.reviewId || `my-review-${index}`,
      createdAtText: formatDateTime(item.createdAt),
    })),
  };
}

function getReadMyReviewIdSet() {
  const rawValue = storage.safeGetStorage(MY_REVIEW_READ_STORAGE_KEY);
  const idList = Array.isArray(rawValue) ? rawValue : [];
  return new Set(
    idList
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(-200)
  );
}

function saveReadMyReviewIds(items = []) {
  const currentIdSet = getReadMyReviewIdSet();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const reviewId = String((item && item.reviewId) || '').trim();
    if (reviewId) {
      currentIdSet.add(reviewId);
    }
  });
  storage.safeSetStorage(MY_REVIEW_READ_STORAGE_KEY, Array.from(currentIdSet).slice(-200));
  return currentIdSet;
}

function countUnreadMyReviews(items = []) {
  const readIdSet = getReadMyReviewIdSet();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const reviewId = String((item && item.reviewId) || '').trim();
    return reviewId && !readIdSet.has(reviewId);
  }).length;
}

Page({
  data: {
    profile: null,
    errorText: '',
    showBadgesPanel: false,
    showPerksPanel: false,
    showStatsPanel: false,
    currentStatsPanel: null,
    selectedBadge: null,
    pendingReviewItems: [],
    pendingReviewCount: 0,
    myReviewItems: [],
    myReviewCount: 0,
    reviewDeleteDialogVisible: false,
    reviewDeleteTargetId: '',
    reviewDeleteSubmitting: false,
    hasLoaded: false,
  },

  async onLoad() {
    this.__skipNextOnShowRefresh = true;
    try {
      await this.loadProfile({ force: true });
    } catch (error) {
      console.error('profile onLoad failed:', error);
      this.setData({
        profile: null,
        errorText: '个人主页打开失败，请重新进入',
      });
    }
  },

  async onShow() {
    if (this.__skipNextOnShowRefresh) {
      this.__skipNextOnShowRefresh = false;
      return;
    }
    try {
      await this.loadProfile({ force: true });
    } catch (error) {
      console.error('profile onShow failed:', error);
      this.setData({
        profile: null,
        errorText: '个人主页刷新失败，请稍后再试',
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
      showStatsPanel: false,
      currentStatsPanel: null,
      selectedBadge: null,
    });
    try {
      await perf.traceAsync('profile.loadProfile', async (trace) => {
        const [profile, pendingReviewResult, myReviewResult] = await Promise.all([
          service.getProfile(),
          service.getPendingThemeReviews().catch((error) => {
            console.warn('getPendingThemeReviews failed:', error);
            return {
              totalCount: 0,
              items: [],
            };
          }),
          service.getMyThemeReviews().catch((error) => {
            console.warn('getMyThemeReviews failed:', error);
            return {
              totalCount: 0,
              items: [],
            };
          }),
        ]);
        perf.stepTrace(trace, 'service.getProfile');
        this.setData({
          profile: viewModel.normalizeProfile(profile),
          pendingReviewItems: Array.isArray(pendingReviewResult.items)
            ? pendingReviewResult.items
            : [],
          pendingReviewCount: Math.max(0, Number(pendingReviewResult.totalCount || 0)),
          myReviewItems: Array.isArray(myReviewResult.items) ? myReviewResult.items : [],
          myReviewCount: countUnreadMyReviews(myReviewResult.items),
          hasLoaded: true,
        });
        perf.stepTrace(trace, 'setData');
      });
    } catch (error) {
      console.error('loadProfile failed:', error);
      this.setData({
        profile: null,
        errorText: '个人主页加载失败，请稍后再试',
      });
      wx.showToast({
        title: '个人主页加载失败',
        icon: 'none',
      });
    }
  },

  async refreshReviewData(options = {}) {
    const { preserveCurrentPanel = true } = options;
    const [pendingReviewResult, myReviewResult] = await Promise.all([
      service.getPendingThemeReviews().catch((error) => {
        console.warn('refresh pending reviews failed:', error);
        return {
          totalCount: 0,
          items: [],
        };
      }),
      service.getMyThemeReviews().catch((error) => {
        console.warn('refresh my reviews failed:', error);
        return {
          totalCount: 0,
          items: [],
        };
      }),
    ]);

    const pendingReviewItems = Array.isArray(pendingReviewResult.items) ? pendingReviewResult.items : [];
    const myReviewItems = Array.isArray(myReviewResult.items) ? myReviewResult.items : [];
    const nextData = {
      pendingReviewItems,
      pendingReviewCount: Math.max(0, Number(pendingReviewResult.totalCount || 0)),
      myReviewItems,
      myReviewCount: countUnreadMyReviews(myReviewItems),
    };

    if (preserveCurrentPanel && this.data.currentStatsPanel) {
      const currentType = String(this.data.currentStatsPanel.type || '').trim();
      if (currentType === 'pendingReviews') {
        nextData.currentStatsPanel = buildPendingReviewPanel(pendingReviewItems);
      } else if (currentType === 'myReviews') {
        nextData.currentStatsPanel = buildMyReviewPanel(myReviewItems);
      }
    }

    this.setData(nextData);
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
        title: '还没有可用权益',
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
      showStatsPanel: false,
      currentStatsPanel: null,
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

  openBadgeSummary() {
    const profile = this.data.profile;
    const badgeList = profile && Array.isArray(profile.unlockedBadgeList)
      ? profile.unlockedBadgeList
      : [];
    if (!badgeList.length) {
      wx.showToast({
        title: '你还没有解锁徽章',
        icon: 'none',
      });
      return;
    }
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
      showStatsPanel: true,
      currentStatsPanel: {
        type: 'badges',
        title: '我的徽章',
        subtitle: `已解锁 ${badgeList.length} 枚，点开可以看每一枚的说明`,
        items: badgeList,
      },
    });
  },

  openRecentSessions() {
    const profile = this.data.profile;
    const recordList = profile && Array.isArray(profile.recentPlayPreview)
      ? profile.recentPlayPreview
      : [];
    if (!recordList.length) {
      wx.showToast({
        title: '还没有体验记录',
        icon: 'none',
      });
      return;
    }
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
      showStatsPanel: true,
      currentStatsPanel: {
        type: 'records',
        title: '最近体验',
        subtitle: '这里只显示最近 5 场体验',
        items: recordList,
      },
    });
  },

  openGrowthDetail() {
    const profile = this.data.profile;
    if (!profile) {
      return;
    }
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
      showStatsPanel: true,
      currentStatsPanel: buildGrowthPanel(profile),
    });
  },

  openLevelBenefits() {
    const profile = this.data.profile;
    if (!profile) {
      return;
    }
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
      showStatsPanel: true,
      currentStatsPanel: buildLevelBenefitsPanel(profile),
    });
  },

  openReputationDetail() {
    const profile = this.data.profile;
    if (!profile) {
      return;
    }
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
      showStatsPanel: true,
      currentStatsPanel: buildReputationPanel(profile),
    });
  },

  closeStatsPanel() {
    this.setData({
      showStatsPanel: false,
      currentStatsPanel: null,
    });
  },

  openPendingReviews() {
    const pendingReviewItems = Array.isArray(this.data.pendingReviewItems)
      ? this.data.pendingReviewItems
      : [];
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
      showStatsPanel: true,
      currentStatsPanel: buildPendingReviewPanel(pendingReviewItems),
    });
  },

  openMyReviews() {
    const myReviewItems = Array.isArray(this.data.myReviewItems) ? this.data.myReviewItems : [];
    if (!myReviewItems.length) {
      wx.showToast({
        title: '你还没写过评价',
        icon: 'none',
      });
      return;
    }
    saveReadMyReviewIds(myReviewItems);
    this.setData({
      showBadgesPanel: false,
      showPerksPanel: false,
      selectedBadge: null,
      showStatsPanel: true,
      myReviewCount: 0,
      currentStatsPanel: buildMyReviewPanel(myReviewItems),
    });
  },

  openDeleteMyReview(event) {
    const reviewId = String(event.currentTarget.dataset.reviewId || '').trim();
    if (!reviewId) {
      return;
    }
    this.setData({
      reviewDeleteDialogVisible: true,
      reviewDeleteTargetId: reviewId,
    });
  },

  closeReviewDeleteDialog() {
    if (this.data.reviewDeleteSubmitting) {
      return;
    }
    this.setData({
      reviewDeleteDialogVisible: false,
      reviewDeleteTargetId: '',
    });
  },

  async confirmDeleteMyReview() {
    const reviewId = String(this.data.reviewDeleteTargetId || '').trim();
    if (!reviewId || this.data.reviewDeleteSubmitting) {
      return;
    }

    this.setData({
      reviewDeleteSubmitting: true,
    });
    try {
      const result = await service.deleteThemeReview(reviewId);
      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || '删除失败',
          icon: 'none',
        });
        return;
      }

      wx.showToast({
        title: result.message || '已删除',
        icon: 'none',
      });
      this.setData({
        reviewDeleteDialogVisible: false,
        reviewDeleteTargetId: '',
      });
      await this.refreshReviewData({ preserveCurrentPanel: true });
    } catch (error) {
      wx.showToast({
        title: '删除失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        reviewDeleteSubmitting: false,
      });
    }
  },

  goPendingReview(event) {
    const themeId = String(event.currentTarget.dataset.themeId || '').trim();
    const sessionId = String(event.currentTarget.dataset.sessionId || '').trim();
    if (!themeId) {
      wx.showToast({
        title: '这条待评价记录暂时打不开',
        icon: 'none',
      });
      return;
    }
    this.closeStatsPanel();
    wx.navigateTo({
      url: `/pages/theme-reviews/index?id=${themeId}&autoReview=1&pendingSessionId=${sessionId}`,
    });
  },

  contactStore() {
    const phone = this.data.profile && this.data.profile.contactPhone;
    if (!phone) {
      wx.showToast({
        title: '门店暂时还没留下联系方式',
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
      url: binding
        ? '/packages/staff/dashboard/index'
        : '/packages/staff/auth-code/index',
    });
  },

  openLeaderboard() {
    wx.navigateTo({
      url: '/pages/leaderboard/index',
    });
  },

  openProfileEdit() {
    wx.navigateTo({
      url: '/packages/profile/edit/index',
    });
  },

  retryLoad() {
    this.loadProfile({ force: true });
  },

  /*
  onShareAppMessage() {
    const profile = this.data.profile || {};
    const recentTheme = Array.isArray(profile.recentThemes) && profile.recentThemes.length
      ? `，最近在玩 ${profile.recentThemes[0]}`
      : '';
    service.recordProfileShare('profile').catch(() => {});
    return {
      title: `${profile.nickname || '玩家'} 已完成 ${profile.totalPlayCount || 0} 场，点亮 ${profile.badgeCount || 0} 枚徽章${recentTheme}`,
      path: '/pages/profile/index',
    };
  },
  */

  noop() {},
});
