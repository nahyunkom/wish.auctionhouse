'use strict';
const fs = require('node:fs');
const path = require('node:path');

// All acknowledged releases are committed before they are broadcast. Never expire
// exhibition records, including when the process starts again after a deploy.
function createReleaseStore(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  let records = [];
  if (fs.existsSync(filename)) {
    const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (saved.version !== 1 || !Array.isArray(saved.records)) throw Error('Invalid release store; restore a backup instead of resetting it.');
    const ids = new Set(), keys = new Set();
    for (const record of saved.records) {
      if (!record.creature || typeof record.creature.id !== 'string' || !record.creature.id ||
          typeof record.creature.catalogId !== 'string' || !Number.isFinite(record.creature.releasedAt) ||
          typeof record.clientReleaseId !== 'string' || ids.has(record.creature.id) ||
          (record.clientReleaseId && keys.has(record.clientReleaseId))) throw Error('Invalid or duplicate release record; refusing to reset it.');
      ids.add(record.creature.id);if(record.clientReleaseId)keys.add(record.clientReleaseId);
    }
    records = saved.records;
  }
  let byKey = new Map(records.filter(r => r.clientReleaseId).map(r => [r.clientReleaseId, r.creature]));
  function commit(next) {
    const temporary = filename + '.tmp';
    const fd = fs.openSync(temporary, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify({ version: 1, records: next })); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temporary, filename);
    records = next;
    byKey = new Map(records.filter(r => r.clientReleaseId).map(r => [r.clientReleaseId, r.creature]));
  }
  // Verify that the configured path is writable before accepting any visitors.
  commit(records);
  return {
    all: () => records.map(r => r.creature),
    find: key => byKey.get(key),
    add(creature, clientReleaseId = '') {
      if (clientReleaseId && byKey.has(clientReleaseId)) return byKey.get(clientReleaseId);
      const existing = records.find(r => r.creature.id === creature.id);
      if (existing) return existing.creature;
      commit([...records, { creature, clientReleaseId }]);
      return creature;
    }
  };
}
module.exports = { createReleaseStore };
