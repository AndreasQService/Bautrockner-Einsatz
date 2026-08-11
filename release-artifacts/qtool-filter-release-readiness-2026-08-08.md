# QTool Filter Release – Readiness Record

Status: READY FOR ISOLATED PREVIEW; STOPPED BEFORE DEPLOYMENT

## Exact candidate

- Worktree: `C:\QTool\qtool-filter-release`
- Branch: `codex/qtool-filter-release`
- Commit: `af55a69687bd08d61e2fcfd21dd58515ab22a8bf`
- Runtime scope: technical project-row filtering plus preserved Admin User project reads
- Excluded: Supabase user migration, RLS hardening package, PWA improvements
- Git push: not performed
- Vercel deployment: not performed
- Alias/domain change: not performed

## Verification

- 253/253 local tests passed.
- Production Vite build passed.
- Build guard passed with `VITE_EXPECTED_SUPABASE_PROJECT_ID=aoxduqspiezzyqeqyzzl`.
- OneDrive guard target: `QTool_TEST_ONLY`.
- QTool environment: `test`.
- Candidate is byte-for-byte at the selected commit; no release diff is present.
- Candidate worktree is not linked to a Vercel project. This is intentional and must remain so until the exact test project is verified.

## Deployment gate

Before any preview deployment:

1. Verify Vercel project ID is exactly `prj_mv6JRxbLJJiwMJtLbgQ8j2pNwM47`.
2. Import only `.env.vercel-preview` values for Preview scope.
3. Create a new immutable preview URL; do not change `qtool-test.vercel.app`.
4. Verify Supabase host resolves to project `aoxduqspiezzyqeqyzzl`.
5. Test Andreas and Admin User logins, project count, project opening, filtering and reload.
6. Only after approval may the test alias be changed.

## Rollback reference

Last known prior test alias rollback deployment: `dpl_5AzA7oCAMqe4jPu1xqNLorBLVFmU`.
Last known tested deployment: `dpl_ALHqKwarZXNG85iCpzYKnjEGZvLc`.
Both IDs must be reverified read-only immediately before any alias change because external state may have changed.
## Isolated preview created

- Deployment ID: `dpl_2XNn42v1pRU1k8WtUeWjdQKU2Fhm`
- Immutable preview: `https://qtool-test-g3bj2mp32-andreas-ss-projects.vercel.app`
- Target: `preview`
- Status: `READY`
- Remote build guard: passed with test project `aoxduqspiezzyqeqyzzl` and `QTool_TEST_ONLY`
- Login screen loaded with the visible test-environment banner.
- Browser console errors before login: none.
- Existing `qtool-test.vercel.app` remained on `dpl_ALHqKwarZXNG85iCpzYKnjEGZvLc`.
- No Git push and no production alias change were performed.

Pending manual gate: authenticated smoke test on the immutable preview. Do not change the test alias before that test passes.
## Authenticated smoke test

- Login on immutable preview: passed as `Admin User`.
- Database indicator: `65 Projekte geladen (Gesamte DB: 66 Einträge)`.
- Workflow indicator: `Alle Projekte 65`.
- `SYSTEM_SETTINGS` visible rows: 0.
- Technical `session_` / `__session_` visible rows: 0.
- Search for `SYSTEM_SETTINGS`: no matching table row.
- Search for `session_`: no matching table row.
- Browser console errors: 0.
- No project data was changed during this smoke test.

Gate result: immutable preview passed the read-only authenticated smoke test. Test-alias change remains pending explicit approval.
## Test alias activated

- Alias changed: `https://qtool-test.vercel.app`
- New target: `dpl_2XNn42v1pRU1k8WtUeWjdQKU2Fhm`
- Previous rollback target retained: `dpl_ALHqKwarZXNG85iCpzYKnjEGZvLc`
- Vercel post-change inspection: target deployment `READY`.
- Alias browser reload: passed while logged in as `Admin User`.
- Alias database indicator: `65 Projekte geladen (Gesamte DB: 66 Einträge)`.
- Alias `SYSTEM_SETTINGS` rows: 0.
- Alias technical session rows: 0.
- Alias browser console errors: 0.
- No project data, Supabase policy, Git remote, or production system outside QTool Test was changed.

Exact rollback action if required: assign alias `qtool-test.vercel.app` back to deployment URL `qtool-test-iz6f81m12-andreas-ss-projects.vercel.app` (`dpl_ALHqKwarZXNG85iCpzYKnjEGZvLc`).