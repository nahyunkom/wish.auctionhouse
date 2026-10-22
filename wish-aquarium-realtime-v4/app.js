const app = document.querySelector('#app');
const aquariumConfig = window.WISH_AQUARIUM_CONFIG || {};

let step = -1;
let answers = [];
let greetingChoice = '';
let transitionTimer;
let currentResult = null;
let motionPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const realtime = {
  socket: null,
  connected: false,
  loading: false,
  released: false,
  releasing: false,
  error: ''
};

const specimen = (way = 0, situation = 0, extraClass = '') => {
  const entry = WishCatalog.entries.find(item => item.wayIndex === way && item.situationIndex === situation) || WishCatalog.entries[0];
  return '<div class="specimen catalog-specimen ' + extraClass + '" role="img" aria-label="' + escapeHtml(entry.folder) + '" style="background-image:url(\'' + entry.imageUrl + '\')"></div>';
};

function focusHeading() {
  const heading = app.querySelector('h1,h2');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function setScene(name, index = 0) {
  document.body.dataset.scene = name;
  document.documentElement.style.setProperty('--scene-turn', `${index * 11 - 14}deg`);
  document.documentElement.style.setProperty('--scene-hue', `${index * 13}deg`);
}

function stage(content, extraClass = '') {
  app.innerHTML = `<section class="intro-stage ${extraClass} fade-in">${content}</section>`;
  focusHeading();
}

function home() {
  clearTimeout(transitionTimer);
  step = -1;
  answers = [];
  greetingChoice = '';
  currentResult = null;
  resetCatalogSelection();
  realtime.released = false;
  realtime.releasing = false;
  setScene('welcome');
  stage(`
    <div class="welcome-title">
      <p class="overline">소망경매장 · 심해 수족관</p>
      <p class="english-title">What lives<br>in your wish?</p>
      <h1>당신의 소망은<br>살아 있나요?</h1>
      <p class="welcome-caption">아직 이름 없는 마음을 만나는 곳.</p>
    </div>
    <div class="intro-bottom">
      <button class="glass-button wide" id="start">수족관 들어가기 <span aria-hidden="true">↗</span></button>
      <span class="micro">화면을 터치하면, 소망의 입자가 반응합니다.</span>
    </div>
  `, 'welcome');
  document.querySelector('#start').onclick = greet;
}

function greet() {
  setScene('greeting', 1);
  stage(`
    <div class="conversation">
      <span class="overline">첫 번째 인사</span>
      <h1>안녕하세요.<br>오늘, 마음은 어떠세요?</h1>
      <p>수면 위에 두고 온 마음을<br>잠깐 들여다볼까요?</p>
      <div class="greeting-choices">
        <button class="glass-button" data-mood="bright">설레는 마음이에요</button>
        <button class="glass-button" data-mood="heavy">조금 지쳐 있어요</button>
        <button class="glass-button" data-mood="unsure">아직 잘 모르겠어요</button>
      </div>
    </div>
    <div class="intro-bottom"><button class="text-button" id="skip">바로 소망 탐사하기 →</button></div>
  `);
  app.querySelectorAll('[data-mood]').forEach((button) => {
    button.onclick = () => {
      greetingChoice = button.dataset.mood;
      greetingReply();
    };
  });
  document.querySelector('#skip').onclick = begin;
}

function greetingReply() {
  setScene('reply', greetingChoice === 'heavy' ? 4 : 2);
  const copy = {
    bright: ['그 설렘이,<br>어떤 빛이 될지 궁금해요.', '작은 기대도 이곳에서는<br>하나의 생명으로 자라납니다.'],
    heavy: ['여기서는 잠시,<br>느리게 흘러가도 괜찮아요.', '서두르지 않아도 돼요.<br>지금 품고 있는 마음부터 만나 보세요.'],
    unsure: ['아직 이름이 없어도,<br>분명 살아 있는 마음이 있어요.', '잘 모르겠다는 마음에서<br>탐사를 시작해도 괜찮아요.']
  }[greetingChoice];
  stage(`
    <div class="conversation">
      <span class="overline">당신의 마음에 보내는 답장</span>
      <h1>${copy[0]}</h1>
      <p>${copy[1]}</p>
    </div>
    <div class="intro-bottom">
      <button class="glass-button wide" id="continue">조금 더 깊이 들어가기 <span>↓</span></button>
      <button class="text-button" id="prev">← 이전으로</button>
    </div>
  `);
  document.querySelector('#continue').onclick = introduction;
  document.querySelector('#prev').onclick = greet;
}

function introduction() {
  setScene('introduction', 3);
  stage(`
    <div class="conversation intro-explanation">
      <span class="overline">소망경매장에 오신 것을 환영합니다</span>
      <h1>당신이 품은 소망,<br>이곳에서는 생물이 됩니다.</h1>
      <p>무엇을 바라는지, 어떻게 키워 가는지.<br>두 마음이 만나 고유한 소망생물로 깨어납니다.</p>
      <div class="axis-cards">
        <div><span>01</span><h2>무엇을 바라나요?</h2><p>지금, 내 소망의 방향</p></div>
        <span class="axis-times" aria-hidden="true">×</span>
        <div><span>02</span><h2>어떻게 키우나요?</h2><p>소망을 향해 가는 방식</p></div>
      </div>
      <p class="intro-small">정답은 없어요. 오늘의 나와 가장 가까운 답을 골라 주세요.<br>6개의 질문 · 약 2분</p>
    </div>
    <div class="intro-bottom">
      <button class="glass-button wide" id="dive">나의 소망생물 만나기 <span>↓</span></button>
      <button class="text-button" id="prev">← 이전으로</button>
    </div>
  `);
  document.querySelector('#dive').onclick = begin;
  document.querySelector('#prev').onclick = greetingReply;
}

function begin() {
  resetCatalogSelection();
  step = 0;
  answers = [];
  renderQuestion();
}

function renderQuestion() {
  clearTimeout(transitionTimer);
  setScene('question', step + 3);
  const question = questions[step];
  const depth = String(step * 500).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  app.innerHTML = `
    <section class="survey fade-in">
      <div class="survey-top">
        <button class="text-button" id="back">← ${step === 0 ? '처음으로' : '이전 질문'}</button>
        <span>수심 ${depth} M</span>
        <span>${String(step + 1).padStart(2, '0')} / 08</span>
      </div>
      <div class="progress" role="progressbar" aria-label="진단 진행률" aria-valuemin="0" aria-valuemax="8" aria-valuenow="${step + 1}">
        <div style="width:${(step + 1) / 8 * 100}%"></div>
      </div>
      <div class="question-head">
        <div>
          <span class="question-no">${question.axis === 0 ? '01 — 소망의 방향' : '02 — 소망을 키우는 방식'}</span>
          <h2>${question.title.replace('\n', '<br>')}</h2>
        </div>
        ${specimen(step % 7, 0, 'tiny-creature')}
      </div>
      <p class="note">${question.note}</p>
      <div class="answers" role="group" aria-label="답변 선택">
        ${question.answers.map((answer, index) => `
          <button class="answer ${answers[step] === index ? 'selected' : ''}" data-choice="${index}" aria-pressed="${answers[step] === index}">
            <span class="num">${String(index + 1).padStart(2, '0')}</span><span>${answer}</span>
          </button>`).join('')}
      </div>
      <button class="primary next" id="next" ${answers[step] === undefined ? 'disabled' : ''}>
        ${step === 5 ? '소망의 세부 형태 고르기' : '다음 수심으로'} <span aria-hidden="true">↓</span>
      </button>
    </section>`;

  app.querySelectorAll('[data-choice]').forEach((button) => {
    button.onclick = () => {
      answers[step] = Number(button.dataset.choice);
      app.querySelectorAll('[data-choice]').forEach((candidate) => {
        const selected = Number(candidate.dataset.choice) === answers[step];
        candidate.classList.toggle('selected', selected);
        candidate.setAttribute('aria-pressed', selected);
      });
      document.querySelector('#next').disabled = false;
    };
  });

  document.querySelector('#back').onclick = () => {
    if (step === 0) home();
    else {
      step -= 1;
      renderQuestion();
    }
  };
  document.querySelector('#next').onclick = () => {
    if (answers[step] === undefined) return;
    if (step < 5) {
      step += 1;
      renderQuestion();
    } else showWishDetails();
  };
  focusHeading();
}

function discover() {
  setScene('discovery', 9);
  app.innerHTML = `
    <section class="loading fade-in" role="status">
      ${specimen(0, 0)}
      <div class="scan-line"></div>
      <h2>당신의 소망에<br>생명이 깃들고 있어요.</h2>
      <p>여섯 개의 신호를 따라<br>심해 속 소망생물을 만나러 갑니다.</p>
    </section>`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  transitionTimer = setTimeout(showResult, 2200);
}

function makeReleaseId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `wish-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showResult() {
  const entry = WishCatalog.get(selectedCatalogId);
  if (!entry) { showWishDetails(); return; }
  setScene('result', 6);
  const situation=entry.situationIndex, way=entry.wayIndex;
  const creature={id:entry.id,name:entry.folder,situation:situations[situation],way:ways[way]};
  currentResult={situation,way,creature,entry,clientReleaseId:makeReleaseId()};
  realtime.released=false;
  realtime.releasing=false;
  app.innerHTML = `
    <section class="result fade-in">
      <div class="result-grid">
        ${catalogTank(entry)}
        <div class="result-info">
          <div class="result-title">
            <div class="eyebrow">탐사 완료 — 당신의 소망생물</div>
            <h1>${escapeHtml(entry.wishType)}<br><span class="result-method-title">${escapeHtml(entry.methodType)}</span></h1>
            <p class="result-lead">${escapeHtml(wishDescriptions[entry.wishType])}<br><strong>${escapeHtml(methodDescriptions[entry.methodType])}</strong></p>
            <div class="chips"><span class="chip">${escapeHtml(entry.wishCategory)}</span><span class="chip">${escapeHtml(ways[way].label)}</span></div>
          </div>
          <div class="record">
            <div class="record-item"><h3>당신이 품은 소망</h3><p>${escapeHtml(wishDescriptions[entry.wishType])}</p></div>
            <div class="record-item"><h3>소망을 키우는 방식</h3><p>${escapeHtml(methodDescriptions[entry.methodType])}</p></div>
            ${entry.caption ? '<div class="record-item"><h3>생물의 기록</h3><p lang="en">'+escapeHtml(entry.caption)+'</p></div>' : ''}
          </div>
          <section class="result-actions-panel" aria-labelledby="result-actions-title">
            <p class="overline">YOUR CREATURE, YOUR CHOICE</p>
            <h2 id="result-actions-title">이 생물은 어디에 머물게 할까요?</h2>
            <p class="action-intro">이미지로 간직하거나, 모두가 함께 보는 심해 수족관에 풀어줄 수 있어요.</p>
            <div class="result-action-buttons">
              <button class="primary release-button" id="release-creature" disabled><span><small>LIVE AQUARIUM</small>공유 수족관에 방류하기</span><span aria-hidden="true">↗</span></button>
              <button class="save-button" id="save-creature"><span><small>KEEP YOUR WISH</small>내 생물 이미지 저장하기</span><span aria-hidden="true">↓</span></button>
            </div>
            <div class="action-meta"><span class="connection-state" id="connection-state" data-state="connecting"><i aria-hidden="true"></i><span>공유 수족관 연결 중</span></span><span>이메일 입력 없이 바로 저장해요.</span></div>
            <p class="result-action-status" id="result-action-status" role="status" aria-live="polite"></p>
          </section>
          <p class="result-foot">이 생물은 지금 당신이 품은 소망의 한 모습입니다.<br>마음이 달라지면, 또 다른 생물을 만날 수 있어요.</p>
          <button class="text-restart" id="restart">다른 소망으로 다시 탐사하기 <span aria-hidden="true">↻</span></button>
        </div>
      </div>
    </section>`;
  document.querySelector('#release-creature').onclick=releaseCreature;
  document.querySelector('#save-creature').onclick=saveCreatureImage;
  document.querySelector('#restart').onclick=home;
  bindCreatureVideo();
  syncRealtimeControls();
  focusHeading();
}

function announceResultAction(message, state = '') {
  const status = document.querySelector('#result-action-status');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function syncRealtimeControls() {
  const button = document.querySelector('#release-creature');
  const indicator = document.querySelector('#connection-state');
  if (!button || !indicator) return;

  const label = indicator.querySelector('span');
  if (realtime.released) {
    indicator.dataset.state = 'connected';
    label.textContent = '공유 수족관에 방류됨';
    button.disabled = true;
    button.classList.add('is-released');
    button.innerHTML = '<span><small>RELEASED</small>공유 수족관에서 헤엄치는 중</span><span aria-hidden="true">✓</span>';
    return;
  }

  if (realtime.releasing) {
    indicator.dataset.state = 'connecting';
    label.textContent = '생물을 보내는 중';
    button.disabled = true;
    return;
  }

  if (realtime.connected) {
    indicator.dataset.state = 'connected';
    label.textContent = '공유 수족관 연결됨';
    button.disabled = false;
  } else {
    indicator.dataset.state = 'offline';
    label.textContent = realtime.error || '공유 수족관 연결 대기 중';
    button.disabled = true;
  }
}

function loadRealtimeClient() {
  if (realtime.loading || realtime.socket) return;
  realtime.loading = true;
  const baseUrl = String(aquariumConfig.socketUrl || '').replace(/\/$/, '');
  const script = document.createElement('script');
  script.src = `${baseUrl}/socket.io/socket.io.js`;
  script.async = true;
  const timer = window.setTimeout(() => {
    if (!realtime.socket) {
      realtime.error = '공유 수족관 서버 확인 중';
      syncRealtimeControls();
    }
  }, Number(aquariumConfig.connectionTimeoutMs) || 8000);

  script.onload = () => {
    window.clearTimeout(timer);
    realtime.loading = false;
    connectRealtime(baseUrl);
  };
  script.onerror = () => {
    window.clearTimeout(timer);
    realtime.loading = false;
    realtime.error = '공유 수족관 서버가 아직 열리지 않았어요';
    syncRealtimeControls();
  };
  document.head.appendChild(script);
}

function connectRealtime(baseUrl) {
  if (typeof window.io !== 'function') {
    realtime.error = '공유 수족관 연결을 불러오지 못했어요';
    syncRealtimeControls();
    return;
  }
  const options = {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    timeout: Number(aquariumConfig.connectionTimeoutMs) || 8000
  };
  realtime.socket = baseUrl ? window.io(baseUrl, options) : window.io(options);
  realtime.socket.on('connect', () => {
    realtime.connected = true;
    realtime.error = '';
    syncRealtimeControls();
  });
  realtime.socket.on('disconnect', () => {
    realtime.connected = false;
    syncRealtimeControls();
  });
  realtime.socket.on('connect_error', () => {
    realtime.connected = false;
    realtime.error = '공유 수족관 연결을 기다리는 중';
    syncRealtimeControls();
  });
}

function releaseCreature() {
  if (!currentResult || realtime.released || realtime.releasing) return;
  if (!realtime.socket || !realtime.connected) {
    announceResultAction('공유 수족관과 연결된 뒤 다시 눌러 주세요.', 'error');
    return;
  }

  realtime.releasing = true;
  announceResultAction('당신의 생물이 전시장 수족관으로 이동하고 있어요.', 'pending');
  syncRealtimeControls();
  const payload = {
    catalogId: currentResult.entry.id,
    clientReleaseId: currentResult.clientReleaseId
  };

  realtime.socket.timeout(Number(aquariumConfig.connectionTimeoutMs) || 8000).emit('creature:release', payload, (error, response) => {
    realtime.releasing = false;
    if (error || !response?.ok) {
      announceResultAction(response?.message || '방류하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.', 'error');
      syncRealtimeControls();
      return;
    }
    realtime.released = true;
    announceResultAction('방류되었습니다. 지금 전시장 화면에서 헤엄치기 시작해요.', 'success');
    const resultTank = document.querySelector('[data-result-tank]');
    if (resultTank) resultTank.insertAdjacentHTML('beforeend', '<div class="release-bloom" aria-hidden="true"></div>');
    syncRealtimeControls();
  });
}

function seededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = text.split(' ');
  let line = '';
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      lineIndex += 1;
      line = word;
      if (lineIndex >= maxLines) break;
    } else line = candidate;
  }
  if (line && lineIndex < maxLines) context.fillText(line, x, y + lineIndex * lineHeight);
}

function loadResultImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function createResultCardBlob() {
  const response=await fetch(currentResult.entry.imageUrl);
  if(!response.ok)throw new Error('생물 이미지를 불러오지 못했습니다.');
  return response.blob();
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
}

async function saveCreatureImage() {
  if (!currentResult) return;
  const button = document.querySelector('#save-creature');
  const originalMarkup = button.innerHTML;
  button.disabled = true;
  button.classList.add('is-busy');
  button.innerHTML = '<span><small>CREATING IMAGE</small>생물 이미지를 만드는 중</span><span aria-hidden="true">···</span>';
  announceResultAction('원본 생물 이미지를 준비하고 있어요.', 'pending');

  try {
    const blob = await createResultCardBlob();
    const safeName = currentResult.creature.name.replace(/[\\/:*?"<>|]/g, '-');
    const filename = `소망경매장_${safeName}_${currentResult.creature.id}.png`;
    const file = new File([blob], filename, { type: 'image/png' });
    let canShare = false;
    try {
      canShare = Boolean(navigator.share && navigator.canShare?.({ files: [file] }));
    } catch (_) {
      canShare = false;
    }
    if (canShare) {
      await navigator.share({
        files: [file],
        title: `나의 소망생물 · ${currentResult.creature.name}`,
        text: '소망경매장에서 발견한 나의 소망생물입니다.'
      });
      announceResultAction('휴대폰의 저장·공유 메뉴로 원본 이미지를 보냈어요.', 'success');
    } else {
      downloadBlob(blob, filename);
      announceResultAction('생물 이미지가 저장되었습니다.', 'success');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') announceResultAction('이미지를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('is-busy');
    button.innerHTML = originalMarkup;
  }
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function updateMotion() {
  document.body.classList.toggle('motion-paused', motionPaused);
  const video=document.querySelector('#result-video');
  if(video){if(motionPaused)video.pause();else video.play().catch(()=>{});}
  document.querySelector('#motion').setAttribute('aria-pressed', String(motionPaused));
  document.querySelector('#motion').textContent = motionPaused ? '움직임 재생' : '움직임 멈춤';
}

document.querySelector('#motion').onclick = () => {
  motionPaused = !motionPaused;
  updateMotion();
};
updateMotion();
reduceMotion.addEventListener('change', (event) => {
  motionPaused = event.matches;
  updateMotion();
});

const aboutDialog = document.querySelector('#about-dialog');
document.querySelector('#about').onclick = () => aboutDialog.showModal();
document.querySelector('#close-about').onclick = () => aboutDialog.close();
aboutDialog.addEventListener('click', (event) => {
  if (event.target === aboutDialog) aboutDialog.close();
});
document.querySelector('#home-link').onclick = (event) => {
  event.preventDefault();
  home();
};

home();
loadRealtimeClient();

