const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root (one level up from /scripts)
const ROOT = path.resolve(__dirname, '..');
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
