---
name: escape-room-miniapp
description: Use when working on /Users/edy/Documents/密室小程序/miniapp. This skill captures the project's required reading order, changelog discipline, runtime environment rules, regression chains, and safe deployment workflow for the WeChat miniapp and its cloud functions.
---

# Escape Room Miniapp

## When to use

Use this skill for any development, debugging, regression, deployment, or documentation cleanup work in `/Users/edy/Documents/密室小程序/miniapp`.

## Required reading order

Before changing code:

1. Read `../../CHANGELOG.md`
2. Read `../../PROJECT_CONTEXT.md`
3. Read `../../AGENT_WORKFLOW.md`
4. Read `../../CODEMAP.md`

Do not start with a full repo scan unless the task truly spans multiple domains.

## Hard rules

- Every code change must append a new entry to `../../CHANGELOG.md`
- `trial` and `release` are treated as real business environments
- Do not rely on seed/test data to claim the app is line-of-business ready
- Identity must converge on `openid`
- Group flows must be validated across lobby, my groups, room detail, and staff session flow together
- Deployments must use an isolated snapshot, never a dirty workspace upload

## Minimum validation

Run the scripts listed in `../../AGENT_WORKFLOW.md` that match the change scope.

If uploading a trial build, first read `../../AGENT_PROMPT.md` and confirm the upload target is the intended snapshot.
