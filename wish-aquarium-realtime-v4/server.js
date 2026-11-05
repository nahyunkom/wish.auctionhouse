const fs = require('node:fs');
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
// Exhibition mode: released creatures are kept for the whole exhibition (no expiry).
// CREATURE_TTL_MS can still set an expiry; MAX_CREATURES bounds memory.
const maxCreatures = clampNumber(process.env.MAX_CREATURES, 1, 20000, 5000);
const creatureTtlMs = process.env.CREATURE_TTL_MS ? clampNumber(process.env.CREATURE_TTL_MS, 60_000, 30 * 86_400_000, 0) : 0;
const creaturesFile = process.env.CREATURES_FILE || path.join(__dirname, 'data', 'creatures.json');
const seedFile = path.join(__dirname, 'exhibition-creatures.json');
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
  if (!creatureTtlMs) return;
  const cutoff = Date.now() - creatureTtlMs;
  creatures = creatures.filter((creature) => creature.releasedAt >= cutoff);
  for (const [clientReleaseId, creature] of releaseIds) {
    if (creature.releasedAt < cutoff) releaseIds.delete(clientReleaseId);
  }
}

function makeCreature(payload, restored) {
  const entry=catalogModel.get(payload?.catalogId);
  if(!entry)return null;
  const id=restored&&typeof payload.id==='string'&&/^[A-Za-z0-9-]{8,64}$/.test(payload.id)?payload.id:crypto.randomUUID();
  const at=Number(payload?.releasedAt),seed=Number(payload?.seed);
  return {
    id,catalogId:entry.id,specimenId:entry.id,
    name:entry.folder,wishType:entry.wishType,methodType:entry.methodType,
    situationIndex:entry.situationIndex,wayIndex:entry.wayIndex,
    situationLabel:entry.wishCategory,wayLabel:wayLabels[entry.wayIndex],
    imageUrl:entry.imageUrl,videoUrl:entry.videoUrl,
    releasedAt:restored&&Number.isFinite(at)&&at>1.7e12&&at<=Date.now()+60_000?Math.round(at):Date.now(),
    seed:restored&&Number.isInteger(seed)&&seed>0&&seed<2_147_483_648?seed:crypto.randomInt(1,2_147_483_647)
  };
}

// Bring back creatures we already know (seed file, saved file, or a display's archive).
// Only ids that are not here yet are added; every entry is rebuilt from the real catalog.
function restoreCreatures(list) {
  if (!Array.isArray(list)) return [];
  const known = new Set(creatures.map((creature) => creature.id)), added = [];
  for (const item of list.slice(0, maxCreatures)) {
    if (!item || known.has(item.id)) continue;
    const creature = makeCreature(item, true);
    if (!creature) continue;
    known.add(creature.id);creatures.push(creature);added.push(creature);
  }
  if (added.length) {
    creatures.sort((a, b) => a.releasedAt - b.releasedAt);
    if (creatures.length > maxCreatures) creatures.splice(0, creatures.length - maxCreatures);
    saveCreaturesSoon();
  }
  return added;
}
let saveTimer = null;
function saveCreaturesSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(creaturesFile), { recursive: true });
      fs.writeFileSync(creaturesFile + '.tmp', JSON.stringify(creatures.map(({ id, catalogId, releasedAt, seed }) => ({ id, catalogId, releasedAt, seed }))));
      fs.renameSync(creaturesFile + '.tmp', creaturesFile);
    } catch (error) { console.warn('Could not save creatures', error.message); }
  }, 2000);
  saveTimer.unref?.();
}
for (const file of [seedFile, creaturesFile]) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const added = restoreCreatures(Array.isArray(data) ? data : data.creatures);
    if (added.length) console.log(`Restored ${added.length} creatures from ${path.basename(file)}`);
  } catch (_) { /* no file yet */ }
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
// Every creature in the aquarium, for keeping a record of the exhibition.
app.get('/api/aquarium-archive', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({ savedAt: new Date().toISOString(), total: creatures.length,
    creatures: creatures.map(({ id, catalogId, releasedAt, seed, wishType, methodType }) => ({ id, catalogId, releasedAt, seed, wishType, methodType })) });
});

