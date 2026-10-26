/*
 * Shared data and rules for the wish journey (browser and server).
 * Only the 438 real catalog pairs can become results; nothing here invents one.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.WishCore = factory(root.WishCatalog);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (WishCatalog) {
  'use strict';

  // Short, plain-language labels for the 24 wish types that have real creatures.
  const WISH_LABELS = {
    '안정 축적형': '생활의 기반을 단단히 쌓기',
    '투자 확장형': '가진 것을 키워 선택을 넓히기',
    '희귀 가치형': '나만의 희소한 가치를 키우기',
    '상승 경쟁형': '경쟁에서 한 단계 올라서기',
    '생존 탈출·자유형': '생계의 압박에서 벗어나기',
    '연인 융합형': '사랑하는 사람과 깊이 이어지기',
    '관계 회복형': '멀어진 마음을 되찾기',
    '교감·존재형': '서로의 존재를 느끼기',
    '형제·친구 동행형': '친구와 서로를 지지하기',
    '소속 군체형': '마음 둘 곳에 소속되기',
    '자기 기준 정립형': '남의 평가보다 나의 기준',
    '하고 싶은 일 지속형': '좋아하는 일을 오래 하기',
    '결과 만들어내기형': '생각을 결과로 완성하기',
    '가족 건강 기원형': '가족이 건강하기를',
    '병상 회복형': '아픔에서 회복하기',
    '노년 신체 보존형': '시간이 흘러도 몸을 지키기',
    '마지막 시간 연장형': '소중한 존재와 조금 더 함께',
    '공부 축적형': '차근차근 지식을 쌓기',
    '기술 숙련형': '한 가지 기술을 내 것으로',
    '언어 습득형': '새로운 언어로 넓은 세계를',
    '습관 정착형': '좋은 습관을 몸에 붙이기',
    '운동 훈련형': '몸과 마음의 힘 기르기',
    '장소 이탈형': '익숙한 곳을 떠나 살아 보기',
    '역할 탈피형': '기대받던 역할에서 벗어나기'
  };

  const WAYS = [
    { label: '신뢰형', line: '나를 믿고, 때가 오면 움직여요' },
    { label: '탐험형', line: '직접 부딪히며 길을 찾아요' },
    { label: '축적형', line: '작은 것을 꾸준히 쌓아요' },
    { label: '회복형', line: '나를 돌보며 천천히 다시 시작해요' },
    { label: '공존형', line: '누군가와 함께 키워 가요' },
    { label: '몰입형', line: '한 가지에 깊이 빠져들어요' },
    { label: '초월형', line: '방식을 바꿔 한계를 넘어요' }
  ];

  const METHOD_LINES = {
    '그냥하기 (신속형)': '완벽한 준비보다 지금 할 수 있는 행동부터',
    '때를 기다리기': '내 방향을 믿고 알맞은 때를 기다리며',
    '낯선 환경 진입형': '새로운 환경에 직접 들어가며',
    '비교 테스트형': '여러 방법을 비교해 나에게 맞는 것을 고르며',
    '체험 샘플링형': '작게 경험해 보며 가능성을 확인하며',
    '기록 축적형': '기록을 남기며 작은 변화를 쌓으며',
    '반복 훈련형': '같은 행동을 반복해 익숙하게 만들며',
    '저장 비축형': '자원과 에너지를 모아 다음을 준비하며',
    '느린 재시작형': '멈춘 자리에서 천천히 다시 시작하며',
    '보호막 재생형': '나를 지켜 줄 조건부터 만들며',
    '속도 조절형': '무리하지 않도록 속도를 조절하며',
    '역할 분담형': '함께할 사람과 역할을 나누며',
    '함께 루틴형': '서로의 리듬에 맞춰 꾸준히 함께하며',
    '환경 적응형': '주변과 관계를 살피며 방법을 조율하며',
    '내면 압축형': '바깥의 소음을 줄이고 내 안의 힘을 모으며',
    '심해 잠수형': '한 가지 일의 깊은 곳까지 집중하며',
    '관점 전환형': '같은 상황을 다른 시선으로 바라보며',
    '한계 돌파형': '익숙한 한계 너머에 도전하며',
    '형태 전환형': '지금까지의 방식 자체를 바꾸며'
  };

  // 0 … 11: how long the wish has been held.
  const YEARS = ['올해 처음', '1년', '2년', '3년', '4년', '5년', '6년', '7년', '8년', '9년', '10년', '10년 넘게'];

  const MAX_WISHES = 3;
  const MAX_MESSAGE = 120;
  const MAX_MOMENT = 200;

  function create(catalogModel) {
    const model = catalogModel;
    const wishTypes = model.directions().map(d => d.name).filter(name => WISH_LABELS[name]);

    function waysFor(wishType) {
      const ways = new Set(model.methods(wishType).map(e => e.wayIndex));
      return [...ways].sort((a, b) => a - b);
    }

    // Real creatures for a wish and way; the way's own methods first, then the rest of the wish.
    function creaturesFor(wishType, wayIndex) {
      const all = model.methods(wishType);
      const own = all.filter(e => e.wayIndex === wayIndex);
      const rest = all.filter(e => e.wayIndex !== wayIndex);
      return [...own, ...rest];
    }

    function cleanText(value, max) {
      return String(value == null ? '' : value)
        .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
    }

    // Validate a record before it is stored. Returns the clean record or null.
    function cleanRecord(input) {
      if (!input || typeof input !== 'object') return null;
      const entry = model.get(input.catalogId);
      if (!entry) return null;
      const chosen = Array.isArray(input.wishTypes) ? input.wishTypes.filter(w => wishTypes.includes(w)) : [];
      const wishes = [...new Set([entry.wishType, ...chosen])].slice(0, MAX_WISHES);
      const hours = Array.isArray(input.hours)
        ? [...new Set(input.hours.map(Number).filter(h => Number.isInteger(h) && h >= 0 && h < 24))].sort((a, b) => a - b)
        : [];
      const years = Number.isInteger(Number(input.years)) ? Math.min(11, Math.max(0, Number(input.years))) : 0;
      return {
        catalogId: entry.id,
        wishType: entry.wishType,
        situationIndex: entry.situationIndex,
        wayIndex: entry.wayIndex,
        wishTypes: wishes,
        hours,
        years,
        message: cleanText(input.message, MAX_MESSAGE)
      };
    }

    return { wishTypes, waysFor, creaturesFor, cleanRecord, cleanText };
  }

  const api = { WISH_LABELS, WAYS, METHOD_LINES, YEARS, MAX_WISHES, MAX_MESSAGE, MAX_MOMENT, create };
  if (WishCatalog) Object.assign(api, create(WishCatalog));
  return api;
});
