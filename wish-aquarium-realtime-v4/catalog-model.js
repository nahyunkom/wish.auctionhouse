(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.WishCatalog = factory(root.WISH_CREATURE_CATALOG);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(catalog) {
  'use strict';
  if (!catalog || !Array.isArray(catalog.entries) || catalog.entries.length !== catalog.count) throw new Error('소망생물 목록을 불러오지 못했습니다.');
  const entries = catalog.entries;
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  if (byId.size !== entries.length) throw new Error('Duplicate creature IDs.');
  return Object.freeze({
    entries,
    get: id => byId.get(id) || null,
    directions(situationIndex = null) {
      const filtered = entries.filter(entry => situationIndex === null || entry.situationIndex === situationIndex);
      return [...new Map(filtered.map(entry => [entry.wishType, {name:entry.wishType, situationIndex:entry.situationIndex, category:entry.wishCategory}])).values()];
    },
    methods(wishType, preferredWay = null) {
      return entries.filter(entry => entry.wishType === wishType).slice().sort((a,b) => Number(b.wayIndex===preferredWay)-Number(a.wayIndex===preferredWay) || a.wayIndex-b.wayIndex || a.methodType.localeCompare(b.methodType,'ko'));
    },
    select(wishType, methodType) {
      return entries.find(entry => entry.wishType === wishType && entry.methodType === methodType) || null;
    }
  });
});
