# Phase 9 backend audit

## Verification

The Node built-in test runner suite lives in `tests/api.integration.test.js` and runs with `npm run test:api`. The latest run passed **8 test groups, 0 failures** against the dedicated `project_management_api_test` database. It uses unique fixture names and removes the test records and uploaded files at completion. JavaScript syntax checks across `src/` and `tests/` passed, as did `git diff --check`.

Coverage includes health checks; missing, invalid, expired, and revoked JWTs; auth validation and successful login, verification, refresh-token rotation, password reset, and password change; project and member operations; project-role authorization; task assignment/status/CRUD; subtask CRUD and member completion; note CRUD and project scoping; upload MIME/signature/count/size checks; static attachment responses; and file cleanup when a task is deleted.

## Endpoint and runtime notes

- The running app mounts project APIs at `/api/v1/project` (singular). This document set records the actual route prefix because the PRD also uses `/projects` in one section.
- Any authenticated account can create a project; the creator automatically receives the Admin membership. This matches the project creation flow in the roadmap.
- Attachment URLs under `/images/` are served by Express static middleware without authentication. They are suitable for public files; they do not provide private project-member downloads.
- Tests use a dedicated `API_TEST_MONGO_URI`; the test suite refuses to use `MONGO_URI` as a fallback. Mail delivery is external, so automated tests cover invalid/neutral flows and seed verification/reset tokens directly. They do not test sending real SMTP mail during registration, resend-verification, or a known-account forgot-password request.

## API reference

See [API.md](API.md) for methods, URLs, access roles, request bodies, and expected status codes.
