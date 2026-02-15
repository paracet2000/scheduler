const mongoose = require('mongoose');

const READY_STATE_MAP = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

const dbDebugState = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastDisconnectAt: null,
  lastUriSummary: {
    configured: false,
    scheme: null,
    host: null,
    database: null
  },
  lastError: null
};

function sanitizeMessage(value) {
  return String(value || '')
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, 'mongodb$1://***:***@')
    .replace(/([?&](?:password|pass|pwd)=)[^&\s]+/gi, '$1***');
}

function summarizeMongoUri(uri) {
  const raw = String(uri || '').trim();
  if (!raw) {
    return {
      configured: false,
      scheme: null,
      host: null,
      database: null
    };
  }

  const scheme = raw.split('://')[0] || null;
  const withoutScheme = raw.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  const afterAuth = withoutScheme.includes('@') ? withoutScheme.split('@').pop() : withoutScheme;
  const host = (afterAuth.split('/')[0] || '').trim() || null;
  const pathPart = afterAuth.includes('/') ? afterAuth.split('/').slice(1).join('/') : '';
  const database = (pathPart.split('?')[0] || '').trim() || null;

  return {
    configured: true,
    scheme,
    host,
    database
  };
}

function getDebugStatus() {
  const readyState = Number(mongoose.connection.readyState || 0);
  return {
    ...dbDebugState,
    readyState,
    readyStateLabel: READY_STATE_MAP[readyState] || 'unknown'
  };
}

mongoose.connection.on('connected', () => {
  dbDebugState.lastSuccessAt = new Date().toISOString();
  dbDebugState.lastError = null;
});

mongoose.connection.on('disconnected', () => {
  dbDebugState.lastDisconnectAt = new Date().toISOString();
});

const connectDB = async () => {
  try {
    dbDebugState.lastAttemptAt = new Date().toISOString();
    dbDebugState.lastUriSummary = summarizeMongoUri(process.env.MONGODB_URI);

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    dbDebugState.lastErrorAt = new Date().toISOString();
    dbDebugState.lastError = {
      name: err?.name || 'Error',
      code: err?.code || null,
      message: sanitizeMessage(err?.message || 'Unknown MongoDB error')
    };
    console.error('MongoDB error', err);
    process.exit(1);
  }
};

connectDB.getDebugStatus = getDebugStatus;
module.exports = connectDB;
