const displayConfig = window.WISH_AQUARIUM_CONFIG || {};
const creatureTextures = new Map();
const textureQueue = [];
let activeTextureLoads = 0;
const swimmers = [];
const arrivals = [];
let socket = null;
let arrivalTimer = null;
let firstFrame = true;
let backgroundParticles = [];

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
  pixelDensity(Math.min(window.devicePixelRatio || 1, 1.75));
  frameRate(60);
  imageMode(CENTER);
  noStroke();
  backgroundParticles = Array.from({ length: 190 }, (_, index) => makeBackgroundParticle(index));
  connectAquarium();
}

function draw() {
  // Clear every frame: screen blending over old pixels bleaches PNG colors.
  background(0);
  firstFrame = false;
  drawBackgroundParticles();
  for (const swimmer of swimmers) {
    swimmer.update();
    swimmer.draw();
  }
  drawArrivalRipples();
}

function makeBackgroundParticle(index) {
  const randomSeedValue = (index + 1) * 13.71;
  return {
    x: noise(randomSeedValue) * windowWidth,
    y: noise(randomSeedValue + 20) * windowHeight,
    size: .5 + noise(randomSeedValue + 40) * 1.8,
    speed: .04 + noise(randomSeedValue + 60) * .18,
    phase: noise(randomSeedValue + 80) * TWO_PI
  };
}

function drawBackgroundParticles() {
  blendMode(ADD);
  for (const particle of backgroundParticles) {
    particle.x += particle.speed;
    particle.y += Math.sin(frameCount * .005 + particle.phase) * .035;
    if (particle.x > width + 4) particle.x = -4;
    fill(74, 176, 186, 35 + particle.size * 14);
    circle(particle.x, particle.y, particle.size);
  }
  blendMode(BLEND);
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
    this.scale = .72 + seededNoise(this.seed, 1) * .7;
    this.baseHeight = Math.min(windowHeight * .31, Math.max(150, windowWidth * .16)) * this.scale;
    this.x = isNew ? width * .5 : seededNoise(this.seed, 2) * width;
    this.y = isNew ? height * .53 : height * (.16 + seededNoise(this.seed, 3) * .68);
    this.baseY = this.y;
    this.speed = this.direction * (4 + seededNoise(this.seed, 4) * 5);
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
    this.x += this.speed * seconds;
    this.y = this.baseY + Math.sin((now - this.bornAt) * .00045 + this.phase) * this.bobAmount;
    const margin = this.baseHeight * 1.2;
    if (this.direction > 0 && this.x > width + margin) this.x = -margin;
    if (this.direction < 0 && this.x < -margin) this.x = width + margin;
  }

  draw() {
    if (!this.image?.width || this.image.silhouette.empty) return;
    const age = Math.max(0, millis() - this.bornAt);
    const arrivalAlpha = this.isNew ? Math.min(1, age / 1400) : 1;
    const bounds=this.image.silhouette.bounds;
    const ratio=bounds.width/bounds.height;
    const drawHeight = Math.min(this.baseHeight,windowWidth*.30/ratio);
    const drawWidth = drawHeight * ratio;
    const context = drawingContext;
    context.save();
    context.globalAlpha = arrivalAlpha;
    context.globalCompositeOperation = 'source-over';
    context.translate(this.x, this.y);
    context.rotate(Math.sin(age * .00035 + this.phase) * .018);
    AquariumSprite.draw(context,this.image.canvas,this.image.silhouette,drawWidth,drawHeight,age/1000,this.phase);
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
    arrivals.push({ x: width * .5, y: height * .53, bornAt: millis() });
    showArrival(data.name || '새로운 소망생물');
  }
}

function syncAquariumState(data) {
  swimmers.length = 0;
  for (const creature of data?.creatures || []) addCreature(creature, false);
  updateCount();
}

function updateCount() {
  document.querySelector('#creature-count').textContent = String(swimmers.length).padStart(2, '0');
}

function showArrival(name) {
  const panel = document.querySelector('#arrival');
  document.querySelector('#arrival-name').textContent = name;
  panel.classList.add('is-visible');
  window.clearTimeout(arrivalTimer);
  arrivalTimer = window.setTimeout(() => panel.classList.remove('is-visible'), 4000);
}

function drawArrivalRipples() {
  for (let index = arrivals.length - 1; index >= 0; index -= 1) {
    const age = millis() - arrivals[index].bornAt;
    if (age > 2600) {
      arrivals.splice(index, 1);
      continue;
    }
    const progress = age / 2600;
    noFill();
    stroke(124, 215, 221, 110 * (1 - progress));
    strokeWeight(1.2);
    circle(arrivals[index].x, arrivals[index].y, 60 + progress * Math.min(width, height) * .9);
    stroke(181, 200, 119, 70 * (1 - progress));
    circle(arrivals[index].x, arrivals[index].y, 30 + progress * Math.min(width, height) * .65);
    noStroke();
  }
}

function setLiveState(state, label) {
  const element = document.querySelector('#live-state');
  element.dataset.state = state;
  element.querySelector('span').textContent = label;
}

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
  backgroundParticles = Array.from({ length: 190 }, (_, index) => makeBackgroundParticle(index));
  for (const swimmer of swimmers) {
    swimmer.y = constrain(swimmer.y, height * .12, height * .86);
    swimmer.baseY = swimmer.y;
    swimmer.baseHeight = Math.min(windowHeight * .31, Math.max(150, windowWidth * .16)) * swimmer.scale;
  }
  firstFrame = true;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function keyPressed() {
  if (key === 'f' || key === 'F') toggleFullscreen();
}

document.querySelector('#fullscreen-button').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  document.querySelector('#fullscreen-button').textContent = document.fullscreenElement ? '전체 화면 닫기' : '전체 화면';
});

