'use strict';

const assert = require('assert');
const { setupMockMiniappEnv } = require('./test-helpers/mock-miniapp-env.cjs');

setupMockMiniappEnv();

const service = require('../utils/cloudbase');

function resetBusinessState() {
  service.clearLocalUserData();
}

async function testContentFlows() {
  const homeData = await service.getHomeData();
  assert.equal(Boolean(homeData.hero && homeData.hero.title), true);
  assert.equal(Array.isArray(homeData.themeGroups), true);
  assert.equal(homeData.themeGroups.length > 0, true);

  const themes = await service.getThemes();
  assert.equal(themes.length > 0, true);
  assert.equal(themes.every((item) => typeof item.horrorStars === 'number'), true);

  const filteredThemes = await service.getThemes({ keyword: '重恐' });
  assert.equal(filteredThemes.length > 0, true);
  assert.equal(filteredThemes.some((item) => item.horror === '重恐'), true);

  const themeDetail = await service.getThemeDetail(themes[0].id);
  assert.equal(Boolean(themeDetail && themeDetail.id), true);

  const activities = await service.getActivities();
  assert.equal(Array.isArray(activities), true);
  assert.equal(activities.length > 0, true);
}

async function testProfileAndLeaderboardFlows() {
  resetBusinessState();

  const profile = await service.getProfile();
  assert.equal(Boolean(profile && profile.nickname), true);
  assert.equal(Array.isArray(profile.badgeCatalog), true);

  const updateResponse = await service.updateProfile({
    nickname: '资料测试员',
    signature: '这是自动化写入的签名。',
    gender: 'female',
  });
  assert.equal(updateResponse.ok, true);
  assert.equal(updateResponse.profile.nickname, '资料测试员');
  assert.equal(updateResponse.profile.genderText, '女');

  const refreshedProfile = await service.getProfile();
  assert.equal(refreshedProfile.nickname, '资料测试员');
  assert.equal(refreshedProfile.signature, '这是自动化写入的签名。');

  const leaderboard = await service.getLeaderboard();
  assert.equal(leaderboard.ok, true);
  assert.equal(Array.isArray(leaderboard.leaderboard), true);
  assert.equal(leaderboard.summary.totalPlayers > 0, true);
}

async function testLobbyAndTeamRoomFlows() {
  resetBusinessState();

  const initialLobby = await service.getLobbyList();
  assert.equal(Array.isArray(initialLobby), true);
  assert.equal(initialLobby.length > 0, true);

  const createResponse = await service.createGroup({
    themeId: 'theme-shixiong',
    themeName: '尸兄',
    dateValue: '2026-03-30',
    timeSlot: '19:30',
    currentPeople: 2,
    targetPeople: 4,
    contactName: '阿杰',
    contactPhone: '13800138000',
    note: '测试自动化创建组局',
  });
  assert.equal(createResponse.ok, true);
  assert.equal(Boolean(createResponse.group && createResponse.group.id), true);

  const conflictingJoin = await service.joinGroup(initialLobby[0].id, {
    contactName: '小林',
    contactPhone: '13800138111',
  });
  assert.equal(conflictingJoin.ok, false);

  const cancelCreated = await service.cancelActiveGroup();
  assert.equal(cancelCreated.ok, true);

  const cancelList = await service.getLobbyList();
  const cancelledGroup = cancelList.find((item) => item.id === createResponse.group.id);
  assert.equal(Boolean(cancelledGroup), true);
  assert.equal(
    cancelledGroup.rawStatus === 'cancelled' || cancelledGroup.status === '异常取消',
    true
  );

  const deleteCancelled = await service.deleteGroupRecord(createResponse.group.id);
  assert.equal(deleteCancelled.ok, true);

  resetBusinessState();
  const lobbyForJoin = await service.getLobbyList();
  const joinableGroup = lobbyForJoin.find(
    (item) =>
      item.rawStatus !== 'confirmed' &&
      item.rawStatus !== 'cancelled' &&
      Number(item.neededPeople || 0) > 0 &&
      !item.isMyActiveGroup &&
      !item.hasOtherActiveGroup
  );
  assert.equal(Boolean(joinableGroup), true);

  const joinResponse = await service.joinGroup(joinableGroup.id, {
    contactName: '小林',
    contactPhone: '13800138111',
  });
  assert.equal(joinResponse.ok, true);
  assert.equal(
    ['recruiting', 'full', 'pending_store_confirm', 'confirmed'].includes(joinResponse.group.rawStatus),
    true
  );

  const joinedLobby = await service.getLobbyList();
  const activeJoinedGroup = joinedLobby.find((item) => item.id === joinableGroup.id);
  assert.equal(Boolean(activeJoinedGroup && activeJoinedGroup.isMyActiveGroup), true);
  assert.equal(Array.isArray(activeJoinedGroup.members), true);
  assert.equal(activeJoinedGroup.members.includes('小林'), true);

  const room = await service.getTeamRoom(joinableGroup.id);
  assert.equal(Boolean(room && room.groupId === joinableGroup.id), true);
  assert.equal(Boolean(room.members[0] && room.members[0].playerCard), true);
  assert.equal(Boolean(room.members[0].playerCard.nickname), true);
  assert.equal(room.members.some((item) => item.nickname === '小林'), true);
  assert.equal(room.myContactName, '小林');

  const exitJoined = await service.cancelActiveGroup();
  assert.equal(exitJoined.ok, true);
}

