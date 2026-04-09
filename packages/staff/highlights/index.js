'use strict';

const service = require('../../../utils/cloudbase');

function chooseMedia(options = {}) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: options.count || 9,
      mediaType: options.mediaType || ['image', 'video'],
      sourceType: options.sourceType || ['album', 'camera'],
      maxDuration: options.maxDuration || 60,
      success: resolve,
      fail: reject,
    });
  });
}

Page({
  isFetching: false,

  data: {
    highlights: [],
    errorText: '',
    isLoading: false,
    uploadingHighlightId: '',
    dialogVisible: false,
    dialogTitle: '',
    dialogContent: '',
    pendingRemoveAction: null,
  },

  async onLoad() {
    await this.loadHighlights();
  },

  async onShow() {
    await this.loadHighlights();
  },

  getHighlightById(highlightId) {
    return (this.data.highlights || []).find(
      (item) => String(item.id || item._id || '') === String(highlightId || '')
    );
  },

  async loadHighlights() {
    if (this.isFetching) {
      return;
    }
    this.isFetching = true;
    this.setData({
      errorText: '',
      isLoading: true,
    });
    try {
      const response = await service.getStaffHighlights();
      if (!response.ok) {
        this.setData({
          highlights: [],
          errorText: response.message || '集锦库加载失败，请稍后重试',
        });
        return;
      }

      this.setData({
        highlights: response.highlights || [],
      });
    } catch (error) {
      console.error('loadHighlights failed:', error);
      this.setData({
        highlights: [],
        errorText: '集锦库加载失败，请检查网络后重试',
      });
    } finally {
      this.isFetching = false;
      if (this.data.isLoading) {
        this.setData({ isLoading: false });
      }
    }
  },

  retryLoad() {
    this.loadHighlights();
  },

  async uploadMedia(event) {
    const highlightId = String(
      (event.currentTarget.dataset && event.currentTarget.dataset.id) || ''
    );
    const highlight = this.getHighlightById(highlightId);
    if (!highlight || this.data.uploadingHighlightId) {
      return;
    }

    const remainingCount = Math.max(0, 9 - Number((highlight.media || []).length));
    if (!remainingCount) {
      wx.showToast({
        title: '单场最多保留 9 个内容',
        icon: 'none',
      });
      return;
    }

    try {
      const selected = await chooseMedia({
        count: remainingCount,
      });
      const files = Array.isArray(selected.tempFiles) ? selected.tempFiles : [];
      if (!files.length) {
        return;
      }

      this.setData({
        uploadingHighlightId: highlightId,
      });
      wx.showLoading({
        title: '上传中...',
        mask: true,
      });
      const result = await service.appendStaffHighlightMedia(
        highlightId,
        files,
        highlight.media || []
      );
      wx.hideLoading();
      this.setData({
        uploadingHighlightId: '',
      });
      if (!result.ok) {
        wx.showToast({
          title: result.message || '上传失败',
          icon: 'none',
        });
        return;
      }

      wx.showToast({
        title: result.message || '上传完成',
        icon: 'success',
      });
      await this.loadHighlights();
    } catch (error) {
      wx.hideLoading();
      this.setData({
        uploadingHighlightId: '',
      });
      if (error && /cancel/i.test(String(error.errMsg || error.message || ''))) {
        return;
      }
      console.error('uploadMedia failed:', error);
      wx.showToast({
        title: '上传失败，请稍后重试',
        icon: 'none',
      });
    }
  },

  promptRemoveMedia(event) {
    const highlightId = String(
      (event.currentTarget.dataset && event.currentTarget.dataset.highlightId) || ''
    );
    const mediaId = String(
      (event.currentTarget.dataset && event.currentTarget.dataset.mediaId) || ''
    );
    const highlight = this.getHighlightById(highlightId);
    if (!highlight || !mediaId || this.data.uploadingHighlightId) {
      return;
    }

    this.setData({
      dialogVisible: true,
      dialogTitle: '删除集锦内容',
      dialogContent: '移除后该内容会从本场集锦中隐藏，其他用户也将看不到，是否继续？',
      pendingRemoveAction: {
        highlightId,
        mediaId,
      },
    });
  },

  async confirmDialogAction() {
    const pendingRemoveAction = this.data.pendingRemoveAction;
    this.closeDialog();
    if (!pendingRemoveAction) {
      return;
    }

    const highlight = this.getHighlightById(pendingRemoveAction.highlightId);
    if (!highlight) {
      return;
    }

    const nextMedia = (highlight.media || []).filter(
      (item) => String(item.id || '') !== String(pendingRemoveAction.mediaId || '')
    );

    try {
      this.setData({
        uploadingHighlightId: pendingRemoveAction.highlightId,
      });
      wx.showLoading({
        title: '保存中...',
        mask: true,
      });
      const result = await service.saveStaffHighlights(pendingRemoveAction.highlightId, nextMedia);
      wx.hideLoading();
      this.setData({
        uploadingHighlightId: '',
      });
      if (!result.ok) {
        wx.showToast({
          title: result.message || '保存失败',
          icon: 'none',
        });
        return;
      }

      wx.showToast({
        title: '已移除',
        icon: 'success',
      });
      await this.loadHighlights();
    } catch (error) {
      wx.hideLoading();
      this.setData({
        uploadingHighlightId: '',
      });
      console.error('removeMedia failed:', error);
      wx.showToast({
        title: '保存失败，请稍后重试',
        icon: 'none',
      });
    }
  },

  previewMedia(event) {
    const highlightId = String(
      (event.currentTarget.dataset && event.currentTarget.dataset.highlightId) || ''
    );
    const mediaId = String(
      (event.currentTarget.dataset && event.currentTarget.dataset.mediaId) || ''
    );
    const highlight = this.getHighlightById(highlightId);
    if (!highlight) {
      return;
    }

    const mediaList = (highlight.media || []).filter((item) => item.previewUrl);
    const currentIndex = mediaList.findIndex(
      (item) => String(item.id || '') === String(mediaId || '')
    );
    if (currentIndex === -1) {
      return;
    }

    if (typeof wx.previewMedia === 'function') {
      wx.previewMedia({
        current: currentIndex,
        sources: mediaList.map((item) => ({
          url: item.previewUrl,
          type: item.type === 'video' ? 'video' : 'image',
          poster: item.type === 'video' ? item.previewUrl : '',
        })),
      });
      return;
    }

    const current = mediaList[currentIndex];
    if (current.type !== 'video') {
      wx.previewImage({
        current: current.previewUrl,
        urls: mediaList.filter((item) => item.type !== 'video').map((item) => item.previewUrl),
      });
    }
  },

  closeDialog() {
    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
      pendingRemoveAction: null,
    });
  },

  noop() {},
});
