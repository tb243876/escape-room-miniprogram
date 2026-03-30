'use strict';

function normalizeRoom(room) {
  if (!room) {
    return null;
  }

  return {
    ...room,
    memberSummary: `${room.memberCount}/${room.expectedPeople} 人`,
    members: (room.members || []).map((item) => ({
      ...item,
      memberKey: item.openId || item.nickname,
      avatarUrl: (item.playerCard && item.playerCard.avatarUrl) || '',
      isCreator:
        Boolean(room.creatorName) && String(item.nickname || '') === String(room.creatorName || ''),
      isSelf:
        Boolean(room.myContactName) && String(item.nickname || '') === String(room.myContactName || ''),
      avatarText: (item.playerCard && item.playerCard.avatarText) || String(item.nickname || '玩').slice(0, 1),
      summaryText:
        (item.playerCard && item.playerCard.summaryText) || `状态：${item.status || '待确认'}`,
      memberClass:
        item.status === '游戏中'
          ? 'member-item member-item-live'
          : item.status === '已结算'
            ? 'member-item member-item-settled'
            : item.status === '已确认' || item.status === '已到店'
              ? 'member-item member-item-confirmed'
              : 'member-item member-item-pending',
      statusClass:
        item.status === '游戏中'
          ? 'member-status member-status-live'
          : item.status === '已结算'
            ? 'member-status member-status-settled'
            : item.status === '已确认' || item.status === '已到店'
              ? 'member-status member-status-confirmed'
              : 'member-status member-status-pending',
    })),
    resultGrowthText: room.result ? `+${room.result.growthValue}` : '',
    resultArchiveText: room.result ? `+${room.result.archiveDelta}` : '',
    canShowResult: Boolean(room.result),
    canShowHighlights: Array.isArray(room.highlights) && room.highlights.length > 0,
  };
}

module.exports = {
  normalizeRoom,
};
