'use strict';

function getStatusMeta(rawStatus) {
  const map = {
    recruiting: {
      text: '招募中',
      pillClass: 'status-pill-recruiting',
    },
    full: {
      text: '已满员',
      pillClass: 'status-pill-full',
    },
    pending_store_confirm: {
      text: '待门店确认',
      pillClass: 'status-pill-pending',
    },
    confirmed: {
      text: '确认成功',
      pillClass: 'status-pill-confirmed',
    },
    playing: {
      text: '游戏中',
      pillClass: 'status-pill-confirmed',
    },
    settled: {
      text: '已结算',
      pillClass: 'status-pill-confirmed',
    },
    cancelled: {
      text: '已取消',
      pillClass: 'status-pill-cancelled',
    },
  };

  return (
    map[rawStatus] || {
      text: rawStatus || '招募中',
      pillClass: 'status-pill-default',
    }
  );
}

function buildPrimaryTabs(activePage) {
  return [
    {
      key: 'lobby',
      text: '大厅',
      active: activePage === 'lobby',
    },
    {
      key: 'mine',
      text: '我的',
      active: activePage === 'mine',
    },
  ];
}

function normalizeLobbyList(groups) {
  return (groups || []).map((item) => {
    const neededPeople = Math.max(0, Number(item.neededPeople || 0));
    const canJoin =
      item.rawStatus === 'recruiting' &&
      neededPeople > 0 &&
      !item.isMyActiveGroup &&
      !item.hasOtherActiveGroup;
    const canOpenRoom =
      item.rawStatus === 'pending_store_confirm' ||
      item.rawStatus === 'confirmed' ||
      item.rawStatus === 'playing' ||
      item.rawStatus === 'settled';
    const statusMeta = getStatusMeta(item.rawStatus);
    const memberPreviewList = Array.isArray(item.members) ? item.members.slice(0, 3) : [];
    const hiddenMemberCount = Math.max(
      0,
      Number(item.currentPeople || 0) - memberPreviewList.length
    );

    return {
      ...item,
      metaText: `${item.date} · ${item.timeSlot} · 当前 ${item.currentPeople}/${item.targetPeople} 人`,
      memberPreviewList,
      memberPreviewText: memberPreviewList.join(' · '),
      hiddenMemberText: hiddenMemberCount > 0 ? `等 ${hiddenMemberCount} 人` : '',
      identityTagText: item.myGroupRole || '',
      cardClass: item.participationClass || 'group-card-public',
      riskHint:
        item.rawStatus === 'pending_store_confirm'
          ? '人数已接近成局，仍需门店确认真实到店成员。'
          : item.rawStatus === 'confirmed'
            ? '门店已确认，可进入真实队伍房间查看状态。'
            : item.rawStatus === 'playing'
              ? '场次已经开始，后续状态和结果会在房间里更新。'
              : item.rawStatus === 'settled'
                ? '这场已经结算完成，可进入房间查看结果。'
                : '大厅只表示组队意向，不代表最终一定开场。',
      cancelButtonText:
        item.isMyActiveGroup && item.myGroupRole === '我发起的' ? '取消组局' : '退出组局',
      joinButtonText: item.isMyActiveGroup
        ? '当前已参与'
        : item.hasOtherActiveGroup
          ? '已有其他组局'
          : canJoin
            ? '加入组局'
            : '暂不可加入',
      joinButtonClass: canJoin ? '' : 'button-disabled',
      canJoin,
      roomButtonText: canOpenRoom ? '查看房间' : '看详情',
      roomButtonClass: canOpenRoom ? 'button-primary' : 'button-secondary',
      canOpenRoom,
      canCancel: Boolean(
        item.isMyActiveGroup &&
        ['recruiting', 'pending_store_confirm', 'confirmed'].includes(item.rawStatus)
      ),
      canDelete:
        !item.isMyActiveGroup &&
        (item.rawStatus === 'cancelled' ||
          item.rawStatus === 'settled' ||
          Number(item.sortTime || 0) < Date.now()),
      statusKey: item.rawStatus || 'recruiting',
      statusText: statusMeta.text,
      statusPillClass: statusMeta.pillClass,
    };
  });
}

function buildFilterTabs(groups, activeFilter) {
  return [
    {
      key: 'owner',
      text: '我发起的',
      active: activeFilter === 'owner',
    },
    {
      key: 'member',
      text: '我加入的',
      active: activeFilter === 'member',
    },
  ];
}

function filterByPage(groups, activePage) {
  const list = groups || [];
  if (activePage === 'mine') {
    return list.filter((item) => item.isMyActiveGroup || item.isMyRecentGroup);
  }
  return list.filter(
    (item) => item.rawStatus === 'recruiting' && !item.isMyActiveGroup && !item.isMyRecentGroup
  );
}

function filterByScope(groups, activeFilter) {
  const list = groups || [];
  if (activeFilter === 'owner') {
    return list.filter((item) => item.myGroupRole === '我发起的');
  }
  if (activeFilter === 'member') {
    return list.filter((item) => item.myGroupRole === '我已加入');
  }
  return list;
}

function buildThemeFilters(groups, activeThemeFilter) {
  const list = groups || [];
  const themeMap = new Map();
  list.forEach((item) => {
    const key = String(item.themeName || '').trim();
    if (!key) {
      return;
    }
    themeMap.set(key, (themeMap.get(key) || 0) + 1);
  });

  const filters = [
    {
      key: 'all',
      text: '不限',
      count: list.length,
      active: activeThemeFilter === 'all',
    },
  ];

  Array.from(themeMap.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
    .forEach(([key, count]) => {
      filters.push({
        key,
        text: key,
        count,
        active: activeThemeFilter === key,
      });
    });

  return filters;
}

function getFilterSummary(filters, activeKey, fallbackText) {
  const target = (filters || []).find((item) => item.key === activeKey);
  if (!target) {
    return fallbackText;
  }
  if (activeKey === 'all') {
    return fallbackText;
  }
  return target.text;
}

function filterLobbyList(groups, filters = {}) {
  const list = groups || [];
  const activeThemeFilter = filters.activeThemeFilter || 'all';

  return list.filter((item) => {
    const matchTheme = activeThemeFilter === 'all' || item.themeName === activeThemeFilter;
    return matchTheme;
  });
}

module.exports = {
  buildPrimaryTabs,
  buildThemeFilters,
  getFilterSummary,
  normalizeLobbyList,
  buildFilterTabs,
  filterByPage,
  filterByScope,
  filterLobbyList,
};
