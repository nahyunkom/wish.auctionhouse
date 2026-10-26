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
  const canvas = createCanvas(windowWidth, windowHeight);
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
  // No arrival graphics or text over the aquarium.
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
    this.baseHeight = windowHeight*(.025+.18*Math.pow(1-this.depth,2))*this.scale;
    this.x = isNew ? width*.5 : width*(data.exhibitionResident?data.screenX:seededNoise(this.seed,2));
    this.y = isNew ? height*.53 : height*(data.exhibitionResident?data.screenY:.32+seededNoise(this.seed,3)*.60);
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
    const drawHeight = Math.min(this.baseHeight,windowWidth*.30/ratio);
    const drawWidth = drawHeight * ratio;
    const texture = AquariumEnvironment.texture(this.image);
    const angle = aquariumMotionReduced?0:Math.sin(age * .00035 + this.phase) * .018;
    if(pixelRenderer?.draw(texture,this.image.silhouette,{
      x:this.x,y:this.y,width:drawWidth,height:drawHeight,angle,time:age/1000,
      phase:this.phase,alpha:arrivalAlpha,reducedMotion:aquariumMotionReduced
    }))return;
    const context = drawingContext;
    context.save();
    context.globalAlpha = arrivalAlpha;
    context.globalCompositeOperation = 'source-over';
    context.globalCompositeOperation = AquariumEnvironment.composite();
    context.translate(this.x, this.y);
    context.rotate(angle);
    AquariumSprite.draw(context,texture,this.image.silhouette,drawWidth,drawHeight,age/1000,this.phase,aquariumMotionReduced);
    context.restore();
  }
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
  resizeCanvas(windowWidth, windowHeight);
  for (const swimmer of swimmers) {
    swimmer.y = constrain(swimmer.y, height * .12, height * .86);
    swimmer.baseY = swimmer.y;
    swimmer.baseHeight = windowHeight*(.025+.18*Math.pow(1-swimmer.depth,2))*swimmer.scale;
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
