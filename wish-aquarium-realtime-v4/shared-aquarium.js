const displayConfig = window.WISH_AQUARIUM_CONFIG || {};
const creatureTextures = new Map();
const textureQueue = [];
let activeTextureLoads = 0;
const swimmers = [];
const residentSwimmers = [];
let socket = null;
let pixelRenderer = null;
const aquariumMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let aquariumMotionReduced = aquariumMotionPreference.matches;
aquariumMotionPreference.addEventListener('change', event => { aquariumMotionReduced=event.matches; });

function preload() {}

// Aquarium size follows the view (portrait display or rotated projector).
const viewW = () => window.AquariumView ? AquariumView.width() : windowWidth;
const viewH = () => window.AquariumView ? AquariumView.height() : windowHeight;
const portraitView = () => viewH() > viewW() * 1.05;
// Creature scale comes from the shorter side, so portrait keeps landscape sizes.
const sizeBasis = () => Math.min(viewW(), viewH());
// In portrait the curated bottom-heavy layout is spread over the tall water column.
function residentY(data, seed) {
  if (!portraitView()) return data.screenY;
  return .14 + (.5 * seededNoise(seed, 3) + .5 * data.screenY) * .8;
}

// Keep original PNGs intact; bound only the projection's in-memory textures.
function getCreatureTexture(url) {
  if (creatureTextures.has(url)) return creatureTextures.get(url);
  if (creatureTextures.size >= 128) creatureTextures.delete(creatureTextures.keys().next().value);
  const promise = new Promise(resolve => { textureQueue.push({url,resolve}); });
  creatureTextures.set(url,promise);
  pumpTextureQueue();
  return promise;
}

function pumpTextureQueue() {
  while(activeTextureLoads < 2 && textureQueue.length) {
    const job=textureQueue.shift();
    activeTextureLoads++;
    const finish=image=>{activeTextureLoads--;job.resolve(image);pumpTextureQueue();};
    loadImage(job.url, loaded=>{
      try {
      const longest=Math.max(loaded.width,loaded.height);
      if(longest>768) loaded.resize(Math.max(1,Math.round(loaded.width*768/longest)),Math.max(1,Math.round(loaded.height*768/longest)));
      loaded.loadPixels();
      loaded.silhouette = AquariumSprite.mask(loaded.pixels,loaded.width,loaded.height);
      loaded.updatePixels();
      finish(loaded);
      } catch(error) {
        console.warn('Could not prepare aquarium PNG',job.url,error);
        creatureTextures.delete(job.url);
        finish(null);
      }
    }, ()=>{creatureTextures.delete(job.url);finish(null);});
  }
}

function setup() {
  if (window.AquariumView) AquariumView.apply();
  const canvas = createCanvas(viewW(), viewH());
  canvas.parent('canvas-host');
  pixelRenderer = AquariumSprite.createRenderer(document.querySelector('#canvas-host'));
  pixelDensity(Math.min(window.devicePixelRatio || 1, 1.75));
  frameRate(60);
  imageMode(CENTER);
  noStroke();
  for(const data of window.AQUARIUM_RESIDENTS || []) residentSwimmers.push(new WishSwimmer(data));
  connectAquarium();
}

function draw() {
  // Clear every frame: screen blending over old pixels bleaches PNG colors.
  AquariumEnvironment.background(drawingContext,width,height,millis()/1000);
  // Water is rendered in real time; no photograph is used.
  if(pixelRenderer)pixelRenderer.begin(width,height,Math.min(window.devicePixelRatio||1,1.75),AquariumEnvironment.composite());
  for (const swimmer of [...residentSwimmers,...swimmers].sort((a,b)=>b.depth-a.depth)) {
    swimmer.update();
    swimmer.draw();
  }
  // Bubbles and near, out-of-focus particles pass in front of the creatures.
  if(AquariumEnvironment.foreground)AquariumEnvironment.foreground(width,height,millis()/1000);
  // No arrival text over the aquarium; a release is marked only by rising bubbles.
}

