// Config
const cfg = {
  worldWidth: 480,
  gravity: 1200,
  jumpVel: -520,
  moveAccel: 1600,
  maxSpeedX: 280,
  friction: 0.86,
  platformMinGap: 80,
  platformMaxGap: 160,
  platformWidthRange: [80, 180],
  rainbowCooldown: 280,
  rainbowLife: 1100,
  rainbowArcRadius: 60,
  rainbowArcThickness: 10,
  platformEnemyRate: 0.25,
  flyingEnemyRate: 0.15,
  flyingSpeedRange: [60, 100],
  platformEnemySpeed: 40
};

// Canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// UI
const scoreEl = document.getElementById('score');
const stateEl = document.getElementById('state');
const overlay = document.getElementById('overlay');
document.getElementById('restart').addEventListener('click', () => resetGame());

// Input
const keys = new Set();
document.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','Space','KeyA','KeyD','KeyF','KeyK','KeyP'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP') togglePause(); else keys.add(e.code);
});
document.addEventListener('keyup', e => keys.delete(e.code));

// Estat
let cameraY = 0, maxHeight = 0, gameOver = false, paused = false, lastTime = performance.now();

// Entitats
const player = { x: cfg.worldWidth/2, y: -200, w:28, h:36, vx:0, vy:0, onGround:false, lastShot:0, facing:1 };
const platforms = [];
const rainbows = [];
const platformEnemies = []; // enemics sobre plataformes
const flyingEnemies = [];   // enemics voladors

