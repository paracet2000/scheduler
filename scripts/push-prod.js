const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Project root (one level up from /scripts)
const ROOT = path.resolve(__dirname, '..');
// Target file that holds BASE_URL
const targetFile = path.join(ROOT, 'js', 'index.js');
// The production (same-origin) BASE_URL value
const prodValue = "window.BASE_URL || ''";
// The development BASE_URL value
const devValue = "window.BASE_URL || 'http://localhost:3000'";
// Default commit message when none is provided
const defaultMessage = 'Prepare production BASE_URL';

function updateBaseUrl({ activeValue, commentedValue }) {
  // Rewrite the active/commented BASE_URL lines to match the desired values.
  const src = fs.readFileSync(targetFile, 'utf8');
  const lines = src.split(/\r?\n/).map((line) => {
    if (/^\s*const BASE_URL = window\.BASE_URL \|\|/.test(line)) {
      return `    const BASE_URL = ${activeValue};`;
    }
    if (/^\s*\/\/\s*const BASE_URL = window\.BASE_URL \|\|/.test(line)) {
      return `    // const BASE_URL = ${commentedValue};`;
    }
    return line;
  });
  fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
}

function run(cmd) {
  // Run a shell command in the repo root and stream output to the terminal.
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

// Accept a custom commit message: `npm run push:prod -- "msg"`
const message = process.argv.slice(2).join(' ').trim() || defaultMessage;

try {
  // Switch to production (same-origin) before commit/push.
  updateBaseUrl({ activeValue: prodValue, commentedValue: devValue });
  // Stage, commit, and push changes.
  run('git add -A');
  run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  run('git push');
} finally {
  // Always revert locally back to dev.
  updateBaseUrl({ activeValue: devValue, commentedValue: prodValue });
}
