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
    this.x = isNew ? width*.5 : width*(data.exhibitionResident?data.screenX:seededNoise(this.seed,2));
    this.y = isNew ? height*.53 : height*(data.exhibitionResident?residentY(data,this.seed):.32+seededNoise(this.seed,3)*.60);
    this.baseY = this.y;
    this.speed = this.direction*(3+(1-this.depth)*8+seededNoise(this.seed,4)*3);
    this.bobAmount = 3 + seededNoise(this.seed, 6) * 3;
    this.phase = seededNoise(this.seed, 5) * TWO_PI;
    this.bornAt = millis();
    this.lastUpdateAt = this.bornAt;
    this.isNew = isNew;
  }

  update() {
    const now = millis();
    const seconds = Math.min(.1, Math.max(0, now - this.lastUpdateAt) / 1000);
    this.lastUpdateAt = now;
    if(aquariumMotionReduced)return;
    this.x += this.speed * seconds;
    this.y = this.baseY + Math.sin((now - this.bornAt) * .00045 + this.phase) * this.bobAmount;
    const margin = this.baseHeight * 1.2;
    if (this.direction > 0 && this.x > width + margin) this.x = -margin;
    if (this.direction < 0 && this.x < -margin) this.x = width + margin;
  }

  draw() {
    if (!this.image?.width || this.image.silhouette.empty) return;
    const age = Math.max(0, millis() - this.bornAt);
    const arrivalAlpha = (this.isNew ? Math.min(1, age / 1400) : 1) * this.waterAlpha;
    const bounds=this.image.silhouette.bounds;
    const ratio=bounds.width/bounds.height;
    const drawHeight = Math.min(this.baseHeight,viewW()*(portraitView()?.5:.30)/ratio);
    const drawWidth = drawHeight * ratio;
    const texture = AquariumEnvironment.texture(this.image);
    const angle = aquariumMotionReduced?0:Math.sin(age * .00035 + this.phase) * .018;
    const look = underwaterLook(this.depth);
    // Near a visitor's touch the water in front of a creature stirs: its outline
    // ripples more and the moving light on it brightens a little.
    const lit = AquariumEnvironment.presenceLight ? AquariumEnvironment.presenceLight(this.x, this.y) : 0;
    if (lit > .01) { look.wobble += lit * 2.4; look.light += lit * .9; look.fog *= 1 - lit * .35; }
    if(pixelRenderer?.draw(texture,this.image.silhouette,{
      x:this.x,y:this.y,width:drawWidth,height:drawHeight,angle,time:age/1000,
      phase:this.phase,alpha:arrivalAlpha,reducedMotion:aquariumMotionReduced,
      world:millis()/1000,...look
    }))return;
    const context = drawingContext;
    context.save();
    context.globalAlpha = arrivalAlpha;
    context.globalCompositeOperation = 'source-over';
    context.globalCompositeOperation = AquariumEnvironment.composite();
    context.translate(this.x, this.y);
    context.rotate(angle);
    if('filter' in context)context.filter=`blur(${look.blur.toFixed(1)}px)`;
    AquariumSprite.draw(context,texture,this.image.silhouette,drawWidth,drawHeight,age/1000,this.phase,aquariumMotionReduced);
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
    const swimmer = swimmers[swimmers.length - 1];
    if (AquariumEnvironment.burst) AquariumEnvironment.burst(swimmer.x, swimmer.y);
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
