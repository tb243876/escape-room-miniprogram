'use strict';

const service = require('../../utils/cloudbase');
const viewModel = require('./view-model');

Page({
  refreshTimer: null,

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
  },

  async onLoad(query = {}) {
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

  async onShow() {
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
        this.setData({
          room: null,
          errorText: '没有找到这支队伍，请返回大厅重新选择',
          hasLoaded: false,
          groupId: currentGroupId,
        });
        return;
      }
      this.setData({
        room: viewModel.normalizeRoom(room),
        hasLoaded: true,
        groupId: currentGroupId,
      });
    } catch (error) {
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
      dialogContent: '这里后续可以接门店电话、客服或企业微信。',
      selectedMember: null,
    });
  },

  openMemberCard(event) {
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
      selectedMember: selectedMember.playerCard,
    });
  },

  goLobby() {
    wx.switchTab({
      url: '/pages/lobby/index',
    });
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
    }, 3000);
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
