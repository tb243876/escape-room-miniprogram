'use strict';

const service = require('../../utils/cloudbase');
const perf = require('../../utils/platform/perf');
const themeService = require('../../utils/domain/theme');

const STAR_OPTIONS = [1, 2, 3, 4, 5];

function buildDefaultReviewStats() {
  return themeService.normalizeReviewStats({});
}

function buildDefaultViewerReviewMeta() {
  return {
    canReview: false,
    reason: '',
    eligibleSessions: [],
  };
}

function formatDateTime(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    return normalized.replace('T', ' ').replace('Z', '').slice(0, 16);
  }
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

function buildRatingText(rating = 0) {
  const value = Math.max(0, Math.min(5, Number(rating || 0)));
  return `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
}

function normalizeReplyItem(item = {}) {
  const latestOrderKey = String(item.latestOrderKey || '').trim();
  return {
    ...item,
    latestOrderKey,
    createdText: formatDateTime(item.createdAt),
    likeText: Math.max(0, Number(item.likeCount || 0)) > 0 ? `${Number(item.likeCount || 0)}` : '',
  };
}

function normalizeReplyList(list = []) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeReplyItem)
    .sort((left, right) => String(left.latestOrderKey || '').localeCompare(String(right.latestOrderKey || '')));
}

function normalizeReviewItem(item = {}) {
  return {
    ...item,
    ratingText: buildRatingText(item.rating),
    createdText: formatDateTime(item.createdAt),
    replies: normalizeReplyList(item.replies),
  };
}

function normalizeEligibleSessionItem(item = {}) {
  return {
    ...item,
    playedAtText: formatDateTime(item.playedAt),
  };
}

function normalizeViewerReviewMeta(meta = {}) {
  const eligibleSessions = Array.isArray(meta.eligibleSessions)
    ? meta.eligibleSessions.map(normalizeEligibleSessionItem)
    : [];
  return {
    canReview: Boolean(meta.canReview),
    reason: String(meta.reason || '').trim(),
    eligibleSessions,
  };
}

function buildReviewFilterOptions(stats = {}, activeKey = 'all') {
  const normalizedStats = themeService.normalizeReviewStats(stats);
  return [
    { key: 'all', label: '全部', count: normalizedStats.totalCount, active: activeKey === 'all' },
    { key: 'good', label: '好评', count: normalizedStats.goodCount, active: activeKey === 'good' },
    {
      key: 'neutral',
      label: '中评',
      count: normalizedStats.neutralCount,
      active: activeKey === 'neutral',
    },
    { key: 'bad', label: '差评', count: normalizedStats.badCount, active: activeKey === 'bad' },
    {
      key: 'replied',
      label: '有回复',
      count: normalizedStats.repliedCount,
      active: activeKey === 'replied',
    },
  ];
}

function buildReviewSortOptions(activeKey = 'latest') {
  return [
    { key: 'latest', label: '最新', active: activeKey === 'latest' },
    { key: 'top', label: '高赞', active: activeKey === 'top' },
  ];
}

function buildThemeWithReviewSummary(theme = null, reviewStats = {}) {
  if (!theme) {
    return null;
  }
  return {
    ...theme,
    reviewStats: themeService.normalizeReviewStats(reviewStats || theme.reviewStats || {}),
    reviewHighlights: Array.isArray(theme.reviewHighlights) ? theme.reviewHighlights : [],
  };
}

Page({
  data: {
    theme: null,
    errorText: '',
    dialogVisible: false,
    dialogTitle: '',
    dialogContent: '',
    hasLoaded: false,
    themeId: '',
    activeDetailSection: 'story',
    reviewStats: buildDefaultReviewStats(),
    viewerReviewMeta: buildDefaultViewerReviewMeta(),
    reviewFilterKey: 'all',
    reviewSortBy: 'latest',
    reviewFilterOptions: buildReviewFilterOptions(buildDefaultReviewStats(), 'all'),
    reviewSortOptions: buildReviewSortOptions('latest'),
    reviewHighlightsExpanded: true,
    reviewList: [],
    reviewCursor: '',
    reviewHasMore: false,
    reviewHasLoadedOnce: false,
    reviewErrorText: '',
    reviewLoading: false,
    reviewLoadingMore: false,
    reviewComposerVisible: false,
    reviewComposerMode: 'review',
    reviewDraftContent: '',
    reviewDraftRating: 5,
    reviewDraftSessionId: '',
    reviewTargetReviewId: '',
    reviewTargetNickname: '',
    reviewSubmitting: false,
    pendingReviewSessionId: '',
    starOptions: STAR_OPTIONS,
  },

  async onLoad(query) {
    this.__skipNextOnShowRefresh = true;
    try {
      await this.loadThemeDetail(query, { force: true });
      const pendingReviewSessionId = String(query.pendingSessionId || '').trim();
      const shouldAutoReview =
        String(query.autoReview || '').trim() === '1' || Boolean(pendingReviewSessionId);
      if (shouldAutoReview) {
        wx.redirectTo({
          url: `/pages/theme-reviews/index?id=${this.data.themeId}&autoReview=1&pendingSessionId=${pendingReviewSessionId}`,
        });
        return;
      }
      this.setData({
        pendingReviewSessionId,
      });
    } catch (error) {
      this.setData({
        theme: null,
        errorText: '页面打开失败，请重新进入',
      });
    }
  },

  async onShow() {
    if (this.__skipNextOnShowRefresh) {
      this.__skipNextOnShowRefresh = false;
      return;
    }
    if (!this.data.themeId || !this.data.hasLoaded) {
      return;
    }
    try {
      await this.loadThemeDetail({ id: this.data.themeId }, { force: true });
    } catch (error) {
      console.warn('themeDetail onShow refresh failed:', error);
    }
  },

  async loadThemeDetail(query = {}, options = {}) {
    const themeId = query.id || this.data.themeId;
    const { force = false } = options;
    if (!themeId) {
      this.setData({
        theme: null,
        errorText: '主题信息缺失，请返回重试',
      });
      return;
    }
    if (this.data.hasLoaded && !force && this.data.themeId === themeId) {
      return;
    }
    this.setData({ errorText: '' });
    try {
      await perf.traceAsync(
        'themeDetail.load',
        async (trace) => {
          const theme = await service.getThemeDetail(themeId);
          perf.stepTrace(trace, 'service.getThemeDetail', { themeId });
          if (!theme) {
            this.setData({
              theme: null,
              errorText: '这个主题暂时无法查看，请稍后再试',
              hasLoaded: false,
              themeId,
            });
            perf.stepTrace(trace, 'setData.notFound');
            return;
          }
          const reviewStats = themeService.normalizeReviewStats(theme.reviewStats || {});
          this.setData({
            theme: buildThemeWithReviewSummary(theme, reviewStats),
            reviewStats,
            reviewFilterOptions: buildReviewFilterOptions(reviewStats, this.data.reviewFilterKey),
            hasLoaded: true,
            themeId,
          });
          perf.stepTrace(trace, 'setData.success');
        },
        { themeId: query.id }
      );
      if (!this.data.theme && !this.data.errorText) {
        this.setData({
          theme: null,
          errorText: '这个主题暂时无法查看，请稍后再试',
          hasLoaded: false,
          themeId,
        });
      }
    } catch (error) {
      this.setData({
        theme: null,
        errorText: '主题加载失败，请稍后再试',
        hasLoaded: false,
        themeId,
      });
      wx.showToast({
        title: '主题加载失败',
        icon: 'none',
      });
    }
  },

  async loadReviews(options = {}) {
    const { reset = false, silent = false } = options;
    const themeId = this.data.themeId;
    if (!themeId) {
      return false;
    }
    if (this.data.reviewLoading || this.data.reviewLoadingMore) {
      return false;
    }

    this.setData({
      reviewLoading: reset,
      reviewLoadingMore: !reset,
    });

    try {
      const result = await service.getThemeReviews(themeId, {
        sortBy: this.data.reviewSortBy,
        filterKey: this.data.reviewFilterKey,
        cursor: reset ? '' : this.data.reviewCursor,
        pageSize: 10,
      });
      const nextStats = themeService.normalizeReviewStats(
        result.reviewStats || this.data.reviewStats || {}
      );
      const nextTheme = buildThemeWithReviewSummary(this.data.theme, nextStats);
      const nextList = (reset ? [] : this.data.reviewList).concat(
        (result.reviews || []).map(normalizeReviewItem)
      );

      this.setData({
        reviewStats: nextStats,
        theme: nextTheme,
        viewerReviewMeta:
          result.viewerReviewMeta && typeof result.viewerReviewMeta === 'object'
            ? normalizeViewerReviewMeta(result.viewerReviewMeta)
            : buildDefaultViewerReviewMeta(),
        reviewFilterOptions: buildReviewFilterOptions(nextStats, this.data.reviewFilterKey),
        reviewSortOptions: buildReviewSortOptions(this.data.reviewSortBy),
        reviewList: nextList,
        reviewCursor: String(result.nextCursor || '').trim(),
        reviewHasMore: Boolean(result.hasMore),
        reviewHasLoadedOnce: true,
        reviewErrorText: '',
      });
      return true;
    } catch (error) {
      this.setData({
        reviewErrorText: '评价暂时加载失败，请稍后再试',
      });
      if (!silent) {
        wx.showToast({
          title: '加载失败',
          icon: 'none',
        });
      }
      return false;
    } finally {
      this.setData({
        reviewLoading: false,
        reviewLoadingMore: false,
      });
    }
  },

  async reloadReviewSummary() {
    await this.loadThemeDetail({ id: this.data.themeId }, { force: true });
  },

  goGroup() {
    const themeId = (this.data.theme && this.data.theme.id) || '';
    const query = themeId ? `?themeId=${themeId}` : '';
    wx.navigateTo({ url: `/pages/lobby-create/index${query}` });
  },

  contactStore() {
    this.setData({
      dialogVisible: true,
      dialogTitle: '联系门店',
      dialogContent: '想预约、问活动或咨询门店，直接联系门店就行。',
    });
  },

  toggleDetailSection(event) {
    const { key } = event.currentTarget.dataset;
    if (!key) {
      return;
    }
    const nextKey = this.data.activeDetailSection === key ? '' : key;
    this.setData({
      activeDetailSection: nextKey,
    });
  },

  openThemeReviews() {
    if (!this.data.themeId) {
      return;
    }
    wx.navigateTo({
      url: `/pages/theme-reviews/index?id=${this.data.themeId}`,
    });
  },

  toggleReviewHighlights() {
    this.setData({
      reviewHighlightsExpanded: !this.data.reviewHighlightsExpanded,
    });
  },

  async changeReviewSort(event) {
    const { key } = event.currentTarget.dataset;
    if (!key || key === this.data.reviewSortBy) {
      return;
    }
    this.setData({
      reviewSortBy: key,
      reviewSortOptions: buildReviewSortOptions(key),
    });
    await this.loadReviews({ reset: true });
  },

  async changeReviewFilter(event) {
    const { key } = event.currentTarget.dataset;
    if (!key || key === this.data.reviewFilterKey) {
      return;
    }
    this.setData({
      reviewFilterKey: key,
      reviewFilterOptions: buildReviewFilterOptions(this.data.reviewStats, key),
    });
    await this.loadReviews({ reset: true });
  },

  async loadMoreReviews() {
    if (!this.data.reviewHasMore) {
      return;
    }
    await this.loadReviews({ reset: false });
  },

  async openReviewComposer(options = {}) {
    const forceFromPending = Boolean(options && options.forceFromPending);
    if (!this.data.reviewHasLoadedOnce && !forceFromPending) {
      const loaded = await this.loadReviews({ reset: true, silent: true });
      if (!loaded) {
        wx.showToast({
          title: '暂时无法打开评价',
          icon: 'none',
        });
        return;
      }
    }
    const viewerReviewMeta =
      this.data.viewerReviewMeta && typeof this.data.viewerReviewMeta === 'object'
        ? this.data.viewerReviewMeta
        : buildDefaultViewerReviewMeta();
    if (!viewerReviewMeta.canReview && !forceFromPending) {
      wx.showToast({
        title: viewerReviewMeta.reason || '暂时还不能写评价',
        icon: 'none',
      });
      return;
    }
    const firstSession = Array.isArray(viewerReviewMeta.eligibleSessions)
      ? viewerReviewMeta.eligibleSessions[0]
      : null;
    const preferredSessionId = String((options && options.sessionId) || '').trim();
    const matchedSession =
      (Array.isArray(viewerReviewMeta.eligibleSessions)
        ? viewerReviewMeta.eligibleSessions.find(
            (item) => String(item.sessionId || '').trim() === preferredSessionId
          )
        : null) || firstSession;
    const draftSessionId =
      (matchedSession && matchedSession.sessionId) || preferredSessionId || '';
    this.setData({
      reviewComposerVisible: true,
      reviewComposerMode: 'review',
      reviewDraftContent: '',
      reviewDraftRating: 5,
      reviewDraftSessionId: draftSessionId,
      reviewTargetReviewId: '',
      reviewTargetNickname: '',
    });
  },

  openReplyComposer(event) {
    const { id, nickname } = event.currentTarget.dataset;
    if (!id) {
      return;
    }
    this.setData({
      reviewComposerVisible: true,
      reviewComposerMode: 'reply',
      reviewDraftContent: '',
      reviewDraftRating: 5,
      reviewDraftSessionId: '',
      reviewTargetReviewId: id,
      reviewTargetNickname: nickname || '',
    });
  },

  closeReviewComposer() {
    if (this.data.reviewSubmitting) {
      return;
    }
    this.setData({
      reviewComposerVisible: false,
      reviewComposerMode: 'review',
      reviewDraftContent: '',
      reviewDraftRating: 5,
      reviewDraftSessionId: '',
      reviewTargetReviewId: '',
      reviewTargetNickname: '',
    });
  },

  onReviewDraftInput(event) {
    this.setData({
      reviewDraftContent: String((event.detail && event.detail.value) || ''),
    });
  },

  chooseReviewRating(event) {
    const rating = Number(event.currentTarget.dataset.rating || 0);
    if (!rating) {
      return;
    }
    this.setData({
      reviewDraftRating: rating,
    });
  },

  chooseReviewSession(event) {
    const sessionId = String(event.currentTarget.dataset.sessionId || '').trim();
    if (!sessionId) {
      return;
    }
    this.setData({
      reviewDraftSessionId: sessionId,
    });
  },

  async submitReviewComposer() {
    if (this.data.reviewSubmitting) {
      return;
    }
    const mode = this.data.reviewComposerMode;
    const content = String(this.data.reviewDraftContent || '').trim();
    if (!content) {
      wx.showToast({
        title: mode === 'reply' ? '请输入回复内容' : '请输入评价内容',
        icon: 'none',
      });
      return;
    }
    if (mode === 'review' && !String(this.data.reviewDraftSessionId || '').trim()) {
      wx.showToast({
        title: '请选择一场已完成体验',
        icon: 'none',
      });
      return;
    }

    this.setData({
      reviewSubmitting: true,
    });
    try {
      let result = null;
      if (mode === 'reply') {
        result = await service.createThemeReviewReply({
          reviewId: this.data.reviewTargetReviewId,
          content,
        });
      } else {
        result = await service.createThemeReview({
          themeId: this.data.themeId,
          sessionId: this.data.reviewDraftSessionId,
          content,
          rating: this.data.reviewDraftRating,
        });
      }

      if (!result || !result.ok) {
        wx.showToast({
          title: (result && result.message) || (mode === 'reply' ? '回复失败' : '评价失败'),
          icon: 'none',
        });
        return;
      }

      wx.showToast({
        title: result.message || (mode === 'reply' ? '回复已发送' : '评价已提交'),
        icon: 'none',
      });
      this.setData({
        reviewComposerVisible: false,
        reviewComposerMode: 'review',
        reviewDraftContent: '',
        reviewDraftRating: 5,
        reviewDraftSessionId: '',
        reviewTargetReviewId: '',
        reviewTargetNickname: '',
        pendingReviewSessionId: '',
      });
      await this.reloadReviewSummary();
      await this.loadReviews({ reset: true });
    } catch (error) {
      wx.showToast({
        title: mode === 'reply' ? '回复失败' : '评价失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        reviewSubmitting: false,
      });
    }
  },

  async toggleReviewLike(event) {
    const { id, rootId } = event.currentTarget.dataset;
    const targetId = String(id || '').trim();
    if (!targetId) {
      return;
    }

    let result = null;
    try {
      result = await service.toggleThemeReviewLike(targetId);
    } catch (error) {
      wx.showToast({
        title: '点赞失败',
        icon: 'none',
      });
      return;
    }
    if (!result || !result.ok) {
      wx.showToast({
        title: (result && result.message) || '点赞失败',
        icon: 'none',
      });
      return;
    }

    const normalizedRootId = String(rootId || '').trim();
    const nextReviewList = this.data.reviewList.map((review) => {
      if (String(review.id || '') === targetId) {
        return {
          ...review,
          liked: Boolean(result.liked),
          likeCount: Math.max(0, Number(result.likeCount || 0)),
        };
      }
      if (normalizedRootId && String(review.id || '') === normalizedRootId) {
        return {
          ...review,
          replies: (review.replies || []).map((reply) =>
            String(reply.id || '') === targetId
              ? {
                  ...reply,
                  liked: Boolean(result.liked),
                  likeCount: Math.max(0, Number(result.likeCount || 0)),
                }
              : reply
          ),
        };
      }
      return review;
    });

    this.setData({
      reviewList: nextReviewList,
    });

    try {
      await this.reloadReviewSummary();
    } catch (error) {}
  },

  async loadMoreReplies(event) {
    const rootReviewId = String(event.currentTarget.dataset.id || '').trim();
    if (!rootReviewId) {
      return;
    }
    const targetReview = this.data.reviewList.find((item) => String(item.id || '') === rootReviewId);
    if (!targetReview) {
      return;
    }
    const oldestLoadedReply = (targetReview.replies || []).length
      ? (targetReview.replies || [])[0]
      : null;
    const cursor = oldestLoadedReply ? String(oldestLoadedReply.latestOrderKey || '').trim() : '';
    let result = null;
    try {
      result = await service.listThemeReviewReplies(rootReviewId, {
        cursor,
        pageSize: 10,
      });
    } catch (error) {
      wx.showToast({
        title: '回复加载失败',
        icon: 'none',
      });
      return;
    }
    const olderReplies = normalizeReplyList(result.replies || []);
    const nextReviewList = this.data.reviewList.map((review) => {
      if (String(review.id || '') !== rootReviewId) {
        return review;
      }
      return {
        ...review,
        replies: olderReplies.concat(review.replies || []),
        hasMoreReplies: Boolean(result.hasMore),
      };
    });
    this.setData({
      reviewList: nextReviewList,
    });
  },

  retryLoad() {
    this.loadThemeDetail({ id: this.data.themeId }, { force: true });
    if (this.data.reviewHasLoadedOnce || this.data.activeDetailSection === 'reviews') {
      this.loadReviews({ reset: true, silent: true });
    }
  },

  closeDialog() {
    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
    });
  },

  noop() {},
});
