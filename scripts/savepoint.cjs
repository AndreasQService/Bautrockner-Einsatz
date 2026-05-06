const { execSync } = require('child_process');

// 1. Get description from args
const description = process.argv[2] || 'Automated Savepoint';

function run(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (err) {
        return null;
    }
}

console.log('--- STARTING SAVEPOINT ---');

// 2. Check for tracked changes
// git ls-files -m (modified) -d (deleted) gives us exactly what we need
const trackedChangesOutput = run('git ls-files -m -d');
if (!trackedChangesOutput) {
    // Also check for staged changes just in case
    const stagedChanges = run('git diff --cached --name-only');
    if (!stagedChanges) {
        console.log('No tracked changes to commit. Skipping.');
        process.exit(0);
    }
    trackedChangesOutput = stagedChanges;
}

const trackedChanges = trackedChangesOutput.split('\n').filter(f => f.trim().length > 0);

if (trackedChanges.length === 0) {
    console.log('No tracked changes to commit. Skipping.');
    process.exit(0);
}

console.log('Detected tracked changes:');
trackedChanges.forEach(f => console.log(`  - ${f}`));

// 3. Run Build Validation
console.log('\nValidating build...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Build successful!');
} catch (err) {
    console.error('\n[ERROR] Build failed! Savepoint aborted to prevent unstable commits.');
    process.exit(1);
}

// 4. Commit and Tag
try {
    console.log('\nCommitting changes...');
    // Add only tracked changes
    trackedChanges.forEach(file => {
        execSync(`git add "${file}"`);
    });

    const commitMsg = `SAVEPOINT: ${description}`;
    execSync(`git commit -m "${commitMsg}"`);

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    const tagName = `savepoint-${timestamp}`;
    execSync(`git tag ${tagName}`);

    console.log(`\n✅ Savepoint created successfully!`);
    console.log(`Commit: ${commitMsg}`);
    console.log(`Tag: ${tagName}`);
} catch (err) {
    console.error('\n[ERROR] Git operation failed:', err.message);
    process.exit(1);
}
