/* The exhibition journey extends the original catalog, save and real-time contracts. */
(() => {
  'use strict';
  const original = {home, begin, renderQuestion, discover, showResult};
  let sceneVersion = 0, teardown = () => {};
  let story = emptyStory();
  let collectionFilter = -1, collectionPage = 0;
  const marks = ['01','02','03','04','05','06','07'];
  const shortWishes = ['생활의 안정','마음의 연결','나답게 살기','건강한 하루','새로운 성장','자유로운 선택','노력의 인정'];
  const shortWays = ['믿고 나아가기','새롭게 탐험하기','차곡차곡 쌓기','쉬며 회복하기','함께 살아가기','깊이 몰입하기','경계를 넘어서기'];
  const $ = selector => document.querySelector(selector);
  function emptyStory(){return {moment:'',rhythm:2,care:['작은 행동을 반복하기'],letter:'',seeded:false};}
  function resetScene(){
    clearTimeout(transitionTimer);teardown();teardown=()=>{};sceneVersion++;
    return sceneVersion;
  }
  function shell(kicker,title,body,actions='',className=''){
    resetScene();setScene('introduction');
    app.innerHTML='<section class="journey-page '+className+' fade-in"><div class="journey-kicker"><span>'+kicker+'</span><span>WISH AUCTION HOUSE</span></div><h1>'+title+'</h1>'+body+(actions?'<div class="journey-actions">'+actions+'</div>':'')+'</section>';
    focusHeading();
  }
  const nextButton = (id,label) => '<button class="primary" id="'+id+'">'+label+'<span aria-hidden="true">↗</span></button>';
  const backButton = (id,label='이전으로') => '<button class="text-button" id="'+id+'">← '+label+'</button>';
  function safelyStored(){
    try {const data=JSON.parse(localStorage.getItem('wish-auction-collection-v1')||'[]');return Array.isArray(data)?data.filter(item=>item&&WishCatalog.get(item.id)).slice(0,12):[];}catch(_){return [];}
  }
  home = function(){
    resetScene();story=emptyStory();document.body.dataset.journey='welcome';
    original.home();
    $('.welcome-title').innerHTML='<p class="overline">A PLACE FOR INVISIBLE WISHES</p><p class="english-title">What lives<br>in your wish?</p><h1>당신의 소망은<br>살아 있나요?</h1><p class="welcome-caption">마음 깊은 곳, 아직 만나지 못한 생물에게.</p>';
    $('#start').innerHTML='소망경매장 입장하기 <span aria-hidden="true">↗</span>';
    $('#start').onclick=showLobby;
  };
  function showLobby(){
    shell('00 / THE ENTRANCE','보이지 않던 마음에,<br>머물 곳을 내어주세요.',
      '<p class="page-lead">무엇을 바라는지, 어떻게 키워 가는지.<br>당신의 선택을 따라 한 마리의 소망생물을 만납니다.</p><nav class="lobby-grid" aria-label="소망경매장 안내">'+
      [['new-wish','01','나의 소망 발견하기','잠시 마음을 살피고, 나의 생물 만나기'],['my-creatures','02','내 생물 보관함','이 기기에 간직한 소망 다시 만나기'],['all-creatures','03','생물 도감','다양한 소망이 가진 모습 살펴보기'],['ocean-report','04','함께 사는 소망','공유수족관에 모인 실제 방류 기록']].map(x=>'<button class="lobby-item" id="'+x[0]+'"><span class="lobby-number">'+x[1]+'</span><span><strong>'+x[2]+'</strong><small>'+x[3]+'</small></span><span class="lobby-arrow" aria-hidden="true">↗</span></button>').join('')+'</nav>',
      '<span class="quiet-note">약 4–6분 · 정답 없는 창작 진단</span>'+backButton('lobby-about','프로젝트 소개'),'lobby');
    $('#new-wish').onclick=begin;$('#my-creatures').onclick=showCollection;$('#all-creatures').onclick=()=>showFieldGuide();$('#ocean-report').onclick=()=>showOceanReport();$('#lobby-about').onclick=()=>$('#about-dialog').showModal();
  }
  begin = function(){
    resetScene();story=emptyStory();currentResult=null;document.body.dataset.journey='diagnosis';original.begin();
  };
  renderQuestion = function(){
    resetScene();original.renderQuestion();
    document.body.dataset.journey='diagnosis';
    const section=app.querySelector('.survey');section.classList.add('editorial-survey');
    section.dataset.axis=String(questions[step].axis);
    if(step===0){
      app.querySelector('.answers').classList.add('wish-cloud');
      app.querySelectorAll('[data-choice]').forEach((button,index)=>{
        button.innerHTML='<span class="num">'+marks[index]+'</span><strong>'+shortWishes[index]+'</strong><small>'+questions[0].answers[index]+'</small><span class="selection-indicator" aria-hidden="true">＋</span>';
      });
    }
    if(step===4) bindCurrentQuestion();
    const oldNext=$('#next').onclick;
    $('#next').onclick=()=>{
      if(answers[step]===undefined)return;
      if(step===0){step=1;showMoment();return;}
      if(step===2){step=3;showSeed();return;}
      oldNext();
    };
    const oldBack=$('#back').onclick;
    $('#back').onclick=()=>{if(step===1)showMoment();else oldBack();};
    const note=$('.survey-top span');if(note)note.textContent=step<3?'CHAPTER 01 / 소망의 방향':'CHAPTER 02 / 소망의 리듬';
  };
  function showMoment(){
    shell('01 / A MOMENT IN YOUR LIFE','그 소망이,<br>간절했던 순간이 있나요?',
      '<div class="writing-layout"><p class="page-lead">아주 사소한 장면이어도 좋아요.<br>이 마음이 시작된 순간을 잠시 떠올려 보세요.</p><div class="writing-field"><label for="wish-moment">내 소망이 필요한 순간 <span>선택 입력</span></label><textarea id="wish-moment" maxlength="240" placeholder="예: 하고 싶은 일을 미루고 집으로 돌아오던 저녁.">'+escapeHtml(story.moment)+'</textarea><div class="field-meta"><span>이 글은 서버에 보내거나 저장하지 않아요.</span><output id="moment-count" for="wish-moment">'+story.moment.length+' / 240</output></div></div></div>',
      backButton('moment-back')+nextButton('moment-next','이 마음과 함께 내려가기'),'moment-page');
    $('#wish-moment').oninput=e=>{story.moment=e.target.value;$('#moment-count').textContent=story.moment.length+' / 240';};
    $('#moment-back').onclick=()=>{step=0;renderQuestion();};$('#moment-next').onclick=()=>{step=1;renderQuestion();};
  }
  function showSeed(){
    shell('01 → 02 / A LITTLE ATTENTION','작은 소망에,<br>잠시 마음을 모아주세요.',
      '<p class="page-lead">손끝을 머물게 하면 흩어진 빛이 모여요.<br>이제 이 소망을 어떻게 키울지 살펴볼 거예요.</p><div class="seed-stage"><button class="seed-hold" id="seed-hold" aria-label="길게 눌러 소망의 빛 모으기"><span class="seed-orbit" aria-hidden="true"></span><span class="seed-core" aria-hidden="true"></span><span class="seed-caption">길게 눌러 빛 모으기</span></button><output id="seed-status" aria-live="polite">손끝에 머무는 시간만큼</output></div>',
      backButton('seed-back')+nextButton('seed-next','터치 없이 계속하기'),'seed-page');
    $('#seed-back').onclick=()=>{step=2;renderQuestion();};
    const next=$('#seed-next'),orb=$('#seed-hold'),caption=orb.querySelector('.seed-caption');
    let held=false,started=0,frame=0,progress=0;
    const finish=()=>{held=false;story.seeded=true;orb.style.setProperty('--gather','1');orb.classList.add('gathered');caption.textContent='빛이 모였어요';$('#seed-status').textContent='당신의 소망이 조금 더 선명해졌어요.';next.textContent='이 소망을 키우러 가기 ↗';};
    const tick=now=>{if(!held)return;progress=Math.min(1,(now-started)/1500);orb.style.setProperty('--gather',String(progress));if(progress===1)finish();else frame=requestAnimationFrame(tick);};
    orb.onpointerdown=e=>{if(story.seeded)return;e.preventDefault();orb.setPointerCapture(e.pointerId);held=true;started=performance.now();frame=requestAnimationFrame(tick);};
    const stop=()=>{held=false;cancelAnimationFrame(frame);if(!story.seeded){progress=0;orb.style.setProperty('--gather','0');}};
    orb.onpointerup=stop;orb.onpointercancel=stop;orb.onlostpointercapture=stop;
    orb.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();finish();}};
    next.onclick=()=>{if(!story.seeded)finish();step=3;renderQuestion();};
    teardown=stop;
    if(motionPaused||story.seeded)finish();
  }
  function bindCurrentQuestion(){
    const answersBox=app.querySelector('.answers');
    const guide=document.createElement('div');guide.className='current-experiment';
    guide.innerHTML='<p>빛을 원하는 해류로 옮겨보세요. 항목을 눌러 선택할 수도 있어요.</p><button class="current-pearl" id="current-pearl" aria-label="일곱 가지 방식 중 원하는 항목으로 드래그"><span aria-hidden="true">✧</span><small>DRAG ME</small></button><p id="current-feedback" role="status">물살 앞에서, 당신만의 길을 찾아보세요.</p>';
    answersBox.before(guide);
    const orb=$('#current-pearl'),buttons=[...app.querySelectorAll('[data-choice]')];
    buttons.forEach((b,index)=>{b.dataset.current=String(index);});
    const highlight=event=>{
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-current]');
      buttons.forEach(b=>b.classList.toggle('drop-target',b===target));
      return target;
    };
    orb.onpointerdown=event=>{
      event.preventDefault();orb.setPointerCapture(event.pointerId);orb.classList.add('dragging');
      const origin=orb.getBoundingClientRect();
      orb.onpointermove=e=>{orb.style.transform='translate('+(e.clientX-(origin.left+origin.width/2))+'px,'+(e.clientY-(origin.top+origin.height/2))+'px)';highlight(e);};
      const end=e=>{
        const hit=highlight(e);orb.onpointermove=null;orb.classList.remove('dragging');orb.style.transform='';buttons.forEach(b=>b.classList.remove('drop-target'));
        if(hit){hit.click();$('#current-feedback').textContent=shortWays[Number(hit.dataset.choice)]+' — 이 해류를 골랐어요.';}
      };
      orb.onpointerup=end;orb.onpointercancel=()=>{orb.onpointermove=null;orb.style.transform='';orb.classList.remove('dragging');buttons.forEach(b=>b.classList.remove('drop-target'));};
    };
    orb.onclick=()=>{buttons[answers[step]??0].focus();$('#current-feedback').textContent='아래 방식 중 하나를 눌러 선택해 주세요.';};
  }
  discover = function(){
    const entry=WishCatalog.get(selectedCatalogId);if(!entry){showWishDetails();return;}
    shell('03 / YOUR WISH TAKES SHAPE','당신의 소망에,<br>하나의 모습이 생겼어요.',
      '<div class="encounter"><figure><img src="'+entry.imageUrl+'" alt="'+escapeHtml(entry.folder)+'"><figcaption>'+escapeHtml(entry.id)+' / WISH SPECIMEN</figcaption></figure><div><span class="overline">FIRST ENCOUNTER</span><h2>'+escapeHtml(entry.wishType)+'</h2><p>'+escapeHtml(wishDescriptions[entry.wishType]||entry.wishCategory)+'</p><span class="fine-rule"></span><h3>'+escapeHtml(entry.methodType)+'</h3><p>'+escapeHtml(methodDescriptions[entry.methodType]||'')+'</p><p class="quiet-note">당신의 선택과 연결된 생물이에요.<br>형태를 바꾸려면 소망이나 키우는 방식을 다시 살펴보세요.</p></div></div>',
      backButton('encounter-back','다른 방식 살펴보기')+nextButton('encounter-next','이 생물과 함께하기'),'encounter-page');
    $('#encounter-back').onclick=showMethodDetails;$('#encounter-next').onclick=showRhythm;
  };
  function showRhythm(){
    const labels=['잠에서 깨어날 때','하루를 시작할 때','마음이 흔들릴 때','잠시 쉬어갈 때','잠들기 전'];
    shell('04 / WHEN TO REMEMBER','당신의 하루 중,<br>언제 이 소망을 떠올릴까요?',
      '<p class="page-lead">빛을 움직여 마음이 닿는 시간을 찾아보세요.<br>이 선택은 생물의 유형을 바꾸지 않아요.</p><div class="rhythm-experiment"><div class="rhythm-arc" aria-hidden="true"><span>새벽</span><i id="rhythm-glow"></i><span>밤</span></div><label class="rhythm-answer" id="rhythm-answer" for="wish-rhythm">'+labels[story.rhythm]+'</label><input type="range" id="wish-rhythm" min="0" max="4" step="1" value="'+story.rhythm+'" aria-valuetext="'+labels[story.rhythm]+'"><div class="range-labels"><span>하루의 시작</span><span>하루의 끝</span></div></div>',
      backButton('rhythm-back')+nextButton('rhythm-next','나의 돌봄 정하기'),'rhythm-page');
    const sync=()=>{$('#rhythm-answer').textContent=labels[story.rhythm];$('#wish-rhythm').setAttribute('aria-valuetext',labels[story.rhythm]);$('#rhythm-glow').style.left=(story.rhythm*25)+'%';};sync();
    $('#wish-rhythm').oninput=e=>{story.rhythm=Number(e.target.value);sync();};
    $('#rhythm-back').onclick=discover;$('#rhythm-next').onclick=showCare;
  }
  function showCare(){
    const options=['작은 행동을 반복하기','나에게 쉴 틈을 주기','누군가와 마음 나누기','기록하며 돌아보기','새로운 일 시도하기'];
    shell('05 / A WAY TO GROW','이 소망을 위해,<br>어떤 마음을 내어줄 수 있나요?',
      '<p class="page-lead">소망은 한 번의 다짐보다 작은 돌봄으로 자라요.<br>지금 할 수 있는 일을 세 가지까지 골라주세요.</p><div class="care-options">'+options.map((x,i)=>'<button class="care-card '+(story.care.includes(x)?'selected':'')+'" data-care="'+i+'" aria-pressed="'+story.care.includes(x)+'"><span class="care-symbol" aria-hidden="true">'+['∴','◒','∞','≋','↗'][i]+'</span><span>'+x+'</span><i aria-hidden="true">＋</i></button>').join('')+'</div><p class="care-status" id="care-status" aria-live="polite"></p>',
      backButton('care-back')+nextButton('care-next','나에게 한마디 남기기'),'care-page');
    $('#care-next').disabled=!story.care.length;
    app.querySelectorAll('[data-care]').forEach(button=>button.onclick=()=>{
      const value=options[Number(button.dataset.care)],found=story.care.indexOf(value);
      if(found>=0)story.care.splice(found,1);else if(story.care.length<3)story.care.push(value);else{$('#care-status').textContent='지금 실천할 수 있는 세 가지에 마음을 모아볼까요?';return;}
      button.classList.toggle('selected',story.care.includes(value));button.setAttribute('aria-pressed',String(story.care.includes(value)));
      $('#care-status').textContent=story.care.length+' / 3개의 돌봄을 골랐어요.';$('#care-next').disabled=!story.care.length;
    });
    $('#care-back').onclick=showRhythm;$('#care-next').onclick=showLetter;
  }
  function showLetter(){
    shell('06 / A NOTE TO YOURSELF','이 소망을 품은 나에게,<br>어떤 말을 건네고 싶나요?',
      '<div class="writing-layout"><p class="page-lead">쉽게 잊지 않았으면 하는 한마디.<br>생물을 다시 만날 때, 이 마음도 함께 떠올려주세요.</p><div class="writing-field"><label for="wish-letter">나에게 남기는 말 <span>선택 입력</span></label><textarea id="wish-letter" maxlength="160" placeholder="예: 조금 느려도 괜찮아. 네가 좋아하는 걸 잊지 마.">'+escapeHtml(story.letter)+'</textarea><div class="field-meta"><span>글은 이번 체험 화면에만 남아요. 방류 시 전송되지 않아요.</span><output id="letter-count" for="wish-letter">'+story.letter.length+' / 160</output></div></div></div>',
      backButton('letter-back')+nextButton('letter-next','나의 소망생물 만나기'),'letter-page');
    $('#wish-letter').oninput=e=>{story.letter=e.target.value;$('#letter-count').textContent=story.letter.length+' / 160';};
    $('#letter-back').onclick=showCare;$('#letter-next').onclick=showResult;
  }
  showResult = function(){
    resetScene();document.body.dataset.journey='result';
    if(!WishCatalog.get(selectedCatalogId)){currentResult=null;showWishDetails();return;}
    const previous=currentResult,wasReleased=realtime.released;
    original.showResult();
    if(!currentResult)return;
    if(previous?.entry.id===currentResult.entry.id){currentResult.clientReleaseId=previous.clientReleaseId;realtime.released=wasReleased;syncRealtimeControls();}
    const entry=currentResult.entry;
    const careText=story.care.map(x=>escapeHtml(x)).join(' · ');
    const rhythm=['잠에서 깨어날 때','하루를 시작할 때','마음이 흔들릴 때','잠시 쉬어갈 때','잠들기 전'][story.rhythm];
    const record=app.querySelector('.record');
    record.innerHTML='<div class="record-item"><h3>이 마음이 시작된 순간</h3><p>'+escapeHtml(story.moment||'아직 말로 다 담지 못한, 지금의 마음.')+'</p></div><div class="record-item"><h3>소망을 돌보는 나만의 리듬</h3><p>'+rhythm+' · '+careText+'</p></div>'+(story.letter?'<div class="record-item personal-letter"><h3>이 소망을 품은 나에게</h3><p>“'+escapeHtml(story.letter)+'”</p></div>':'');
    const panel=app.querySelector('.result-actions-panel');
    panel.querySelector('.overline').textContent='FROM MY WISH TO OUR OCEAN';
    $('#result-actions-title').textContent='혼자 품던 소망을, 함께 살아가는 소망으로.';
    panel.querySelector('.action-intro').textContent='먹어 내 안에 품기, 이름을 부르며 기리기, 이미지로 간직하기. 소망을 대하는 방식은 여러 가지예요. 공유수족관에 놓아주면 서로의 바람을 바라보고 응원하는 풍경에 함께할 수 있어요.';
    $('#release-creature').innerHTML='<span><small>추천 / SHARED AQUARIUM</small>공유수족관에 방류하기</span><span aria-hidden="true">↗</span>';
    const explanation=document.createElement('p');explanation.className='release-note';explanation.textContent='함께 모인 소망은 서로를 응원하는 힘이 됩니다. 방류는 작품 속 참여 방식이며, 소망의 실제 실현을 보장하지 않아요.';panel.appendChild(explanation);
    const extras=document.createElement('div');extras.className='result-secondary';
    extras.innerHTML='<button class="text-button" id="keep-local">이 기기에 생물 보관하기 ＋</button><button class="text-button" id="read-ocean">함께 사는 소망 보기 ↗</button><a class="text-button" href="/shared-aquarium" target="_blank" rel="noopener">공유수족관 열기 ↗</a><p class="quiet-note">보관함에는 생물 종류만 저장해요. 입력한 글은 저장하지 않아요.</p>';
    panel.after(extras);
    $('#keep-local').onclick=()=>{
      try {const items=safelyStored().filter(x=>x.id!==entry.id);items.unshift({id:entry.id,at:new Date().toISOString()});localStorage.setItem('wish-auction-collection-v1',JSON.stringify(items.slice(0,12)));$('#keep-local').textContent='이 기기에 보관했어요 ✓';}
      catch(_){announceResultAction('이 기기에서 보관을 허용하지 않아요. 이미지 저장을 이용해 주세요.','error');}
    };
    $('#read-ocean').onclick=()=>showOceanReport(entry);
    $('#restart').onclick=home;syncRealtimeControls();
  };
  function collectionCard(entry){
    return '<button class="specimen-card" data-open-specimen="'+entry.id+'"><div><img loading="lazy" decoding="async" src="'+entry.imageUrl+'" alt="'+escapeHtml(entry.folder)+'"></div><span>'+escapeHtml(entry.id)+'</span><h2>'+escapeHtml(entry.wishType)+'</h2><p>'+escapeHtml(entry.methodType)+'</p></button>';
  }
  function openSpecimen(entry,back){
    shell('THE FIELD GUIDE / '+entry.id,escapeHtml(entry.wishType),
      '<div class="encounter"><figure><img src="'+entry.imageUrl+'" alt="'+escapeHtml(entry.folder)+'"><figcaption>'+escapeHtml(entry.methodType)+'</figcaption></figure><div><h2>'+escapeHtml(entry.wishCategory)+'</h2><p>'+escapeHtml(wishDescriptions[entry.wishType]||'')+'</p><h3>'+escapeHtml(entry.methodType)+'</h3><p>'+escapeHtml(methodDescriptions[entry.methodType]||'')+'</p><p class="quiet-note">도감은 생물을 살펴보는 곳이에요.<br>나의 생물은 소망 탐사를 통해 만나주세요.</p></div></div>',
      backButton('specimen-back','목록으로')+nextButton('specimen-begin','나의 소망 발견하기'),'specimen-detail');
    $('#specimen-back').onclick=back;$('#specimen-begin').onclick=begin;
  }
  function bindCards(back){
    app.querySelectorAll('[data-open-specimen]').forEach(button=>button.onclick=()=>{const entry=WishCatalog.get(button.dataset.openSpecimen);if(entry)openSpecimen(entry,back);});
  }
  function showCollection(){
    const saved=safelyStored();
    shell('MY CREATURES / LOCAL COLLECTION','한때 마음에 머물렀던,<br>나의 소망들.',
      '<p class="page-lead">이 기기에 직접 보관한 생물만 보여드려요.<br>공용 iPad라면 다음 관객을 위해 보관함을 비워주세요.</p>'+(saved.length?'<div class="specimen-grid">'+saved.map(x=>collectionCard(WishCatalog.get(x.id))).join('')+'</div><button class="text-button" id="clear-collection">이 기기의 보관함 비우기</button>':'<div class="empty-water"><span aria-hidden="true">∴</span><p>아직 보관한 소망생물이 없어요.<br>탐사를 마친 뒤 직접 간직할 수 있어요.</p></div>'),
      backButton('collection-back','입구로')+nextButton('collection-begin','새로운 소망 만나기'),'collection-page');
    $('#collection-back').onclick=showLobby;$('#collection-begin').onclick=begin;
    const clear=$('#clear-collection');if(clear)clear.onclick=()=>{try{localStorage.removeItem('wish-auction-collection-v1');showCollection();}catch(_){clear.textContent='이 기기에서 보관함을 비우지 못했어요.';}};
    bindCards(showCollection);
  }
  function showFieldGuide(filter=collectionFilter,page=0){
    collectionFilter=filter;collectionPage=page;
    const filtered=WishCatalog.entries.filter(x=>filter<0||x.situationIndex===filter),shown=filtered.slice(0,(page+1)*12);
    shell('THE FIELD GUIDE / '+WishCatalog.entries.length+' SPECIMENS','소망은 저마다,<br>다른 모습으로 살아갑니다.',
      '<p class="page-lead">실제로 제작된 소망생물의 기록을 살펴보세요.</p><div class="guide-filters" role="group" aria-label="소망 분류">'+[-1,0,1,2,3,4,5,6].map(i=>'<button class="'+(i===filter?'active':'')+'" data-filter="'+i+'" aria-pressed="'+(i===filter)+'">'+(i<0?'모든 소망':situations[i].label)+'</button>').join('')+'</div>'+(shown.length?'<div class="specimen-grid">'+shown.map(collectionCard).join('')+'</div>':'<div class="empty-water"><p>이 방향의 생물은 아직 준비 중이에요.<br>다른 소망의 생물을 살펴보세요.</p></div>')+(shown.length<filtered.length?'<button class="load-more" id="guide-more">생물 더 보기 ('+shown.length+' / '+filtered.length+') ＋</button>':''),
      backButton('guide-back','입구로')+nextButton('guide-begin','나의 소망 발견하기'),'guide-page');
    app.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>showFieldGuide(Number(b.dataset.filter)));
    const more=$('#guide-more');if(more)more.onclick=()=>{const previousY=window.scrollY;showFieldGuide(collectionFilter,collectionPage+1);window.scrollTo(0,previousY);};
    $('#guide-back').onclick=showLobby;$('#guide-begin').onclick=begin;bindCards(()=>showFieldGuide(collectionFilter,collectionPage));
  }
  async function showOceanReport(entry=null){
    shell('OUR OCEAN / LIVE RECORD','혼자만의 소망이<br>아니었어요.',
      '<p class="page-lead">지금 공유수족관에 머무는 소망들을 살펴보세요.<br>서로 다른 바람이 모여 하나의 풍경이 됩니다.</p><div class="ocean-report" id="ocean-report-content" role="status">수족관의 실제 기록을 읽어오고 있어요.</div>',
      backButton('report-back',entry?'내 생물로':'입구로')+nextButton('report-end','마음에 간직하며 나가기'),'report-page');
    const version=sceneVersion;$('#report-back').onclick=entry?showResult:showLobby;$('#report-end').onclick=showFarewell;
    const abort=new AbortController();teardown=()=>abort.abort();const timer=setTimeout(()=>abort.abort(),8000);
    try{
      const base=String(aquariumConfig.socketUrl||'').replace(/\/$/,'');
      const response=await fetch(base+'/api/aquarium-summary',{signal:abort.signal,cache:'no-store'});
      if(!response.ok)throw Error('summary-unavailable');
      const data=await response.json();if(version!==sceneVersion)return;
      if(!Array.isArray(data.directions)||!Number.isFinite(data.total))throw Error('invalid-summary');
      const same=entry?data.directions[entry.situationIndex]?.count||0:0;
      $('#ocean-report-content').innerHTML='<div class="report-numbers"><div><strong>'+data.total+'</strong><span>지금 함께하는 소망생물</span></div>'+(entry?'<div><strong>'+same+'</strong><span>나와 같은 방향의 소망</span></div>':'')+'</div><p class="quiet-note">현재 서버가 유지 중인 최근 최대 '+Number(data.retentionHours.toFixed(2))+'시간의 방류 기록이에요.<br>서버 재시작·보관 개수 제한에 따라 달라지며, 전체 관객의 설문 통계가 아니에요.</p><div class="report-bars">'+data.directions.map((d,i)=>'<div class="report-row"><span>'+escapeHtml(situations[i].label)+'</span><div><i style="width:'+(data.total?Math.round(d.count/data.total*100):0)+'%"></i></div><strong>'+Number(d.count)+'</strong></div>').join('')+'</div>'+(data.total===0?'<p class="report-message">아직 이 바다에 도착한 소망이 없어요.<br>당신의 생물이 첫 번째가 되어도 좋아요.</p>':'<p class="report-message">같은 소망도, 서로 다른 방법으로 자라고 있어요.<br>전시장 수족관에서 그 만남을 지켜봐 주세요.</p>')+'<a class="text-button" href="/shared-aquarium" target="_blank" rel="noopener">함께 헤엄치는 생물들 보기 ↗</a>';
    }catch(error){
      if(version!==sceneVersion)return;
      $('#ocean-report-content').innerHTML='<p>지금은 공유수족관 기록에 연결하지 못했어요.<br>연결을 확인한 뒤 다시 시도해 주세요.</p><button class="text-button" id="retry-report">다시 불러오기 ↻</button>';
      $('#retry-report').onclick=()=>showOceanReport(entry);
    }finally{clearTimeout(timer);}
  }
  function showFarewell(){
    shell('UNTIL YOUR WISH COMES TRUE','당신의 소망이<br>살아갈 날들을 기다릴게요.',
      '<p class="page-lead">오늘 발견한 마음이 일상에서도 잊히지 않기를.<br>다른 소망들과 함께, 천천히 자라나기를.</p><div class="farewell-mark" aria-hidden="true">∴</div>',
      '<button class="text-button" id="farewell-guide">다른 소망 둘러보기 ↗</button>'+nextButton('farewell-exit','다음 관객을 위해 처음으로'),'farewell-page');
    $('#farewell-guide').onclick=()=>showFieldGuide();$('#farewell-exit').onclick=home;
  }
  const menu=document.querySelector('#journey-menu');if(menu)menu.onclick=showLobby;
  // A short, session-local letter is intentionally never sent to the server.
  window.WishJourney={showLobby,showMoment,showSeed,showRhythm,showCare,showLetter,showFieldGuide,showCollection,showOceanReport,showFarewell};
  home();
})();