async function testStaffFlows() {
  resetBusinessState();

  const unauthorizedDashboard = await service.getStaffDashboard();
  assert.equal(unauthorizedDashboard.ok, false);

  const invalidCode = await service.redeemStaffAuthCode('bad-code');
  assert.equal(invalidCode.ok, false);

  const redeemResponse = await service.redeemStaffAuthCode('OWNER2026');
  assert.equal(redeemResponse.ok, true);
  assert.equal(redeemResponse.binding.role, 'store_manager');

  const dashboard = await service.getStaffDashboard();
  assert.equal(dashboard.ok, true);
  assert.equal(Array.isArray(dashboard.dashboard.sessions), true);
  assert.equal(dashboard.dashboard.sessions.length > 0, true);

  const sessionId = dashboard.dashboard.sessions[0].id;
  const session = await service.getStaffSession(sessionId);
  assert.equal(session.ok, true);

  const firstPendingMember = (session.session.members || []).find((item) => item.status === '待确认');
  assert.equal(Boolean(firstPendingMember), true);

  const firstToggle = await service.updateStaffSessionMember(sessionId, firstPendingMember.nickname);
  assert.equal(firstToggle.ok, true);
  assert.equal(
    firstToggle.session.members.some(
      (item) => item.nickname === firstPendingMember.nickname && item.status === '已到店'
    ),
    true
  );

  const secondPendingMember = (firstToggle.session.members || []).find((item) => item.status === '待确认');
  assert.equal(Boolean(secondPendingMember), true);

  const secondToggle = await service.updateStaffSessionMember(sessionId, secondPendingMember.nickname);
  assert.equal(secondToggle.ok, true);
  assert.equal(secondToggle.session.canConfirmMembers, true);

  const confirmResult = await service.runStaffSessionAction(sessionId, 'confirm');
  assert.equal(confirmResult.ok, true);
  assert.equal(confirmResult.session.stageKey, 'ready');

  const startResult = await service.runStaffSessionAction(sessionId, 'start');
  assert.equal(startResult.ok, true);
  assert.equal(startResult.session.stageKey, 'playing');

  const endResult = await service.runStaffSessionAction(sessionId, 'end');
  assert.equal(endResult.ok, true);
  assert.equal(endResult.session.stageKey, 'settled');

  const refreshedDashboard = await service.getStaffDashboard();
  assert.equal(refreshedDashboard.ok, true);
  assert.equal(refreshedDashboard.dashboard.stats.pendingHighlights >= 1, true);

  const highlights = await service.getStaffHighlights();
  assert.equal(highlights.ok, true);
  assert.equal(Array.isArray(highlights.highlights), true);
}

async function main() {
  await testContentFlows();
  await testProfileAndLeaderboardFlows();
  await testLobbyAndTeamRoomFlows();
  await testStaffFlows();
  console.log('主流程自动化校验通过');
}

main().catch((error) => {
  console.error('主流程自动化校验失败');
  console.error(error);
  process.exit(1);
});
