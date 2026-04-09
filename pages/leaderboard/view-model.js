'use strict';

const leaderboardService = require('../../utils/domain/leaderboard');

function buildSummaryCards(summary = {}) {
  const period = String(summary.period || 'total').trim() === 'month' ? 'month' : 'total';
  return [
    {
      key: 'players',
      value: Number(summary.totalPlayers || 0),
      label: '上榜玩家',
    },
    {
      key: 'growth',
      value: Number(summary.totalGrowth || 0),
      label: '总成长值',
    },
    period === 'month'
      ? {
          key: 'played',
          value: Number(summary.totalPlayed || 0),
          label: '近30天场次',
        }
      : {
          key: 'badges',
          value: Number(summary.totalBadges || 0),
          label: '总徽章数',
        },
  ];
}

function normalizePageData(response = {}) {
  const summary = response.summary || {
    totalPlayers: 0,
    totalGrowth: 0,
    totalBadges: 0,
    totalPlayed: 0,
    period: 'total',
  };
  return {
    summary,
    summaryCards: buildSummaryCards(summary),
    leaderboard: leaderboardService.normalizeLeaderboardList(response.leaderboard || []),
  };
}

module.exports = {
  buildSummaryCards,
  normalizePageData,
};
