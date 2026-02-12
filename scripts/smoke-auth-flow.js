#!/usr/bin/env node
'use strict';

/**
 * Smoke test: guest -> register -> login -> authorized endpoints -> guest again.
 *
 * Usage:
 *   npm run smoke:auth
 *   SMOKE_BASE_URL=http://localhost:3000 npm run smoke:auth
 */

const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const password = process.env.SMOKE_REGISTER_PASSWORD || 'Passw0rd!234';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const now = Date.now();
const email = `smoke_${now}@example.com`;
const name = `Smoke ${now}`;

function logStep(msg) {
  console.log(`\n[STEP] ${msg}`);
}

function logPass(msg) {
  console.log(`[PASS] ${msg}`);
}

function logFail(msg) {
  console.error(`[FAIL] ${msg}`);
}

async function request(path, options = {}) {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { res, json, text, url };
  } finally {
    clearTimeout(timer);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  console.log(`[INFO] Base URL: ${baseUrl}`);
  console.log(`[INFO] Timeout: ${timeoutMs}ms`);
  console.log(`[INFO] Register email: ${email}`);

  let token = '';

  logStep('Guest must NOT access protected profile endpoint');
  {
    const { res, json, text } = await request('/api/users/me');
    assert(res.status === 401, `Expected 401, got ${res.status}. Body: ${text || JSON.stringify(json)}`);
    logPass('Guest blocked from /api/users/me');
  }

  logStep('Register new user');
  {
    const { res, json, text } = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    assert(res.ok, `Register failed (${res.status}). Body: ${text || JSON.stringify(json)}`);
    token = json?.data?.token || '';
    assert(!!token, 'Register response missing token');
    logPass('Register success with token');
  }

  logStep('Login with newly registered user');
  {
    const { res, json, text } = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    assert(res.ok, `Login failed (${res.status}). Body: ${text || JSON.stringify(json)}`);
    const loginToken = json?.data?.token || '';
    assert(!!loginToken, 'Login response missing token');
    token = loginToken;
    logPass('Login success');
  }

  logStep('Authenticated user can access profile');
  {
    const { res, json, text } = await request('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(res.ok, `Expected profile success, got ${res.status}. Body: ${text || JSON.stringify(json)}`);
    logPass('Profile endpoint accessible with token');
  }

  logStep('Authenticated user can load menu authorization');
  {
    const { res, json, text } = await request('/api/menu-authorize/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(res.ok, `Expected menu-authorize success, got ${res.status}. Body: ${text || JSON.stringify(json)}`);
    assert(Array.isArray(json?.data), 'Expected menu-authorize data to be an array');
    logPass(`Menu authorization loaded (${json.data.length} rows)`);
  }

  logStep('After logout state (no token), protected endpoint must be blocked again');
  {
    token = '';
    const { res, json, text } = await request('/api/users/me');
    assert(res.status === 401, `Expected 401 after logout-state, got ${res.status}. Body: ${text || JSON.stringify(json)}`);
    logPass('Protected endpoint blocked again without token');
  }

  console.log('\n[OK] Smoke auth flow passed.');
}

main().catch((err) => {
  logFail(err?.message || String(err));
  process.exit(1);
});

