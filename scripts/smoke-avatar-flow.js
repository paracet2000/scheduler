#!/usr/bin/env node
'use strict';

/**
 * Smoke test: register -> login -> upload avatar -> verify data URL in profile.
 *
 * Usage:
 *   npm run smoke:avatar
 *   SMOKE_BASE_URL=http://localhost:3000 npm run smoke:avatar
 */

const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const password = process.env.SMOKE_REGISTER_PASSWORD || 'Passw0rd!234';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const now = Date.now();
const email = `smoke_avatar_${now}@example.com`;
const name = `Smoke Avatar ${now}`;

// tiny valid PNG bytes (1x1 transparent)
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0M1nUAAAAASUVORK5CYII=',
  'base64'
);

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
    logPass('Register success');
  }

  logStep('Upload avatar image to /api/users/me/avatar');
  {
    const formData = new FormData();
    formData.append('image', new Blob([onePixelPng], { type: 'image/png' }), 'smoke.png');

    const { res, json, text } = await request('/api/users/me/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    assert(res.ok, `Avatar upload failed (${res.status}). Body: ${text || JSON.stringify(json)}`);
    const avatar = json?.data?.avatar || '';
    assert(typeof avatar === 'string' && avatar.startsWith('data:image/jpeg;base64,'), 'Uploaded avatar is not JPEG data URL');
    logPass('Avatar upload success and returned as JPEG data URL');
  }

  logStep('Read profile and verify avatar persisted');
  {
    const { res, json, text } = await request('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert(res.ok, `Profile read failed (${res.status}). Body: ${text || JSON.stringify(json)}`);

    const avatar = json?.data?.avatar || '';
    assert(typeof avatar === 'string' && avatar.startsWith('data:image/jpeg;base64,'), 'Profile avatar is missing/invalid');
    assert(avatar.length > 100, 'Profile avatar looks too short');
    logPass('Profile contains persisted JPEG avatar data URL');
  }

  logStep('Guest access still blocked without token');
  {
    token = '';
    const { res, json, text } = await request('/api/users/me');
    assert(res.status === 401, `Expected 401, got ${res.status}. Body: ${text || JSON.stringify(json)}`);
    logPass('Guest blocked from profile endpoint');
  }

  console.log('\n[OK] Smoke avatar flow passed.');
}

main().catch((err) => {
  logFail(err?.message || String(err));
  process.exit(1);
});