// Utils
function rand(min,max){ return Math.random()*(max-min)+min; }
function randi(min,max){ return Math.floor(rand(min,max)); }
function aabb(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

// Generació
let highestPlatY = 60;
function generatePlatformsUpTo(targetY){
  while(highestPlatY < targetY){
    const gap = rand(cfg.platformMinGap, cfg.platformMaxGap);
    highestPlatY += gap;
    const w = rand(cfg.platformWidthRange[0], cfg.platformWidthRange[1]);
    const x = rand(20, cfg.worldWidth - w - 20);
    const plat = { x, y: highestPlatY, w, h: 12 };
    platforms.push(plat);

    // Enemic caminant sobre la plataforma
    if (Math.random() < cfg.platformEnemyRate){
      const ew = 24, eh = 24;
      platformEnemies.push({
        x: x + rand(0, w - ew),
        y: highestPlatY - eh,
        w: ew, h: eh,
        vx: Math.random() < 0.5 ? cfg.platformEnemySpeed : -cfg.platformEnemySpeed
      });
    }

    // Enemic volador
    if (Math.random() < cfg.flyingEnemyRate){
      const fw = 32, fh = 24;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const fx = dir < 0 ? cfg.worldWidth + fw : -fw;
      const fy = highestPlatY + rand(60, 120);
      flyingEnemies.push({
        x: fx, y: fy,
        w: fw, h: fh,
        vx: dir * rand(cfg.flyingSpeedRange[0], cfg.flyingSpeedRange[1])
      });
    }
  }
}

// Reinici
function resetGame(){
  platforms.length = 0;
  rainbows.length = 0;
  platformEnemies.length = 0;
  flyingEnemies.length = 0;

  // Plataforma inicial
  platforms.push({ x: cfg.worldWidth/2 - 100, y: 60, w: 200, h: 12 });
  highestPlatY = 60;
  generatePlatformsUpTo(800);

  Object.assign(player, { x: cfg.worldWidth/2, y: -200, vx: 0, vy: 0, onGround: false, lastShot: 0, facing: 1 });
  cameraY = 0; maxHeight = 0; gameOver = false; paused = false;
  overlay.classList.add('hidden'); stateEl.textContent = 'Jugant'; scoreEl.textContent = '0';
}

// Pausa
function togglePause(){
  if (gameOver) return;
  paused = !paused;
  stateEl.textContent = paused ? 'Pausa' : 'Jugant';
}

// Disparar arc de sant Martí
function shootRainbow(){
  const now = performance.now();
  if (now - player.lastShot < cfg.rainbowCooldown) return;
  player.lastShot = now;
  rainbows.push({
    born: now,
    life: cfg.rainbowLife,
    dir: player.facing,
    x0: player.x + player.w/2 + player.facing * 6,
    y0: player.y + player.h/2 - 6
  });
}

// Fi de joc
function endGame(){
  gameOver = true;
  stateEl.textContent = 'Game Over';
  overlay.classList.remove('hidden');
}

// Update enemics
function updateEnemies(dt){
  // Caminants
  for (let e of platformEnemies){
    e.x += e.vx * dt;
    // trobar plataforma sota e
    const plat = platforms.find(p => Math.abs((e.y + e.h) - p.y) < 0.5 && e.x + e.w > p.x && e.x < p.x + p.w);
    if (plat){
      if (e.x < plat.x) { e.x = plat.x; e.vx *= -1; }
      if (e.x + e.w > plat.x + plat.w) { e.x = plat.x + plat.w - e.w; e.vx *= -1; }
    }
    if (aabb(player, e)) endGame();
  }

  // Voladors
  for (let f of flyingEnemies){
    f.x += f.vx * dt;
    if (aabb(player, f)) endGame();
  }
  // eliminar voladors fora del món virtual
  for (let i = flyingEnemies.length - 1; i >= 0; i--){
    const f = flyingEnemies[i];
    if (f.x < -120 || f.x > cfg.worldWidth + 120) flyingEnemies.splice(i,1);
  }
}

// Col·lisions arc amb enemics
function rainbowHits(){
  // discretitza l'arc en probes
  for (let i = rainbows.length - 1; i >= 0; i--){
    const r = rainbows[i];
    const segments = 10;
    for (let s = 0; s <= segments; s++){
      const t = s/segments;
      const angle = t * Math.PI;
      const R = cfg.rainbowArcRadius;
      const cx = r.x0 + r.dir * R;
      const cy = r.y0;
      const px = cx + Math.cos(Math.PI - angle) * R * r.dir;
      const py = cy - Math.sin(angle) * R;
      const probe = { x: px-4, y: py-4, w: 8, h: 8 };

      // contra enemics caminants
      for (let j = platformEnemies.length - 1; j >= 0; j--){
        if (aabb(probe, platformEnemies[j])) platformEnemies.splice(j,1);
      }
      // contra voladors
      for (let k = flyingEnemies.length - 1; k >= 0; k--){
        if (aabb(probe, flyingEnemies[k])) flyingEnemies.splice(k,1);
      }
    }
  }
}

// Update principal
function update(dt){
  const left  = keys.has('ArrowLeft') || keys.has('KeyA');
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const jump  = keys.has('Space');
  const fire  = keys.has('KeyF') || keys.has('KeyK');

  // moviment horitzontal
  if (left && !right){ player.vx -= cfg.moveAccel * dt; player.facing = -1; }
  else if (right && !left){ player.vx += cfg.moveAccel * dt; player.facing = 1; }
  else { player.vx *= cfg.friction; }
  player.vx = Math.max(-cfg.maxSpeedX, Math.min(cfg.maxSpeedX, player.vx));

  // gravetat
  player.vy += cfg.gravity * dt;

  // salt
  if (jump && player.onGround){
    player.vy = cfg.jumpVel;
    player.onGround = false;
  }

  // avanç
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // wrap horitzontal
  if (player.x + player.w < 0) player.x = cfg.worldWidth - 1;
  if (player.x > cfg.worldWidth) player.x = -player.w + 1;

  // col·lisió amb plataformes (caient)
  player.onGround = false;
  for (let p of platforms){
    const falling = player.vy >= 0;
    const above = player.y + player.h <= p.y + 8;
    if (falling && above){
      if (player.x + player.w > p.x && player.x < p.x + p.w){
        if (player.y + player.h >= p.y && player.y + player.h <= p.y + p.h + 8){
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        }
      }
    }
  }

  // foc
  if (fire) shootRainbow();

  // arcs: vida i dany
  for (let i = rainbows.length - 1; i >= 0; i--){
    const r = rainbows[i];
    if (performance.now() - r.born > cfg.rainbowLife) rainbows.splice(i,1);
  }
  rainbowHits();

  // enemics
  updateEnemies(dt);

  // càmera
  const margin = 220;
  const targetCamY = Math.max(0, player.y - margin);
  cameraY = cameraY * 0.92 + targetCamY * 0.08;

  // generar nou món
  const needY = cameraY + canvas.height + 400;
  generatePlatformsUpTo(needY);

  // marcador (metres aprox)
  maxHeight = Math.max(maxHeight, player.y);
  scoreEl.textContent = Math.floor(maxHeight / 50);
}

// Render
function render(){
  // fons
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0, '#0b1024'); g.addColorStop(1, '#121a33');
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

  // conversió món->pantalla
  const scaleX = canvas.width / cfg.worldWidth;
  function toScreenX(x){ return x * scaleX; }
  function toScreenY(y){ return (y - cameraY); }

  // estrelles
  drawStars();

  // plataformes
  for (let p of platforms){
    const sy = toScreenY(p.y);
    if (sy < -40 || sy > canvas.height + 40) continue;
    ctx.fillStyle = '#3dd1a7';
    ctx.fillRect(toScreenX(p.x), sy, toScreenX(p.w), p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(toScreenX(p.x), sy + p.h, toScreenX(p.w), 3);
  }

  // enemics caminants
  for (let e of platformEnemies){
    const sy = toScreenY(e.y);
    if (sy < -60 || sy > canvas.height + 60) continue;
    drawWalker(toScreenX(e.x), sy, toScreenX(e.w), e.h);
  }

  // voladors
  for (let f of flyingEnemies){
    const sy = toScreenY(f.y);
    if (sy < -80 || sy > canvas.height + 80) continue;
    drawFlyer(toScreenX(f.x), sy, toScreenX(f.w), f.h);
  }

  // jugador
  drawKid(toScreenX(player.x), toScreenY(player.y), player.w * scaleX, player.h, player.facing);

  // arcs
  for (let r of rainbows){
    const age = performance.now() - r.born;
    const t = Math.min(1, age / cfg.rainbowLife);
    const alpha = 1 - t;
    const R = cfg.rainbowArcRadius;
    const cx = toScreenX(r.x0 + r.dir * R);
    const cy = toScreenY(r.y0);
    drawRainbowArc(cx, cy, R * scaleX, cfg.rainbowArcThickness, alpha, r.dir);
  }
}

// Dibuix auxiliars
function drawStars(){
  for (let i = 0; i < 80; i++){
    const x = (i * 123.45) % canvas.width;
    const y = ((i * 345.67) % canvas.height) + ((cameraY * 0.2) % canvas.height);
    const r = (i % 5 === 0) ? 1.8 : 1.1;
    ctx.globalAlpha = (i % 7 === 0) ? 0.9 : 0.5;
    ctx.fillStyle = '#cfe7ff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawKid(x, y, w, h, facing){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f9a8d4'; ctx.fillRect(0, 0, w, h*0.65);
  ctx.fillStyle = '#ffd1a3'; ctx.fillRect(w*0.15, -h*0.35, w*0.7, h*0.35);
  ctx.fillStyle = '#1f2937';
  const eyeX = facing === 1 ? w*0.6 : w*0.3;
  ctx.fillRect(eyeX, -h*0.22, 4, 4);
  ctx.fillRect(w*0.1, h*0.65, w*0.3, h*0.1);
  ctx.fillRect(w*0.6, h*0.65, w*0.3, h*0.1);
  ctx.fillStyle = '#ffd1a3';
  ctx.fillRect(facing === 1 ? w*0.8 : -w*0.1, h*0.15, w*0.2, h*0.12);
  ctx.restore();
}

function drawWalker(x, y, w, h){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w*0.2, h*0.2, w*0.6, h*0.2); // boca
  ctx.restore();
}

function drawFlyer(x, y, w, h){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffaa00';
  ctx.beginPath();
  ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI*2);
  ctx.fill();
  // ales
  ctx.fillStyle = '#ffcc66';
  ctx.fillRect(-w*0.6, -h*0.1, w*0.4, h*0.2);
  ctx.fillRect(w*0.2, -h*0.1, w*0.4, h*0.2);
  ctx.restore();
}

function drawRainbowArc(cx, cy, R, thickness, alpha, dir){
  const colors = ['#ff0000','#ff7f00','#ffff00','#00ff00','#0000ff','#4b0082','#8f00ff'];
  for (let i = 0; i < colors.length; i++){
    ctx.strokeStyle = colors[i];
    ctx.globalAlpha = alpha * 0.95;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    const start = dir === 1 ? Math.PI : 0;
    const end   = dir === 1 ? 2*Math.PI : Math.PI;
    const r = R - i * (thickness * 0.9);
    ctx.arc(cx, cy, r, start, end, dir !== 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Loop
function loop(now){
  const dt = Math.min(0.033, (now - lastTime)/1000);
  lastTime = now;
  if (!paused && !gameOver) update(dt);
  render();
  requestAnimationFrame(loop);
}

// Inici
resetGame();
requestAnimationFrame(loop);