// Creatures whose wish is to belong (소속 군체형) swim as a small school: several
// small copies of the same original PNG moving together, loosely, like fish.
const SCHOOL_WISH = '소속 군체형';
// Birth of a released creature, in seconds: gather → outline → wake.
const BIRTH_WAKE = 3.6, BIRTH_TOTAL = 6;
const smooth01 = v => { const x = Math.min(1, Math.max(0, v)); return x * x * (3 - 2 * x); };
const isSchooling = data => data.school === true || data.wishType === SCHOOL_WISH;

class WishSwimmer {
  constructor(data, isNew = false) {
    this.data = data;
    this.id = data.id;
    this.image = null;
    if(typeof data.imageUrl==='string' && /^assets\/catalog\/WC-[a-f0-9]{12}\.png$/.test(data.imageUrl)) {
      getCreatureTexture(data.imageUrl).then(loaded=>{this.image=loaded;});
    }
    this.seed = Number(data.seed) || Math.floor(Math.random() * 100000);
    this.direction = this.seed % 2 ? 1 : -1;
    this.depth = data.exhibitionResident ? data.depth : .18+seededNoise(this.seed,8)*.65;
    this.scale = .9+seededNoise(this.seed,1)*.2;
    this.waterAlpha = .30 + (1-this.depth)*.54;
    this.baseHeight = sizeBasis()*(.025+.18*Math.pow(1-this.depth,2))*this.scale;
    // A released wish is born near the light column, a little off-centre each time.
    this.x = isNew ? width*(.4+seededNoise(this.seed,2)*.2) : width*(data.exhibitionResident?data.screenX:seededNoise(this.seed,2));
    this.y = isNew ? height*(.4+seededNoise(this.seed,3)*.2) : height*(data.exhibitionResident?residentY(data,this.seed):.32+seededNoise(this.seed,3)*.60);
    this.baseY = this.y;
    this.speed = this.direction*(3+(1-this.depth)*8+seededNoise(this.seed,4)*3);
    this.bobAmount = 3 + seededNoise(this.seed, 6) * 3;
    // A slow wander up and down, so creatures drift rather than glide on rails.
    this.wander = 10 + seededNoise(this.seed, 9) * 28;
    this.phase = seededNoise(this.seed, 5) * TWO_PI;
    this.bornAt = millis();
    this.lastUpdateAt = this.bornAt;
    this.isNew = isNew;
    // Birth timeline (seconds since the PNG was ready); null until then.
    this.birthAt = null;
    this.school = isSchooling(data) ? this.makeSchool() : null;
    this.vy = 0;
    // How stirred this creature is by a visitor's light (rises fast, settles slowly).
    this.stir = 0;
    this.shy = 0;
  }

  makeSchool() {
    // Schools swim a little quicker than single drifters.
    this.speed *= 1.5;
    this.wander *= 1.4;
    const count = 7 + Math.floor(seededNoise(this.seed, 11) * 5);
    const members = [];
    for (let i = 0; i < count; i++) {
      const a = seededNoise(this.seed, 20 + i) * TWO_PI, r = Math.sqrt(seededNoise(this.seed, 40 + i));
      members.push({
        ox: Math.cos(a) * r * 3.8, oy: Math.sin(a) * r * 1.7,
        size: .7 + seededNoise(this.seed, 60 + i) * .45,
        phase: seededNoise(this.seed, 80 + i) * TWO_PI,
        x: this.x, y: this.y, vx: 0, vy: 0
      });
    }
    return members;
  }

