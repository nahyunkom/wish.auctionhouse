const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { Server } = require('socket.io');
const catalog = require('./creature-catalog.json');
const catalogModel = require('./catalog-model.js')(catalog);

const app = express();
const httpServer = http.createServer(app);
const root = __dirname;
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
const maxCreatures = clampNumber(process.env.MAX_CREATURES, 1, 500, 120);
const creatureTtlMs = clampNumber(process.env.CREATURE_TTL_MS, 60_000, 86_400_000, 21_600_000);
const configuredOrigins = String(process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const prefixes = ['황금', '온기', '자아', '숨결', '새움', '유영', '별빛'];
const situationLabels = ['경제적 소망', '관계적 소망', '자기실현 소망', '건강·생존 소망', '성장 소망', '자유 소망', '인정 소망'];
const species = ['등불해파리', '리본해룡', '나선고둥', '재생산호', '쌍둥이말미잘', '심연문어', '날개갯민숭'];
const wayLabels = ['신뢰형', '탐험형', '축적형', '회복형', '공존형', '몰입형', '초월형'];
const hues = [45, 290, 210, 0, 70, 165, 250];

let creatures = [];
const releaseIds = new Map();

function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function cleanExpiredCreatures() {
  const cutoff = Date.now() - creatureTtlMs;
  creatures = creatures.filter((creature) => creature.releasedAt >= cutoff);
  for (const [clientReleaseId, creature] of releaseIds) {
    if (creature.releasedAt < cutoff) releaseIds.delete(clientReleaseId);
  }
}

function makeCreature(payload) {
  const entry=catalogModel.get(payload?.catalogId);
  if(!entry)return null;
  return {
    id:crypto.randomUUID(),catalogId:entry.id,specimenId:entry.id,
    name:entry.folder,wishType:entry.wishType,methodType:entry.methodType,
    situationIndex:entry.situationIndex,wayIndex:entry.wayIndex,
    situationLabel:entry.wishCategory,wayLabel:wayLabels[entry.wayIndex],
    imageUrl:entry.imageUrl,videoUrl:entry.videoUrl,
    releasedAt:Date.now(),seed:crypto.randomInt(1,2_147_483_647)
  };
}

app.disable('x-powered-by');
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.get('/health', (_request, response) => {
  cleanExpiredCreatures();
  response.json({ ok: true, catalogVersion:catalog.version, catalogCount:catalog.count, creatures: creatures.length, uptimeSeconds: Math.round(process.uptime()) });
});

// Only actual, retained releases are counted; never fabricate survey statistics.
app.get('/api/aquarium-summary', (_request, response) => {
  cleanExpiredCreatures();
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    total: creatures.length,
    retentionHours: creatureTtlMs / 3_600_000,
    scope: 'currently-retained-releases',
    generatedAt: new Date().toISOString(),
    directions: situationLabels.map((label, index) => ({
      label, count: creatures.filter(creature => creature.situationIndex === index).length
    })),
    methods: wayLabels.map((label, index) => ({
      label, count: creatures.filter(creature => creature.wayIndex === index).length
    }))
  });
});

app.get(['/', '/index.html'], (_request, response) => response.sendFile(path.join(root, 'index.html')));
app.get(['/shared-aquarium', '/shared-aquarium/', '/shared-aquarium.html'], (_request, response) => {
  response.sendFile(path.join(root, 'shared-aquarium.html'));
});

for (const filename of [
  'style.css',
  'journey.js',
  'app.js',
  'config.js',
  'data.js',
  'creature-catalog.js',
  'catalog-model.js',
  'catalog-ui.js',
  'particles.js',
  'shared-aquarium.css',
  'shared-aquarium.js',
  'aquarium-sprite.js',
  'aquarium-environment.js'
]) {
  app.get(`/${filename}`, (_request, response) => response.sendFile(path.join(root, filename)));
}

app.use('/assets', express.static(path.join(root, 'assets'), {
  immutable: true,
  maxAge: '7d',
  fallthrough: false
}));
app.get('/vendor/p5.min.js', (_request, response) => {
  response.sendFile(path.join(root, 'node_modules', 'p5', 'lib', 'p5.min.js'));
});

const socketOptions = {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 12_000,
  serveClient: true
};
if (configuredOrigins.length) {
  socketOptions.cors = {
    origin: configuredOrigins,
    methods: ['GET', 'POST']
  };
}
const io = new Server(httpServer, socketOptions);

function broadcastPresence() {
  io.emit('aquarium:presence', { connections: io.engine.clientsCount });
}

io.on('connection', (socket) => {
  cleanExpiredCreatures();
  socket.emit('aquarium:state', { creatures });
  broadcastPresence();
  let lastReleaseAt = 0;

  socket.on('creature:release', (payload, acknowledge = () => {}) => {
    const now = Date.now();
    if (now - lastReleaseAt < 1200) {
      acknowledge({ ok: false, message: '잠시 후 다시 방류해 주세요.' });
      return;
    }
    lastReleaseAt = now;

    const clientReleaseId = typeof payload?.clientReleaseId === 'string'
      ? payload.clientReleaseId.slice(0, 100)
      : '';
    if (clientReleaseId && releaseIds.has(clientReleaseId)) {
      acknowledge({ ok: true, creature: releaseIds.get(clientReleaseId), duplicate: true });
      return;
    }

    const creature = makeCreature(payload);
    if (!creature) {
      acknowledge({ ok: false, message: '생물 목록이 변경되었어요. 새로고침 후 다시 진단해 주세요.' });
      return;
    }

    cleanExpiredCreatures();
    creatures.push(creature);
    if (creatures.length > maxCreatures) creatures.splice(0, creatures.length - maxCreatures);
    if (clientReleaseId) releaseIds.set(clientReleaseId, creature);
    io.emit('creature:released', creature);
    acknowledge({ ok: true, creature });
  });

  socket.on('disconnect', broadcastPresence);
});

const cleanupTimer = setInterval(cleanExpiredCreatures, Math.min(creatureTtlMs, 300_000));
cleanupTimer.unref();

httpServer.listen(port, host, () => {
  console.log(`Wish Aquarium listening on http://${host}:${port}`);
});

function shutdown() {
  io.close(() => httpServer.close(() => process.exit(0)));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

