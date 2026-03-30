'use strict';

const leaderboardService = require('../../utils/domain/leaderboard');

function normalizePageData(response = {}) {
  return {
    summary: response.summary || {
      totalPlayers: 0,
      totalGrowth: 0,
      totalBadges: 0,
    },
    leaderboard: leaderboardService.normalizeLeaderboardList(response.leaderboard || []),
  };
}

module.exports = {
  normalizePageData,
};
