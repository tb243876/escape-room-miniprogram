'use strict';

function normalizeDashboard(dashboard = {}) {
  const permissions = Array.isArray(dashboard.permissions) ? dashboard.permissions : [];
  const authCodeList = Array.isArray(dashboard.authCodeList)
    ? dashboard.authCodeList.map((item) => ({
        ...item,
        statusText:
          item.status === 'active'
            ? '可使用'
            : item.status === 'used'
              ? '已使用'
              : item.status === 'disabled'
                ? '已失效'
                : item.status || '',
        statusClass:
          item.status === 'active'
            ? 'status-ok'
            : item.status === 'used'
              ? 'status-pending'
              : 'status-disabled',
      }))
    : [];
  return {
    ...dashboard,
    permissions,
    sessions: Array.isArray(dashboard.sessions) ? dashboard.sessions : [],
    memberStats: dashboard.memberStats || {
      totalUsers: 0,
      activeUsers30d: 0,
      completedSessions30d: 0,
      newUsers7d: 0,
    },
    memberInsights: Array.isArray(dashboard.memberInsights) ? dashboard.memberInsights : [],
    memberList: Array.isArray(dashboard.memberList) ? dashboard.memberList : [],
    memberPanels: dashboard.memberPanels || {
      totalUsers: { key: 'totalUsers', title: '累计用户', subtitle: '', type: 'members', items: [] },
      activeUsers30d: { key: 'activeUsers30d', title: '近30天活跃用户', subtitle: '', type: 'members', items: [] },
      completedSessions30d: { key: 'completedSessions30d', title: '近30天完成场次', subtitle: '', type: 'sessions', items: [] },
      newUsers7d: { key: 'newUsers7d', title: '本周新增用户', subtitle: '', type: 'members', items: [] },
    },
    authCodeSummary: dashboard.authCodeSummary || {
      availableCodes: 0,
      activeStaff: 0,
      latestCode: '',
    },
    authCodeActions: Array.isArray(dashboard.authCodeActions) ? dashboard.authCodeActions : [],
    authCodeList,
    staffMembers: Array.isArray(dashboard.staffMembers) ? dashboard.staffMembers : [],
    managerTransfer: dashboard.managerTransfer || {
      currentManager: '',
      candidates: [],
      candidateList: [],
    },
    canViewMemberStats: permissions.includes('view_statistics'),
    canViewAnalytics: permissions.includes('view_statistics'),
    canManageAuthCodes: permissions.includes('manage_auth_codes'),
    canTransferManager: permissions.includes('transfer_manager'),
    permissionsText: permissions.length ? `当前权限 ${permissions.length} 项` : '当前暂无特殊权限',
    dashboardHighlights: [
      {
        label: '待确认',
        value: Number((dashboard.stats && dashboard.stats.pendingConfirm) || 0),
      },
      {
        label: '待开场',
        value: Number((dashboard.stats && dashboard.stats.readyToStart) || 0),
      },
      {
        label: '在岗员工',
        value: Number(
          (dashboard.authCodeSummary && dashboard.authCodeSummary.activeStaff) || 0
        ),
      },
    ],
  };
}

module.exports = {
  normalizeDashboard,
};