app.get('/api/aquarium-summary', (_request, response) => {
  cleanExpiredCreatures();
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    total: creatures.length,
    retentionHours: creatureTtlMs / 3_600_000, // 0: kept for the whole exhibition
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
  'creature-names.js',
  'particles.js',
  'qrcode.js',
  'shared-aquarium.css',
  'shared-aquarium.js',
  'aquarium-sound.js',
  'aquarium-birth-sound.js',
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
// ---- Take-home page: a visitor scans the QR on the result screen and saves the
// creature image on their own phone. Only real catalog creatures; no visitor data.
const vm = require('node:vm');
const takeHome = (() => {
  try {
    const context = { document: {}, window: {}, console };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, 'creature-names.js'), 'utf8'), context);
    const text = vm.runInContext(fs.readFileSync(path.join(root, 'catalog-ui.js'), 'utf8') + ';({wishDescriptions,methodDescriptions,wishWhispers,blank:[...blankCreatureIds]})', context);
    return { names: context.creatureNames || {}, ...text, template: fs.readFileSync(path.join(root, 'take-home.html'), 'utf8') };
  } catch (error) { console.warn('Take-home page unavailable', error.message); return null; }
})();
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// The creature's own video, relayed from the catalog's video host so a phone can play it
// (Range requests pass through) and save it (?download=1 sends it as a file).
app.get('/c/:id/video', async (request, response) => {
  const id = String(request.params.id || '');
  const entry = /^WC-[a-f0-9]{12}$/.test(id) ? catalogModel.get(id) : null;
  if (!entry || !/^https:\/\/d8j0ntlcm91z4\.cloudfront\.net\//.test(entry.videoUrl)) { response.status(404).end(); return; }
  try {
    const headers = {};
    if (request.headers.range) headers.Range = request.headers.range;
    const upstream = await fetch(entry.videoUrl, { headers });
    if (!upstream.ok && upstream.status !== 206) { response.status(502).end(); return; }
    response.status(upstream.status);
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);if (value) response.setHeader(name, value);
    }
    if (!upstream.headers.get('accept-ranges')) response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'public, max-age=86400');
    if (request.query.download) {
      const named = takeHome && takeHome.names[entry.id] ? takeHome.names[entry.id].ko : entry.id;
      response.setHeader('Content-Disposition', "attachment; filename=\"wish-creature.mp4\"; filename*=UTF-8''" + encodeURIComponent('소망경매장_' + named + '.mp4'));
    }
    const { Readable } = require('node:stream');
    Readable.fromWeb(upstream.body).on('error', () => response.destroy()).pipe(response);
  } catch (error) { if (!response.headersSent) response.status(502).end(); else response.destroy(); }
});

app.get('/c/:id', (request, response) => {
  const id = String(request.params.id || '');
  const entry = /^WC-[a-f0-9]{12}$/.test(id) ? catalogModel.get(id) : null;
  response.setHeader('Cache-Control', 'public, max-age=300');
  if (!takeHome) { response.status(503).send('잠시 후 다시 시도해 주세요.'); return; }
  let body;
  if (!entry || takeHome.blank.includes(id)) {
    response.status(404);
    body = '<p class="missing">이 소망생물을 찾지 못했어요.</p>';
  } else {
    const named = takeHome.names[entry.id] || { ko: '소망생물', la: '' };
    const file = encodeURIComponent('소망경매장_' + named.ko + '.png');
    const video = '/c/' + entry.id + '/video';
    body = '<figure><video src="' + video + '" poster="/' + escapeHtml(entry.imageUrl) + '" autoplay muted loop playsinline preload="auto" aria-label="' + escapeHtml(named.ko) + '"></video></figure>'
      + '<h1>' + escapeHtml(named.ko) + '</h1><p class="latin">' + escapeHtml(named.la) + '</p>'
      + '<p class="wish">' + escapeHtml(takeHome.wishDescriptions[entry.wishType] || '') + '<br>' + escapeHtml(takeHome.methodDescriptions[entry.methodType] || '') + '</p>'
      + '<a class="save" href="' + video + '?download=1" download="' + escapeHtml(decodeURIComponent(file).replace(/\.png$/, '.mp4')) + '">영상 저장하기 <span aria-hidden="true">↓</span></a>'
      + '<p class="tip">아이폰은 저장한 영상이 \'파일\' 앱에 들어가요. 사진 앱에 넣으려면 파일 앱에서 영상을 열고 공유 → \'비디오 저장\'을 눌러 주세요.<br><a href="/' + escapeHtml(entry.imageUrl) + '" download="' + escapeHtml(decodeURIComponent(file)) + '">이미지로 저장하기</a></p>'
      + '<p class="id">' + escapeHtml(entry.id) + ' · 소망경매장 WISH AUCTION HOUSE</p>';
  }
  response.type('html').send(takeHome.template.replace('<!--CREATURE-->', body));
});

app.get('/vendor/p5.min.js', (_request, response) => {
  response.sendFile(path.join(root, 'node_modules', 'p5', 'lib', 'p5.min.js'));
});

const socketOptions = {
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 64_000,
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
    saveCreaturesSoon();
    io.emit('creature:released', creature);
    acknowledge({ ok: true, creature });
  });

  // A display that kept its own archive gives it back after a server restart.
  socket.on('aquarium:restore', (payload) => {
    const added = restoreCreatures(payload?.creatures);
    if (added.length) io.emit('aquarium:restored', { creatures: added });
  });

  socket.on('disconnect', broadcastPresence);
});

const cleanupTimer = setInterval(cleanExpiredCreatures, Math.min(creatureTtlMs || 300_000, 300_000));
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