  update() {
    const now = millis();
    let seconds = Math.min(.1, Math.max(0, now - this.lastUpdateAt) / 1000);
    this.lastUpdateAt = now;
    if(aquariumMotionReduced)return;
    const t = (now - this.bornAt) / 1000;
    const born = this.birthProgress();
    if (born < 1) {
      // Held in the light while forming; afterwards it eases into swimming.
      const free = Math.max(0, Math.min(1, (born * BIRTH_TOTAL - BIRTH_WAKE) / 2.5));
      if (free <= 0) { this.y = this.baseY + Math.sin(t * .9 + this.phase) * 2; this.vy = 0; if (this.school) for (const m of this.school) { m.x = this.x; m.y = this.y; } return; }
      seconds *= free;
    }
    const before = this.x, beforeY = this.y;
    // Touched by the stirred light or a passing light ring, a creature brightens,
    // quickens a little and eases away from the hand, then calms.
    const touch = Math.min(1, (AquariumEnvironment.presenceLight ? AquariumEnvironment.presenceLight(this.x, this.y) : 0)
      + (AquariumEnvironment.ringLight ? AquariumEnvironment.ringLight(this.x, this.y) * .45 : 0));
    this.stir += (touch - this.stir) * Math.min(1, seconds * (touch > this.stir ? 2.2 : .45));
    const hand = AquariumEnvironment.presenceState ? AquariumEnvironment.presenceState() : null;
    const away = hand && hand.energy > .02 ? Math.sign(this.baseY + this.shy - hand.y || 1) : 0;
    this.shy += (away * this.stir * sizeBasis() * .07 - this.shy) * Math.min(1, seconds * .8);
    this.x += this.speed * (1 + .3 * Math.sin(t * .07 + this.phase) + this.stir * 1.1) * seconds;
    this.y = this.baseY + this.shy + Math.sin(t * .45 + this.phase) * this.bobAmount
      + Math.sin(t * .06 + this.phase * 1.7) * this.wander * Math.min(1.4, sizeBasis() / 1080);
    this.vy = seconds ? (this.y - beforeY) / seconds : 0;
    const margin = this.baseHeight * (this.school ? 4 : 1.2);
    if (this.direction > 0 && this.x > width + margin) this.x = -margin;
    if (this.direction < 0 && this.x < -margin) this.x = width + margin;
    if (this.school) {
      const jump = this.x - before - this.speed * seconds * (1 + .3 * Math.sin(t * .07 + this.phase) + this.stir * 1.1);
      const unit = this.memberHeight();
      // The school breathes: it tightens and loosens slowly.
      // A stirred school scatters outward, then gathers itself again.
      const spread = (.8 + .3 * Math.sin(t * .13 + this.phase)) * (1 + this.stir * 1.3);
      for (const m of this.school) {
        if (Math.abs(jump) > 1) m.x += jump;
        const tx = this.x + (m.ox * spread + Math.sin(t * .5 + m.phase) * .35) * unit;
        const ty = this.y + (m.oy * spread + Math.cos(t * .43 + m.phase) * .3) * unit;
        // Each fish follows its place with a soft spring, so turns ripple through the group.
        m.vx += ((tx - m.x) * 1.5 - m.vx * 1.7) * seconds;
        m.vy += ((ty - m.y) * 1.5 - m.vy * 1.7) * seconds;
        m.x += (m.vx + this.speed * .15) * seconds;
        m.y += m.vy * seconds;
      }
    }
  }

  memberHeight() { return this.baseHeight * .42; }

  // 0 → 1 over the whole birth; 1 for residents and once born.
  birthProgress() {
    if (!this.isNew) return 1;
    if (this.birthAt === null) return 0;
    return Math.min(1, (millis() - this.birthAt) / 1000 / BIRTH_TOTAL);
  }

  // Sample the creature's real outline (and some of its body) from the display copy
  // of its original PNG, as offsets in screen pixels around its centre.
  birthPoints(drawWidth, drawHeight) {
    const img = this.image, b = img.silhouette.bounds, px = img.pixels, w = img.width;
    if (!px) return [];
    const edge = [], body = [];
    const step = Math.max(1, Math.round(Math.sqrt(b.width * b.height / 9000)));
    for (let y = b.y + 1; y < b.y + b.height - 1; y += step) {
      for (let x = b.x + 1; x < b.x + b.width - 1; x += step) {
        const a = px[(y * w + x) * 4 + 3];
        if (a < 140) continue;
        const near = Math.min(px[(y * w + x - step) * 4 + 3] || 0, px[(y * w + x + step) * 4 + 3] || 0, px[((y - step) * w + x) * 4 + 3] || 0, px[((y + step) * w + x) * 4 + 3] || 0);
        (near < 60 ? edge : body).push([x, y]);
      }
    }
    const pick = (list, n) => { const out = []; for (let i = 0; i < n && list.length; i++) out.push(list[Math.floor(seededNoise(this.seed, 300 + i * 7 + out.length) * list.length)]); return out; };
    const chosen = [...pick(edge, 110), ...pick(body, 60)];
    return chosen.map(([x, y]) => ({ dx: ((x - b.x) / b.width - .5) * drawWidth, dy: ((y - b.y) / b.height - .5) * drawHeight }));
  }

