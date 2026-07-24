const projectId = process.env.VERCEL_PROJECT_ID;
const gitRef = process.env.VERCEL_GIT_COMMIT_REF;

console.log('[IGNORE CHECK] Project ID:', projectId);
console.log('[IGNORE CHECK] Git Commit Ref:', gitRef);

const testProjectId = 'prj_mv6JRxbLJJiwMJtLbgQ8j2pNwM47';

if (projectId !== testProjectId && (gitRef === 'test' || gitRef === 'qtool-test-env')) {
    console.log('[IGNORE CHECK] ❌ Skipping build for non-test project on test branch.');
    process.exit(0); // Ignore/skip build
} else {
    console.log('[IGNORE CHECK] ✅ Proceeding with build.');
    process.exit(1); // Proceed with build
}
