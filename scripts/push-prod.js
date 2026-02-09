const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Project root (one level up from /scripts)
const ROOT = path.resolve(__dirname, '..');
// Load .env from repo root (optional)
dotenv.config({ path: path.join(ROOT, '.env') });

// Default commit message when none is provided
const defaultMessage = 'Prepare production BASE_URL';

function run(cmd) {
  // Run a shell command in the repo root and stream output to the terminal.
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

// Accept a custom commit message: `npm run push:prod -- "msg"`
const message = process.argv.slice(2).join(' ').trim() || defaultMessage;

// No BASE_URL swap needed; index.js derives BASE_URL at runtime.
// Stage, commit, and push changes.
run('git add -A');
run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
run('git push');

const deployHook = (process.env.RENDER_DEPLOY_HOOK || '').trim();
if (deployHook) {
  try {
    // Trigger Render deploy hook (GET is supported).
    execSync(`node -e "fetch('${deployHook}').then(r=>{console.log('Deploy hook:', r.status);}).catch(e=>{console.error('Deploy hook failed:', e.message); process.exitCode=1;})"`, { stdio: 'inherit', cwd: ROOT });
  } catch (err) {
    console.error('Deploy hook error:', err.message || err);
  }
} else {
  console.log('RENDER_DEPLOY_HOOK not set; skipping deploy hook.');
}