  draw() {
    if (!this.image?.width || this.image.silhouette.empty) return;
    const age = Math.max(0, millis() - this.bornAt);
    const bounds=this.image.silhouette.bounds;
    const ratio=bounds.width/bounds.height;
    const texture = AquariumEnvironment.texture(this.image);
    const look = underwaterLook(this.depth);
    // Birth: light gathers into this creature's outline, then it wakes from the light.
    if (this.isNew && this.birthAt === null) {
      this.birthAt = millis();
      if (!aquariumMotionReduced && AquariumEnvironment.birth) {
        const h = Math.min(this.baseHeight, viewW() * (portraitView() ? .5 : .30) / ratio);
        AquariumEnvironment.birth(this.birthPoints(h * ratio, h), this.x, this.y);
      }
    }
    let arrivalAlpha = this.waterAlpha;
    if (this.isNew) {
      const bt = this.birthProgress() * BIRTH_TOTAL;
      if (aquariumMotionReduced) arrivalAlpha *= Math.min(1, bt / 1.4);
      else if (bt < BIRTH_TOTAL) {
        const k = smooth01((bt - 2.2) / (BIRTH_WAKE - 2.2));
        const flash = Math.exp(-Math.pow((bt - BIRTH_WAKE) / .3, 2));
        arrivalAlpha *= k;
        look.blur += (1 - k) * 7;
        look.light += (1 - k) * 2 + flash * 1.4;
        look.fog *= k;
        look.wobble += (1 - k) * 3;
      }
    }
    // Near a visitor's touch the water in front of a creature stirs: its outline
    // ripples more and the moving light on it brightens a little.
    // Stirred creatures glow from within in a slow pulse and come out of the haze.
    const st = this.stir;
    if (st > .01) {
      const pulse = .75 + .25 * Math.sin(age * .004 + this.phase);
      look.wobble += st * 2.2;
      look.light += st * 1.6 * pulse;
      look.fog *= 1 - st * .6;
      look.blur *= 1 - st * .45;
    }
    // Gentle tilt with the climb or descent.
    const slope = aquariumMotionReduced ? 0 : Math.max(-.18, Math.min(.18, this.vy / Math.max(4, Math.abs(this.speed)) * .25));
    if (this.school) {
      const unit = this.memberHeight();
      for (const m of this.school) {
        const h = Math.min(unit * m.size, viewW() * .12 / ratio);
        const tilt = aquariumMotionReduced ? 0 : Math.max(-.3, Math.min(.3, m.vy / Math.max(6, Math.abs(this.speed) * 1.5) * .3)) * this.direction;
        this.drawOne(texture, ratio, m.x, m.y, h, tilt + Math.sin(age * .0011 + m.phase) * .04, age, m.phase, arrivalAlpha * (.85 + .15 * m.size), look);
      }
      return;
    }
    const drawHeight = Math.min(this.baseHeight,viewW()*(portraitView()?.5:.30)/ratio);
    const angle = aquariumMotionReduced?0:Math.sin(age * .00035 + this.phase) * .018 + slope * this.direction;
    this.drawOne(texture, ratio, this.x, this.y, drawHeight, angle, age, this.phase, arrivalAlpha, look);
  }

