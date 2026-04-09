'use strict';

const service = require('../../utils/cloudbase');
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
  };
}

function normalizeReplyList(list = []) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeReplyItem)
    .sort((left, right) =>
      String(left.latestOrderKey || '').localeCompare(String(right.latestOrderKey || ''))
    );
}

function normalizeReviewItem(item = {}) {
  const replyCount = Math.max(0, Number(item.replyCount || 0));
  return {
    ...item,
    replyCount,
    ratingText: buildRatingText(item.rating),
    createdText: formatDateTime(item.createdAt),
    replies: normalizeReplyList(item.replies),
    repliesExpanded: false,
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

Page({
  data: {
    theme: null,
    themeId: '',
    errorText: '',
    reviewStats: buildDefaultReviewStats(),
    viewerReviewMeta: buildDefaultViewerReviewMeta(),
    reviewFilterKey: 'all',
    reviewSortBy: 'latest',
    reviewFilterOptions: buildReviewFilterOptions(buildDefaultReviewStats(), 'all'),
    reviewSortOptions: buildReviewSortOptions('latest'),
    reviewList: [],
    reviewCursor: '',
    reviewHasMore: false,
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
    deleteDialogVisible: false,
    deleteTargetId: '',
    deleteTargetType: '',
    deleteTargetReplyCount: 0,
    deleteSubmitting: false,
    starOptions: STAR_OPTIONS,
  },

  async onLoad(query = {}) {
    const themeId = String(query.id || '').trim();
    const pendingReviewSessionId = String(query.pendingSessionId || '').trim();
    const shouldAutoReview =
      String(query.autoReview || '').trim() === '1' || Boolean(pendingReviewSessionId);

    this.setData({
      themeId,
      pendingReviewSessionId,
    });

    await this.loadPage({ force: true });

    if (shouldAutoReview && !this.data.errorText) {
      await this.openReviewComposer({
        sessionId: pendingReviewSessionId,
        forceFromPending: true,
      });
    }
  },

  async loadPage(options = {}) {
    const themeId = String(this.data.themeId || '').trim();
    if (!themeId) {
      this.setData({
        errorText: '主题信息不完整，请返回重试',
      });
      return false;
    }

    this.setData({
      errorText: '',
      reviewErrorText: '',
    });

    try {
      const theme = await service.getThemeDetail(themeId);
      if (!theme) {
        this.setData({
          theme: null,
          errorText: '这个主题暂时无法查看，请稍后再试',
        });
        return false;
      }

      const result = await service.getThemeReviews(themeId, {
        sortBy: this.data.reviewSortBy,
        filterKey: this.data.reviewFilterKey,
        cursor: '',
        pageSize: 10,
      });
      const reviewStats = themeService.normalizeReviewStats(result.reviewStats || theme.reviewStats || {});

      this.setData({
        theme,
        reviewStats,
        viewerReviewMeta: normalizeViewerReviewMeta(result.viewerReviewMeta),
        reviewFilterOptions: buildReviewFilterOptions(reviewStats, this.data.reviewFilterKey),
        reviewSortOptions: buildReviewSortOptions(this.data.reviewSortBy),
        reviewList: (result.reviews || []).map(normalizeReviewItem),
        reviewCursor: String(result.nextCursor || '').trim(),
        reviewHasMore: Boolean(result.hasMore),
      });
      return true;
    } catch (error) {
      this.setData({
        errorText: '评价加载失败，请稍后再试',
      });
      return false;
    } finally {
      this.setData({
        reviewLoading: false,
        reviewLoadingMore: false,
      });
    }
  },

  async reloadReviewSummary() {
    const theme = await service.getThemeDetail(this.data.themeId);
    if (!theme) {
      return;
    }
    const reviewStats = themeService.normalizeReviewStats(theme.reviewStats || {});
    this.setData({
      theme,
      reviewStats,
      reviewFilterOptions: buildReviewFilterOptions(reviewStats, this.data.reviewFilterKey),
    });
  },

  async loadReviews(options = {}) {
    const { reset = false, silent = false } = options;
    const themeId = String(this.data.themeId || '').trim();
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
      const nextList = (reset ? [] : this.data.reviewList).concat(
        (result.reviews || []).map(normalizeReviewItem)
      );

      this.setData({
        reviewStats: nextStats,
        viewerReviewMeta: normalizeViewerReviewMeta(result.viewerReviewMeta),
        reviewFilterOptions: buildReviewFilterOptions(nextStats, this.data.reviewFilterKey),
        reviewSortOptions: buildReviewSortOptions(this.data.reviewSortBy),
        reviewList: nextList,
        reviewCursor: String(result.nextCursor || '').trim(),
        reviewHasMore: Boolean(result.hasMore),
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
    const forceFromPending = Boolean(options.forceFromPending);
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

    const preferredSessionId = String(options.sessionId || '').trim();
    const firstSession = Array.isArray(viewerReviewMeta.eligibleSessions)
      ? viewerReviewMeta.eligibleSessions[0]
      : null;
    const matchedSession =
      (Array.isArray(viewerReviewMeta.eligibleSessions)
        ? viewerReviewMeta.eligibleSessions.find(
            (item) => String(item.sessionId || '').trim() === preferredSessionId
          )
        : null) || firstSession;

    this.setData({
      reviewComposerVisible: true,
      reviewComposerMode: 'review',
      reviewDraftContent: '',
      reviewDraftRating: 5,
      reviewDraftSessionId:
        String((matchedSession && matchedSession.sessionId) || preferredSessionId || '').trim(),
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

  openDeleteDialog(event) {
    const { id, type, replyCount } = event.currentTarget.dataset;
    const reviewId = String(id || '').trim();
    if (!reviewId) {
      return;
    }
    this.setData({
      deleteDialogVisible: true,
      deleteTargetId: reviewId,
      deleteTargetType: String(type || '').trim() === 'reply' ? 'reply' : 'review',
      deleteTargetReplyCount: Math.max(0, Number(replyCount || 0)),
    });
  },

  closeDeleteDialog() {
    if (this.data.deleteSubmitting) {
      return;
    }
    this.setData({
      deleteDialogVisible: false,
      deleteTargetId: '',
      deleteTargetType: '',
      deleteTargetReplyCount: 0,
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
      const result =
        mode === 'reply'
          ? await service.createThemeReviewReply({
              reviewId: this.data.reviewTargetReviewId,
              content,
            })
          : await service.createThemeReview({
              themeId: this.data.themeId,
              sessionId: this.data.reviewDraftSessionId,
              content,
              rating: this.data.reviewDraftRating,
            });

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
      await this.loadReviews({ reset: true, silent: true });
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

  async confirmDeleteReview() {
    const reviewId = String(this.data.deleteTargetId || '').trim();
    if (!reviewId || this.data.deleteSubmitting) {
      return;
    }

    this.setData({
      deleteSubmitting: true,
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
        deleteDialogVisible: false,
        deleteTargetId: '',
        deleteTargetType: '',
        deleteTargetReplyCount: 0,
      });
      await this.reloadReviewSummary();
      await this.loadReviews({ reset: true, silent: true });
    } catch (error) {
      wx.showToast({
        title: '删除失败',
        icon: 'none',
      });
    } finally {
      this.setData({
        deleteSubmitting: false,
      });
    }
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

    try {
      const result = await service.listThemeReviewReplies(rootReviewId, {
        cursor,
        pageSize: 10,
      });
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
    } catch (error) {
      wx.showToast({
        title: '回复加载失败',
        icon: 'none',
      });
    }
  },

  toggleReviewReplies(event) {
    const reviewId = String(event.currentTarget.dataset.id || '').trim();
    if (!reviewId) {
      return;
    }
    const nextReviewList = this.data.reviewList.map((review) =>
      String(review.id || '') === reviewId
        ? {
            ...review,
            repliesExpanded: !review.repliesExpanded,
          }
        : review
    );
    this.setData({
      reviewList: nextReviewList,
    });
  },

  openThemeDetail() {
    wx.navigateTo({
      url: `/pages/theme-detail/index?id=${this.data.themeId}`,
    });
  },

  retryLoad() {
    this.loadPage({ force: true });
  },

  noop() {},
});
