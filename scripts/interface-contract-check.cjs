'use strict';

const assert = require('assert');
const { setupMockMiniappEnv } = require('./test-helpers/mock-miniapp-env.cjs');

setupMockMiniappEnv();

const service = require('../utils/cloudbase');

function assertKeys(target, keys, label) {
  keys.forEach((key) => {
    assert.equal(
      Object.prototype.hasOwnProperty.call(target, key),
      true,
      `${label} 缺少字段 ${key}`
    );
  });
}

async function main() {
  service.clearLocalUserData();

  const homeData = await service.getHomeData();
  assertKeys(homeData, ['hero', 'banners', 'themeGroups', 'activities', 'quickActions'], 'getHomeData');

  const themes = await service.getThemes();
  assert.equal(Array.isArray(themes), true);
  assertKeys(themes[0], ['id', 'name', 'horror', 'horrorStars'], 'getThemes[0]');

  const themeDetail = await service.getThemeDetail(themes[0].id);
  assertKeys(themeDetail, ['id', 'name', 'story', 'highlights'], 'getThemeDetail');

  const activities = await service.getActivities();
  assert.equal(Array.isArray(activities), true);
  assertKeys(activities[0], ['id', 'title', 'status', 'summary'], 'getActivities[0]');

  const profile = await service.getProfile();
  assertKeys(
    profile,
    ['nickname', 'level', 'totalPlayCount', 'badgeCatalog', 'signature', 'genderText', 'titleLabel'],
    'getProfile'
  );

  const updateProfileResponse = await service.updateProfile({
    nickname: '契约测试员',
    signature: '接口契约正在验证',
    gender: 'male',
  });
  assertKeys(updateProfileResponse, ['ok', 'message', 'profile'], 'updateProfile');

  const lobbyList = await service.getLobbyList();
  assert.equal(Array.isArray(lobbyList), true);
  assertKeys(
    lobbyList[0],
    ['id', 'themeName', 'rawStatus', 'currentPeople', 'targetPeople'],
    'getLobbyList[0]'
  );

  const createResponse = await service.createGroup({
    themeId: 'theme-shixiong',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 2,
    targetPeople: 4,
    contactName: '阿杰',
    contactPhone: '13800138000',
  });
  assertKeys(createResponse, ['ok', 'message', 'group', 'groups'], 'createGroup');

  const teamRoom = await service.getTeamRoom(createResponse.group.id);
  assertKeys(teamRoom, ['groupId', 'themeName', 'stage', 'members'], 'getTeamRoom');
  assertKeys(teamRoom.members[0], ['nickname', 'status', 'playerCard'], 'getTeamRoom.members[0]');

  const redeemResponse = await service.redeemStaffAuthCode('OWNER2026');
  assertKeys(redeemResponse, ['ok', 'binding'], 'redeemStaffAuthCode');

  const dashboard = await service.getStaffDashboard();
  assert.equal(dashboard.ok, true);
  assertKeys(
    dashboard.dashboard,
    ['role', 'roleLabel', 'stats', 'sessions'],
    'getStaffDashboard.dashboard'
  );

  const session = await service.getStaffSession(dashboard.dashboard.sessions[0].id);
  assert.equal(session.ok, true);
  assertKeys(session.session, ['id', 'themeName', 'stageKey', 'actions'], 'getStaffSession.session');

  const highlights = await service.getStaffHighlights();
  assert.equal(highlights.ok, true);
  assert.equal(Array.isArray(highlights.highlights), true);

  const leaderboard = await service.getLeaderboard();
  assert.equal(leaderboard.ok, true);
  assertKeys(leaderboard, ['leaderboard', 'summary'], 'getLeaderboard');

  console.log('接口契约自动化校验通过');
}

main().catch((error) => {
  console.error('接口契约自动化校验失败');
  console.error(error);
  process.exit(1);
});