  drawOne(texture, ratio, x, y, drawHeight, angle, age, phase, alpha, look) {
    const drawWidth = drawHeight * ratio;
    if(pixelRenderer?.draw(texture,this.image.silhouette,{
      x,y,width:drawWidth,height:drawHeight,angle,time:age/1000,
      phase,alpha,reducedMotion:aquariumMotionReduced,
      world:millis()/1000,...look
    }))return;
    const context = drawingContext;
    context.save();
    context.globalAlpha = alpha;
    context.globalCompositeOperation = 'source-over';
    context.globalCompositeOperation = AquariumEnvironment.composite();
    context.translate(x, y);
    context.rotate(angle);
    if('filter' in context)context.filter=`blur(${look.blur.toFixed(1)}px)`;
    AquariumSprite.draw(context,texture,this.image.silhouette,drawWidth,drawHeight,age/1000,phase,aquariumMotionReduced);
    context.restore();
  }
}

// Water softens everything: farther creatures blur and take on the water colour,
// the nearest ones pass by out of focus. Display only; source PNGs are untouched.
function underwaterLook(depth) {
  const d = Math.min(1, Math.max(0, Number(depth) || 0));
  const nearOutOfFocus = d < .12 ? (.12 - d) / .12 * 3 : 0;
  return {
    blur: .9 + d * 2.6 + nearOutOfFocus,
    fog: d * .5,
    fogColor: [.03, .33, .66],
    wobble: 1.1 + (1 - d) * 1.3,
    light: .9 * (1 - d * .6)
  };
}

function seededNoise(seed, offset) {
  const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function addCreature(data, isNew = true) {
  if (!data || swimmers.some((swimmer) => swimmer.id === data.id)) return;
  swimmers.push(new WishSwimmer(data, isNew));
  if (swimmers.length > 120) swimmers.splice(0, swimmers.length - 120);
  updateCount();
  if (isNew) {
    // The birth sequence (light gathering into the creature) starts once its PNG is ready.
    showArrival(data.name || '새로운 소망생물');
  }
}

function syncAquariumState(data) {
  swimmers.length = 0;
  for (const creature of data?.creatures || []) addCreature(creature, false);
  updateCount();
}

function updateCount() { /* No counter on the exhibition screen. */ }

function showArrival() { /* Keep the screen free of arrival labels. */ }

function setLiveState() { /* Connection state remains internal. */ }

function connectAquarium() {
  const baseUrl = String(displayConfig.socketUrl || '').replace(/\/$/, '');
  const script = document.createElement('script');
  script.src = `${baseUrl}/socket.io/socket.io.js`;
  script.async = true;
  script.onload = () => {
    const options = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000
    };
    socket = baseUrl ? window.io(baseUrl, options) : window.io(options);
    socket.on('connect', () => setLiveState('connected', 'LIVE · 공유 수족관 연결됨'));
    socket.on('disconnect', () => setLiveState('offline', '연결 복구 중'));
    socket.on('connect_error', () => setLiveState('offline', '수족관 서버 연결 대기 중'));
    socket.on('aquarium:state', syncAquariumState);
    socket.on('creature:released', (creature) => addCreature(creature, true));
  };
  script.onerror = () => setLiveState('offline', '수족관 서버를 찾지 못함');
  document.head.appendChild(script);
}

function windowResized() {
  if (window.AquariumView) AquariumView.apply();
  resizeCanvas(viewW(), viewH());
  for (const swimmer of residentSwimmers) {
    swimmer.baseY = height * residentY(swimmer.data, swimmer.seed);
    swimmer.y = swimmer.baseY;
    swimmer.baseHeight = sizeBasis()*(.025+.18*Math.pow(1-swimmer.depth,2))*swimmer.scale;
  }
  for (const swimmer of swimmers) {
    swimmer.y = constrain(swimmer.y, height * .12, height * .86);
    swimmer.baseY = swimmer.y;
    swimmer.baseHeight = sizeBasis()*(.025+.18*Math.pow(1-swimmer.depth,2))*swimmer.scale;
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const request=document.documentElement.requestFullscreen?.();
    request?.catch(()=>{});
  } else {
    const exit=document.exitFullscreen?.();
    exit?.catch(()=>{});
  }
}

function keyPressed() {
  if (key === 'f' || key === 'F') toggleFullscreen();
}

document.querySelector('#fullscreen-button').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const button=document.querySelector('#fullscreen-button');
  const label=document.fullscreenElement ? '전체 화면 닫기' : '전체 화면';
  button.textContent=label;button.setAttribute('aria-label',label);
});
