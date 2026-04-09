'use strict';

function normalizeRoom(room) {
  if (!room) {
    return null;
  }

  const viewerIsCreator =
    Boolean(room.creatorOpenId) && String(room.creatorOpenId || '') === String(room.myOpenId || '');

  return {
    ...room,
    memberSummary: `${room.memberCount}/${room.expectedPeople} 人`,
    timeline: Array.isArray(room.timeline) ? room.timeline : [],
    highlights: Array.isArray(room.highlights) ? room.highlights : [],
    members: (room.members || []).map((item) => ({
      ...item,
      memberKey: item.openId || item.nickname,
      avatarUrl: (item.playerCard && item.playerCard.avatarUrl) || '',
      isCreator: Boolean(room.creatorOpenId) && String(item.openId || '') === String(room.creatorOpenId || ''),
      isSelf: Boolean(room.myOpenId) && String(item.openId || '') === String(room.myOpenId || ''),
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
      reputationScore: Number(item.reputationScore !== undefined ? item.reputationScore : 100),
      reputationWarning:
        viewerIsCreator &&
        !(
          Boolean(room.myOpenId) && String(item.openId || '') === String(room.myOpenId || '')
        ) &&
        Number(item.reputationScore !== undefined ? item.reputationScore : 100) < 80,
      reputationBadgeText:
        Number(item.reputationScore !== undefined ? item.reputationScore : 100) < 20
          ? '功能冻结'
          : Number(item.reputationScore !== undefined ? item.reputationScore : 100) < 40
            ? '需审批'
            : Number(item.reputationScore !== undefined ? item.reputationScore : 100) < 60
              ? '限制创建'
              : Number(item.reputationScore !== undefined ? item.reputationScore : 100) < 80
                ? '信誉警示'
                : '',
      memberRiskText:
        viewerIsCreator &&
        !(
          Boolean(room.myOpenId) && String(item.openId || '') === String(room.myOpenId || '')
        ) &&
        Number(item.reputationScore !== undefined ? item.reputationScore : 100) < 80
          ? `当前信誉 ${Number(item.reputationScore !== undefined ? item.reputationScore : 100)} 分，组队前建议确认对方履约情况`
          : '',
    })),
    timelineCount: Array.isArray(room.timeline) ? room.timeline.length : 0,
    highlightCount: Array.isArray(room.highlights) ? room.highlights.length : 0,
    resultGrowthText: room.result ? `+${room.result.growthValue}` : '',
    resultArchiveText: room.result
      ? Number(room.result.archiveDelta || 0) > 0
        ? `+${room.result.archiveDelta}`
        : '无变化'
      : '',
    canShowResult: Boolean(room.result),
    canShowHighlights: Array.isArray(room.highlights) && room.highlights.length > 0,
  };
}

module.exports = {
  normalizeRoom,
};
