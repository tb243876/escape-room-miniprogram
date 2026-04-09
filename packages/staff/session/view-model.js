'use strict';

const profileService = require('../../../utils/domain/profile');
const CHECKED_IN_STATUSES = ['已到店', '已确认', '游戏中', '已结算'];

function normalizeSession(session = {}) {
  const currentProfile = profileService.getLocalProfile();
  return {
    ...session,
    stageTips: ['确认成员', '开始场次', '结束场次', '自动结算', '上传集锦'].map((item) => ({
      text: item,
      active: item === session.stageLabel,
    })),
    members: (session.members || []).map((item) => {
      const playerCard =
        item.playerCard ||
        profileService.buildPlayerCardByIdentity(
          {
            openId: item.openId || '',
            nickname: item.nickname || '',
          },
          {
            currentProfile,
          }
        );
      return {
        ...item,
        avatarUrl: (playerCard && playerCard.avatarUrl) || '',
        avatarText:
          (playerCard && playerCard.avatarText) || String(item.nickname || '玩').slice(0, 1),
        canToggle: session.stageKey === 'pending_confirm',
        checkedIn: CHECKED_IN_STATUSES.includes(item.status),
        toggleText: CHECKED_IN_STATUSES.includes(item.status) ? '已到店' : '确认到店',
        toggleClass: CHECKED_IN_STATUSES.includes(item.status)
          ? 'staff-session-member-toggle staff-session-member-toggle-on'
          : 'staff-session-member-toggle',
      };
    }),
    confirmProgressText:
      session.stageKey === 'pending_confirm'
        ? `${session.checkedInCount || 0}/${session.totalMemberCount || 0} 人已核对到店`
        : '',
    actions: (session.actions || []).map((item) => {
      const isPrimary = item.tone === 'primary';
      const enabled = Boolean(item.enabled);
      return {
        ...item,
        buttonClass:
          item.buttonClass ||
          (enabled
            ? isPrimary
              ? 'button-primary'
              : 'button-secondary'
            : `${isPrimary ? 'button-primary' : 'button-secondary'} button-disabled`),
      };
    }),
  };
}

module.exports = {
  normalizeSession,
};
