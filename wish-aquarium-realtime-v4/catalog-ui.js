let selectedCatalogId = null;
let selectedWishType = null;

const wishDescriptions = {
  '가족 건강 기원형':'가족과 소중한 사람이 건강하기를 바라요',
  '결과 만들어내기형':'생각해 온 일을 실제 결과로 완성하고 싶어요',
  '공부 축적형':'차근차근 공부하며 지식을 쌓고 싶어요',
  '관계 회복형':'멀어진 마음을 돌보고 관계를 회복하고 싶어요',
  '교감·존재형':'서로의 존재를 느끼며 마음을 나누고 싶어요',
  '기술 숙련형':'한 가지 기술을 내 것으로 익히고 싶어요',
  '노년 신체 보존형':'시간이 흘러도 몸의 힘과 일상을 지키고 싶어요',
  '마지막 시간 연장형':'소중한 존재와 함께할 시간이 더 있었으면 해요',
  '병상 회복형':'아픔에서 회복해 편안한 일상으로 돌아가고 싶어요',
  '상승 경쟁형':'경쟁 속에서 한 단계 더 올라서고 싶어요',
  '생존 탈출·자유형':'생계를 압박하는 상황에서 벗어나고 싶어요',
  '소속 군체형':'함께 머물며 소속감을 느낄 곳이 필요해요',
  '습관 정착형':'좋은 습관을 내 일상에 자리 잡게 하고 싶어요',
  '안정 축적형':'생활을 지켜 줄 경제적 기반을 쌓고 싶어요',
  '언어 습득형':'새로운 언어로 더 넓은 세계와 만나고 싶어요',
  '역할 탈피형':'기대받던 역할에서 벗어나 자유롭게 살고 싶어요',
  '연인 융합형':'사랑하는 사람과 더 깊이 연결되고 싶어요',
  '운동 훈련형':'운동을 통해 몸과 마음의 힘을 기르고 싶어요',
  '자기 기준 정립형':'남의 평가보다 나의 기준을 세우고 싶어요',
  '장소 이탈형':'익숙한 장소를 떠나 다른 환경에서 살아 보고 싶어요',
  '투자 확장형':'가진 자원을 키워 선택의 폭을 넓히고 싶어요',
  '하고 싶은 일 지속형':'내가 좋아하는 일을 오래 이어 가고 싶어요',
  '형제·친구 동행형':'형제나 친구와 서로를 지지하며 함께하고 싶어요',
  '희귀 가치형':'나만의 희소한 가치를 경제적 가능성으로 키우고 싶어요'
};
const methodDescriptions = {
  '그냥하기 (신속형)':'완벽한 준비보다 지금 할 수 있는 행동부터 시작해요',
  '때를 기다리기':'내 방향을 믿고 알맞은 때를 기다려요',
  '낯선 환경 진입형':'새로운 환경에 직접 들어가 길을 찾아요',
  '비교 테스트형':'여러 방법을 비교하고 나에게 맞는 것을 골라요',
  '체험 샘플링형':'작게 경험해 보며 가능성을 확인해요',
  '기록 축적형':'기록을 남기며 작은 변화를 쌓아요',
  '반복 훈련형':'같은 행동을 반복하며 익숙하게 만들어요',
  '저장 비축형':'자원과 에너지를 모아 다음을 준비해요',
  '느린 재시작형':'잠시 멈춘 자리에서 천천히 다시 시작해요',
  '보호막 재생형':'나를 지켜 줄 조건부터 만들고 회복해요',
  '속도 조절형':'무리하지 않도록 지금의 속도를 조절해요',
  '역할 분담형':'함께할 사람과 각자의 역할을 나눠요',
  '함께 루틴형':'서로의 리듬에 맞춰 꾸준히 함께해요',
  '환경 적응형':'주변 환경과 관계를 살피며 방법을 조율해요',
  '내면 압축형':'바깥의 소음을 줄이고 내 안의 힘을 모아요',
  '심해 잠수형':'한 가지 일의 깊은 곳까지 집중해요',
  '관점 전환형':'같은 상황을 다른 시선으로 바라봐요',
  '한계 돌파형':'익숙한 한계 너머에 도전해요',
  '형태 전환형':'지금까지의 방식 자체를 바꿔 봐요'
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function resetCatalogSelection() {
  selectedCatalogId = null;
  selectedWishType = null;
}

// How many of the three answers on an axis pointed to a type, in plain words.
function signalText(score) {
  return score ? `세 질문 중 ${score}번` : '';
}

function showWishDetails(all = false) {
  clearTimeout(transitionTimer);
  setScene('question', 7);
  // Every direction the answers touched, closest first. Only directions with
  // real creatures become choices; an empty direction is named, never replaced.
  const ranked = rankAxis(answers, 0).filter(row => row.score > 0);
  const top = ranked[0];
  const topIsEmpty = top && !WishCatalog.directions(top.index).length;
  const groups = all ? [] : ranked
    .map(row => ({ row, items: WishCatalog.directions(row.index) }))
    .filter(group => group.items.length);
  const showEverything = all || !groups.length;
  const choices = showEverything ? WishCatalog.directions() : groups.flatMap(group => group.items);
  let message = '세 개의 답이 가리킨 소망부터 보여 드려요. 지금의 마음에 가장 가까운 모습을 골라 주세요.';
  if (topIsEmpty) message = `답변은 <strong>${escapeHtml(situations[top.index].label)}</strong>에 가장 가까웠어요. 이 방향의 생물은 아직 심해에서 깨어나는 중이라, ${groups.length ? '함께 가까웠던 소망부터 보여 드려요.' : '지금 만날 수 있는 소망 중에서 골라 주세요.'}`;
  else if (all) message = '지금 수족관에서 만날 수 있는 모든 소망이에요. 마음이 끌리는 쪽을 골라 주세요.';
  let index = 0;
  const optionButton = choice => `<button class="answer detail-choice" data-wish-index="${index}"><span class="num">${String(++index).padStart(2,'0')}</span><span><strong>${escapeHtml(choice.name)}</strong><small>${escapeHtml(wishDescriptions[choice.name] || choice.category)}</small></span></button>`;
  const body = showEverything
    ? `<div class="answers catalog-options">${choices.map(optionButton).join('')}</div>`
    : groups.map((group, order) => `<div class="choice-group${order === 0 && !topIsEmpty ? ' is-closest' : ''}">
        <p class="choice-group-head"><span>${escapeHtml(situations[group.row.index].label)}</span><span>${signalText(group.row.score)} 이 방향을 골랐어요${order === 0 && !topIsEmpty ? ' · 가장 가까움' : ''}</span></p>
        <div class="answers catalog-options">${group.items.map(optionButton).join('')}</div>
      </div>`).join('');
  app.innerHTML = `<section class="survey catalog-survey fade-in">
    <div class="survey-top"><button class="text-button" id="detail-back">← 이전 질문</button><span>소망의 세부 형태</span><span>07 / 08</span></div>
    <div class="progress"><div style="width:87.5%"></div></div>
    <div class="question-head"><div><span class="question-no">01 — 소망의 방향</span><h2>당신의 소망은<br>어떤 모습에 가까운가요?</h2></div></div>
    <p class="note">${message}</p>
    ${body}
    ${showEverything ? '' : '<button class="text-button show-all" id="other-wishes">다른 방향의 소망도 살펴보기 →</button>'}
  </section>`;
  app.querySelectorAll('[data-wish-index]').forEach(button=>button.onclick=()=>{
    selectedWishType = choices[Number(button.dataset.wishIndex)].name;
    selectedCatalogId = null;
    showMethodDetails();
  });
  document.querySelector('#detail-back').onclick=()=>{step=questions.length-1;renderQuestion();};
  const more = document.querySelector('#other-wishes');
  if(more) more.onclick=()=>showWishDetails(true);
  focusHeading();
}

function showMethodDetails() {
  setScene('question', 8);
  const choices = WishCatalog.methods(selectedWishType);
  if(!choices.length) { showWishDetails(true); return; }
  // Group the real methods under their way, ordered by how the answers ranked
  // the ways. Ways the answers never touched stay one tap away, not hidden.
  const ranked = rankAxis(answers, 1);
  const groups = ranked
    .map(row => ({ row, items: choices.filter(choice => choice.wayIndex === row.index) }))
    .filter(group => group.items.length);
  const near = groups.filter(group => group.row.score > 0);
  const rest = groups.filter(group => group.row.score === 0);
  const restOpen = !near.length || rest.some(group => group.items.some(item => item.id === selectedCatalogId));
  let number = 0;
  const groupMarkup = (group, order) => `<div class="choice-group${order === 0 && group.row.score ? ' is-closest' : ''}">
      <p class="choice-group-head"><span>${escapeHtml(ways[group.row.index].label)} · ${escapeHtml(ways[group.row.index].verb)}</span><span>${group.row.score ? `${signalText(group.row.score)} 이 방식을 골랐어요${order === 0 ? ' · 가장 가까움' : ''}` : ''}</span></p>
      <div class="answers catalog-options">${group.items.map(choice=>`<button class="answer detail-choice ${selectedCatalogId===choice.id?'selected':''}" data-creature-id="${choice.id}" aria-pressed="${selectedCatalogId===choice.id}"><span class="num">${String(++number).padStart(2,'0')}</span><span><strong>${escapeHtml(choice.methodType)}</strong><small>${escapeHtml(methodDescriptions[choice.methodType])}</small></span></button>`).join('')}</div>
    </div>`;
  app.innerHTML = `<section class="survey catalog-survey fade-in">
    <div class="survey-top"><button class="text-button" id="method-back">← 소망 다시 고르기</button><span>소망을 이루는 세부 방식</span><span>08 / 08</span></div>
    <div class="progress"><div style="width:100%"></div></div>
    <div class="question-head"><div><span class="question-no">02 — 소망을 키우는 방식</span><h2>이 소망을,<br>어떻게 키워 가고 싶나요?</h2></div></div>
    <p class="note"><strong>${escapeHtml(selectedWishType)}</strong> · 세 개의 답이 가리킨 방식부터 보여 드려요. 가장 자연스러운 하나를 골라 주세요.</p>
    ${near.map(groupMarkup).join('')}
    ${rest.length ? (near.length
      ? `<details class="more-choices"${restOpen ? ' open' : ''}><summary>다른 방식도 살펴보기</summary>${rest.map((group,order)=>groupMarkup(group, order + near.length)).join('')}</details>`
      : rest.map(groupMarkup).join('')) : ''}
    <div class="sticky-next"><button class="primary next" id="meet-creature" ${selectedCatalogId?'':'disabled'}>나의 소망생물 만나기 <span aria-hidden="true">↓</span></button></div>
  </section>`;
  app.querySelectorAll('[data-creature-id]').forEach(button=>button.onclick=()=>{
    selectedCatalogId = button.dataset.creatureId;
    app.querySelectorAll('[data-creature-id]').forEach(other=>{
      const chosen=other.dataset.creatureId===selectedCatalogId;
      other.classList.toggle('selected',chosen);other.setAttribute('aria-pressed',String(chosen));
    });
    document.querySelector('#meet-creature').disabled=false;
  });
  document.querySelector('#method-back').onclick=()=>showWishDetails();
  document.querySelector('#meet-creature').onclick=()=>{if(WishCatalog.get(selectedCatalogId)) discover();};
  focusHeading();
}

function catalogTank(entry) {
  return `<div class="tank catalog-tank" data-result-tank>
    <img class="catalog-poster" src="${entry.imageUrl}" alt="${escapeHtml(entry.folder)}" decoding="async">
    <video class="catalog-video" id="result-video" poster="${entry.imageUrl}" muted autoplay loop playsinline preload="metadata" aria-label="${escapeHtml(entry.folder)} 움직이는 소망생물"><source src="${escapeHtml(entry.videoUrl)}" type="video/mp4"></video>
    <div class="catalog-video-controls"><button class="glass-button" id="toggle-creature-video">영상 멈춤</button><span id="video-status" role="status">생물을 불러오고 있어요</span></div>
    <div class="tank-label"><strong>${entry.id}</strong><br>WISH AQUARIUM COLLECTION</div>
  </div>`;
}

function bindCreatureVideo() {
  const video=document.querySelector('#result-video');
  const toggle=document.querySelector('#toggle-creature-video');
  const status=document.querySelector('#video-status');
  video.muted=true;
  video.addEventListener('playing',()=>{status.textContent='';toggle.textContent='영상 멈춤';video.classList.add('is-playing');});
  video.addEventListener('pause',()=>{toggle.textContent='영상 재생';});
  video.addEventListener('error',()=>{video.classList.remove('is-playing');status.textContent='원본 이미지를 보여드리고 있어요. 영상은 다시 시도할 수 있어요.';toggle.textContent='영상 다시 불러오기';});
  video.querySelector('source').addEventListener('error',()=>video.dispatchEvent(new Event('error')));
  toggle.onclick=()=>{if(video.error){video.load();}if(video.paused){video.play().catch(()=>{status.textContent='한 번 더 눌러 영상을 재생해 주세요.';});}else video.pause();};
  if(motionPaused){video.pause();toggle.textContent='영상 재생';}else video.play().catch(()=>{toggle.textContent='영상 재생';status.textContent='버튼을 눌러 생물을 만나 보세요.';});
}
