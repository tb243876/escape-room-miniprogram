'use strict';

const avatarService = require('../../utils/platform/avatar');
const service = require('../../utils/cloudbase');
const time = require('../../utils/platform/time');
const viewModel = require('./view-model');

function buildRoomSignature(room = null) {
  if (!room) {
    return '';
  }
  const members = Array.isArray(room.members)
    ? room.members
        .map((item) => [
          item.openId || '',
          item.nickname || '',
          item.status || '',
          (item.playerCard && item.playerCard.avatarUrl) || '',
          (item.playerCard && item.playerCard.reputationScore) || '',
        ].join('|'))
        .join('||')
    : '';
  const timeline = Array.isArray(room.timeline)
    ? room.timeline
        .map((item) => [item.title || '', item.content || ''].join('|'))
        .join('||')
    : '';
  const highlights = Array.isArray(room.highlights)
    ? room.highlights
        .map((item) => [
          item.id || '',
          item.type || '',
          item.title || '',
          item.fileId || item.fileID || '',
          item.previewUrl || '',
        ].join('|'))
        .join('||')
    : '';
  const result = room.result
    ? [
        room.result.growthValue || 0,
        room.result.archiveDelta || 0,
        room.result.badgeText || '',
      ].join('|')
    : '';

  return [
    room.roomId || '',
    room.groupId || '',
    room.themeId || '',
    room.themeName || '',
    room.playDate || '',
    room.timeSlot || '',
    room.stage || '',
    room.stageLabel || '',
    room.stageHint || '',
    room.teamSize || 0,
    room.memberCount || 0,
    room.expectedPeople || 0,
    room.coverImage || '',
    members,
    timeline,
    highlights,
    result,
  ].join('###');
}

Page({
  refreshTimer: null,
  lastRoomSignature: '',

  data: {
    room: null,
    errorText: '',
    isLoading: false,
    dialogVisible: false,
    dialogTitle: '',
    dialogContent: '',
    selectedMember: null,
    hasLoaded: false,
    groupId: '',
    lastSyncText: '',
  },

  async onLoad(query = {}) {
    this.__skipNextOnShowRefresh = true;
    try {
      await this.loadRoom(query.groupId || '', { force: true });
      this.startAutoRefresh();
    } catch (error) {
      this.setData({
        room: null,
        errorText: '队伍房间初始化失败，请重新进入页面',
      });
    }
  },

  getHighlightById(highlightId) {
    const room = this.data.room;
    if (!room || !Array.isArray(room.highlights)) {
      return null;
    }
    return (
      room.highlights.find((item) => String(item.id || '') === String(highlightId || '')) || null
    );
  },

  async onShow() {
    if (this.__skipNextOnShowRefresh) {
      this.__skipNextOnShowRefresh = false;
      this.startAutoRefresh();
      return;
    }
    if (this.data.groupId) {
      await this.loadRoom(this.data.groupId, { force: true });
    }
    this.startAutoRefresh();
  },

  onHide() {
    this.stopAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  async onPullDownRefresh() {
    try {
      await this.loadRoom(this.data.groupId, { force: true });
    } finally {
      if (typeof wx.stopPullDownRefresh === 'function') {
        wx.stopPullDownRefresh();
      }
    }
  },

  async loadRoom(groupId, options = {}) {
    const currentGroupId = groupId || this.data.groupId;
    const { force = false } = options;
    if (!currentGroupId) {
      this.setData({
        room: null,
        errorText: '队伍信息缺失，请返回重试',
      });
      return;
    }
    if (this.data.hasLoaded && !force && this.data.groupId === currentGroupId) {
      return;
    }
    this.setData({
      isLoading: true,
      errorText: '',
    });
    try {
      const room = await service.getTeamRoom(currentGroupId);
      if (!room) {
        this.lastRoomSignature = '';
        this.setData({
          room: null,
          errorText: '没有找到这支队伍，请返回大厅重新选择',
          hasLoaded: false,
          groupId: currentGroupId,
        });
        return;
      }
      const roomSignature = buildRoomSignature(room);
      const roomChanged = roomSignature !== this.lastRoomSignature;
      if (roomChanged || !this.data.hasLoaded) {
        const normalizedRoom = viewModel.normalizeRoom(room);
        this.lastRoomSignature = roomSignature;
        this.setData({
          room: normalizedRoom,
          hasLoaded: true,
          groupId: currentGroupId,
          lastSyncText: time.formatSyncTime(),
        });
      } else {
        this.lastRoomSignature = roomSignature;
        this.setData({
          groupId: currentGroupId,
          lastSyncText: time.formatSyncTime(),
        });
      }
    } catch (error) {
      this.lastRoomSignature = '';
      this.setData({
        room: null,
        errorText: '队伍房间加载失败，请检查网络后重试',
        hasLoaded: false,
        groupId: currentGroupId,
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  contactStore() {
    this.setData({
      dialogVisible: true,
      dialogTitle: '联系门店',
      dialogContent: '如需预约或有疑问，请扫码添加门店企微或电话联系',
      selectedMember: null,
    });
  },

  async openMemberCard(event) {
    const { nickname, openid } = event.currentTarget.dataset;
    const room = this.data.room;
    if (!room || !Array.isArray(room.members)) {
      return;
    }

    const selectedMember = room.members.find((item) =>
      openid
        ? String(item.openId || '') === String(openid || '')
        : String(item.nickname || '') === String(nickname || '')
    );
    if (!selectedMember || !selectedMember.playerCard) {
      return;
    }

    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
      selectedMember: await avatarService.refreshAvatarUrlsDeep(selectedMember.playerCard),
    });
  },

  goLobby() {
    wx.switchTab({
      url: '/pages/lobby/index',
    });
  },

  previewHighlight(event) {
    const highlightId = String(
      (event.currentTarget.dataset && event.currentTarget.dataset.id) || ''
    );
    const targetHighlight = this.getHighlightById(highlightId);
    if (!targetHighlight || !targetHighlight.previewUrl) {
      return;
    }

    const room = this.data.room;
    const mediaList = (room && room.highlights ? room.highlights : []).filter(
      (item) => item.previewUrl
    );
    const currentIndex = mediaList.findIndex((item) => String(item.id || '') === highlightId);
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

    if (targetHighlight.type !== 'video') {
      wx.previewImage({
        current: targetHighlight.previewUrl,
        urls: mediaList.filter((item) => item.type !== 'video').map((item) => item.previewUrl),
      });
    }
  },

  retryLoad() {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    const options = (current && current.options) || {};
    this.loadRoom(options.groupId || '', { force: true });
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      const currentRoom = this.data.room;
      if (
        !this.data.groupId ||
        !currentRoom ||
        currentRoom.stage === 'settled' ||
        currentRoom.stage === 'archived' ||
        this.data.isLoading
      ) {
        return;
      }
      wx.getNetworkType({
        success: (res) => {
          if (res.networkType === 'none') {
            return;
          }
          this.loadRoom(this.data.groupId, { force: true });
        },
      });
    }, 10000);
  },

  stopAutoRefresh() {
    if (!this.refreshTimer) {
      return;
    }
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  },

  closeDialog() {
    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
      selectedMember: null,
    });
  },

  noop() {},
});
