// mini1.js — Bucket Blitz (responsive canvas + images)
// Put Assets/cannon.png, Assets/bucket.png, Assets/bucket_broken.png next to this file

console.log("mini1.js (responsive) loaded");

// ----- CONFIG -----
const ANGLE_DEG = 45;
const G = 10;
const TARGETS = [10, 20, 30, 40];
const BUCKET_WIDTH = 1.0;
const ATTEMPTS_ALLOWED = 6;

// Images
const CANNON_IMG = "Assets/cannon.png";
const BUCKET_IMG = "Assets/bucket.png";
const BUCKET_BROKEN_IMG = "Assets/bucket_broken.png";

// image objects
let imgCannon = null, imgBucket = null, imgBucketBroken = null;

// UI refs
let velocityInput, shootBtn, resetBtn, attemptsLeftEl, brokenCountEl, feedbackEl, lastResultEl;

// state
let scalePx = 20;            // px per meter (responsive)
let groundY;
let trajectories = [];
let broken = {};
let attemptsLeft = ATTEMPTS_ALLOWED;
let brokenCount = 0;
let colorPalette = ["#FF6B00", "#007BFF", "#00C49A", "#AA00FF", "#FF004C"];
let colorIndex = 0;
let gameOver = false;

// responsive margins (depend on canvas width)
function marginLeftPx() {
  // ~8% of width, clamped
  return Math.max(70, Math.min(120, Math.round(width * 0.08)));
}
const RIGHT_MARGIN = 40;
const TOP_MARGIN = 50;
const AXIS_LABEL_BOTTOM = 36;

// cannon draw scale (tweak if your image needs)
const CANNON_SCALE = 0.3;

// ----- preload images -----
function preload() {
  try {
    imgCannon = loadImage(CANNON_IMG, () => console.log("cannon image loaded"), () => imgCannon = null);
  } catch { imgCannon = null; }
  try {
    imgBucket = loadImage(BUCKET_IMG, () => console.log("bucket image loaded"), () => imgBucket = null);
  } catch { imgBucket = null; }
  try {
    imgBucketBroken = loadImage(BUCKET_BROKEN_IMG, () => console.log("bucket_broken image loaded"), () => imgBucketBroken = null);
  } catch { imgBucketBroken = null; }
}

// ----- setup/draw (responsive) -----
function setup() {
  const container = document.getElementById("canvasContainer");
  const c = createCanvas(container.clientWidth, container.clientWidth * 0.55);
  c.parent(container);

  // Responsive resize
  window.addEventListener("resize", () => {
    resizeCanvas(container.clientWidth, container.clientWidth * 0.55);
  });

  groundY = height - 50;
  const visMetersX = 40;
  scalePx = Math.max(10, Math.floor((width - marginLeftPx() - 40) / visMetersX));

  velocityInput = byId("velocityInput");
  shootBtn = byId("shootBtn");
  resetBtn = byId("resetBtn");
  attemptsLeftEl = byId("attemptsLeft");
  brokenCountEl = byId("brokenCount");
  feedbackEl = byId("feedback");
  lastResultEl = byId("lastResult");

  if (shootBtn) shootBtn.addEventListener("click", onShoot);
  if (resetBtn) resetBtn.addEventListener("click", onReset);

  resetGameState();
  updateUI();
}


function measureCanvas() {
  const holder = document.getElementById("canvasContainer");
  const w = Math.max(320, holder.clientWidth || 920);
  const h = Math.max(200, holder.clientHeight || Math.round(w * 9/16));
  return { w, h };
}

function handleResize() {
  const { w, h } = measureCanvas();
  resizeCanvas(w, h);
  groundY = height - 50;

  // Recompute scale to keep ~40 m visible in X
  const visMetersX = 40;
  scalePx = Math.max(10, Math.floor((width - marginLeftPx() - RIGHT_MARGIN) / visMetersX));

  // Recompute paths at current time to re-project to pixels
  recomputePathsForResize();
}

function recomputePathsForResize() {
  for (let proj of trajectories) {
    proj.path = [];
    let tEnd = proj.landed ? proj.landingTime : proj.time;
    const dt = 0.016;

    // re-simulate positions (ideal, same as stepIntegrate but pixel only)
    let vx = proj.vx0, vy = proj.vy0;
    let x = 0, y = 0, t = 0, maxY = 0;
    while (t <= tEnd) {
      vy -= G * dt;
      x += vx * dt;
      y += vy * dt;
      if (y > maxY) maxY = y;

      const px = marginLeftPx() + x * scalePx;
      const py = groundY - y * scalePx;
      if (py >= groundY && t > 0.02) break;
      proj.path.push({ x: px, y: py });

      t += dt;
    }
  }
}

function draw() {
  background("#f8fbff");
  drawAxesAndTicks();
  drawAllBuckets();
  drawCannon();
  updateAndDrawTrajectories();
}

// ----- drawing helpers -----
function drawCannon() {
  const ml = marginLeftPx();
  if (imgCannon && imgCannon.width > 1) {
    const drawW = imgCannon.width * CANNON_SCALE;
    const drawH = imgCannon.height * CANNON_SCALE;
    const imgX = ml - drawW + 20;  // nudge to align muzzle
    const imgY = groundY - drawH + 50;
    push();
    imageMode(CORNER);
    image(imgCannon, imgX, imgY, drawW, drawH);
    pop();
  } else {
    // fallback
    push();
    const baseX = ml - 6;
    const baseY = groundY - 12;
    noStroke();
    fill("#664422");
    rect(baseX, baseY, 48, 12, 4);
    push();
    translate(baseX + 14, baseY);
    rotate(-PI / 4);
    rect(0, -7, 46, 12, 4);
    pop();
    pop();
  }
}

function drawAllBuckets() {
  const ml = marginLeftPx();
  for (let tx of TARGETS) {
    const pxCenter = ml + tx * scalePx;
    const widthPx = BUCKET_WIDTH * scalePx;
    const heightPx = 40;
    const left = pxCenter - widthPx / 2;
    const top = groundY - heightPx;

    if (broken[tx]) {
      if (imgBucketBroken && imgBucketBroken.width > 1) {
        const wImg = imgBucketBroken.width;
        const hImg = imgBucketBroken.height;
        const scaleFactor = widthPx / wImg;
        push();
        translate(pxCenter, groundY - (hImg * scaleFactor) / 2);
        imageMode(CENTER);
        image(imgBucketBroken, 0, 0, wImg * scaleFactor, hImg * scaleFactor);
        pop();
      } else {
        drawBrokenBucket(left, top, widthPx, heightPx);
      }
    } else {
      if (imgBucket && imgBucket.width > 1) {
        const wImg = imgBucket.width;
        const hImg = imgBucket.height;
        const scaleFactor = widthPx / wImg;
        push();
        translate(pxCenter, groundY - (hImg * scaleFactor) / 2);
        imageMode(CENTER);
        image(imgBucket, 0, 0, wImg * scaleFactor, hImg * scaleFactor);
        pop();
      } else {
        stroke(70); strokeWeight(3); noFill();
        line(left, groundY, left, top);
        line(left + widthPx, groundY, left + widthPx, top);
        line(left, top, left + widthPx, top);
        noStroke(); fill("rgba(0,0,0,0.06)");
        rect(left, groundY - 4, widthPx, 4);
        noStroke(); fill("#0f2538"); textSize(12); textAlign(CENTER, CENTER);
        text(tx.toString() + "m", pxCenter, top - 12);
      }
    }
  }
}

function drawBrokenBucket(left, top, widthPx, heightPx) {
  noStroke(); fill("#fbeaea"); rect(left, top, widthPx, heightPx, 6);
  stroke("#c62828"); strokeWeight(2);
  const steps = 5; noFill(); beginShape();
  for (let i = 0; i <= steps; i++) {
    const nx = left + (i / steps) * widthPx;
    const ny = top + (i % 2 === 0 ? -6 : 6);
    vertex(nx, ny);
  }
  endShape();
  stroke("#8b0000"); strokeWeight(1.5);
  line(left + widthPx * 0.3, top + 8, left + widthPx * 0.45, top + heightPx * 0.6);
  line(left + widthPx * 0.7, top + 6, left + widthPx * 0.55, top + heightPx * 0.65);
  noStroke(); fill("#720000"); textSize(11); textAlign(CENTER, CENTER);
  text("BROKEN", left + widthPx / 2, top + heightPx / 2);
}

function drawAxesAndTicks() {
  const ml = marginLeftPx();
  stroke(80); strokeWeight(3);
  line(ml, groundY, width - RIGHT_MARGIN, groundY);
  line(ml, groundY, ml, TOP_MARGIN);

  const visibleMetersX = Math.floor((width - ml - RIGHT_MARGIN) / scalePx);
  const visibleMetersY = Math.floor((groundY - TOP_MARGIN) / scalePx);
  let step = 1;
  if (scalePx < 18) step = 2;
  if (scalePx < 12) step = 5;
  if (scalePx < 8) step = 10;

  textSize(12); fill(60); noStroke();

  textAlign(CENTER, TOP);
  for (let i = 0; i <= visibleMetersX; i += step) {
    const x = ml + i * scalePx;
    stroke(180); strokeWeight(1);
    line(x, groundY, x, groundY - 8);
    noStroke(); fill(60);
    text(i, x, groundY + 12);
  }

  textAlign(RIGHT, CENTER);
  for (let j = 0; j <= visibleMetersY; j += step) {
    const y = groundY - j * scalePx;
    stroke(180);
    line(ml - 4, y, ml + 4, y);
    noStroke();
    text(j, ml - 8, y);
  }

  textAlign(CENTER); textSize(14); fill(0);
  text("Distance (m)", width / 2, groundY + AXIS_LABEL_BOTTOM);
  push(); translate(16, groundY - (visibleMetersY * scalePx) / 2); rotate(-PI / 2);
  text("Height (m)", 0, 0); pop();
}

// ----- projectile integration & drawing -----
function updateAndDrawTrajectories() {
  const frameDt = Math.min(0.04, deltaTime / 1000);
  const steps = Math.max(1, Math.ceil(frameDt / 0.016));
  const dt = frameDt / steps;

  for (let proj of trajectories) {
    if (!proj.landed && !gameOver) {
      for (let s = 0; s < steps; s++) {
        stepIntegrate(proj, dt);
        if (proj.landed) break;
      }
    }
    stroke(proj.color); strokeWeight(2); noFill();
    beginShape();
    for (let p of proj.path) vertex(p.x, p.y);
    endShape();
    if (proj.path.length) {
      const last = proj.path[proj.path.length - 1];
      noStroke(); fill(proj.color); ellipse(last.x, last.y, 16, 16);
    }
  }
}

function stepIntegrate(proj, dt) {
  const ml = marginLeftPx();
  if (!proj._init) {
    proj.x = 0; proj.y = 0;
    proj.vx0 = proj.speed * Math.cos(radians(ANGLE_DEG));
    proj.vy0 = proj.speed * Math.sin(radians(ANGLE_DEG));
    proj.vx = proj.vx0;
    proj.vy = proj.vy0;
    proj.time = 0; proj.maxY = 0; proj.path = []; proj._init = true;
  }

  proj.vy -= G * dt;
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  if (proj.y > proj.maxY) proj.maxY = proj.y;
  proj.time += dt;

  const px = ml + proj.x * scalePx;
  const py = groundY - proj.y * scalePx;
  proj.path.push({ x: px, y: py });

  if (proj.y <= 0 && proj.time > 0.02) {
    proj.landed = true;

    // linear interpolation for landing X in meters
    let landingMeters = proj.x;
    if (proj.path.length >= 2) {
      const n = proj.path.length;
      const A = proj.path[n - 2], B = proj.path[n - 1];
      const mAx = (A.x - ml) / scalePx, mAy = (groundY - A.y) / scalePx;
      const mBx = (B.x - ml) / scalePx, mBy = (groundY - B.y) / scalePx;
      const denom = (mBy - mAy);
      if (Math.abs(denom) > 1e-6) {
        const t = (0 - mAy) / denom;
        landingMeters = mAx + t * (mBx - mAx);
      }
    }
    proj.landingX = landingMeters;
    proj.landingTime = proj.time;
    proj.maxHeight = proj.maxY;
    onProjectileLanded(proj);
  }
}

// ----- game logic -----
function onShoot() {
  if (gameOver) return;
  if (!velocityInput) return;
  const v = parseFloat(velocityInput.value);
  if (!v || v <= 0) {
    if (feedbackEl) { feedbackEl.style.color = "#a61b1b"; feedbackEl.textContent = "Enter a valid positive velocity."; }
    return;
  }
  if (attemptsLeft <= 0) return;

  const p = { speed: v, color: colorPalette[colorIndex % colorPalette.length], landed: false };
  colorIndex++;
  trajectories.push(p);
  attemptsLeft--;
  updateUI();

  if (feedbackEl) { feedbackEl.style.color = "#233a4a"; feedbackEl.textContent = "Shot fired — tracking..."; }
}

function onProjectileLanded(proj) {
  const landedX = proj.landingX;
  if (lastResultEl) lastResultEl.innerHTML = `Landed at <strong>${landedX.toFixed(3)} m</strong> — time ${proj.landingTime.toFixed(3)} s`;

  for (let tx of TARGETS) {
    const left = tx - BUCKET_WIDTH / 2, right = tx + BUCKET_WIDTH / 2;
    if (!broken[tx] && landedX >= left - 1e-6 && landedX <= right + 1e-6) {
      broken[tx] = true; brokenCount++; updateUI();
      if (feedbackEl) { feedbackEl.style.color = "#0a8b3c"; feedbackEl.textContent = `HIT! Bucket at ${tx} m broken.`; }
      if (brokenCount === TARGETS.length) {
        if (feedbackEl) { feedbackEl.style.color = "#005f2a"; feedbackEl.textContent = "HURRAAY!! You broke all buckets!"; }
        setTimeout(() => showVictoryPopup(), 250);
        gameOver = true;
      }
      return;
    }
  }

  if (feedbackEl) { feedbackEl.style.color = "#a61b1b"; feedbackEl.textContent = `Missed — landed at ${landedX.toFixed(3)} m.`; }
  if (attemptsLeft <= 0 && brokenCount < TARGETS.length) {
    setTimeout(() => showReloadPopup(), 200);
  }
  updateUI();
}

function resetGameState() {
  trajectories = [];
  broken = {};
  for (let tx of TARGETS) broken[tx] = false;
  attemptsLeft = ATTEMPTS_ALLOWED;
  brokenCount = 0;
  colorIndex = 0;
  gameOver = false;
  if (lastResultEl) lastResultEl.innerHTML = "No shots yet.";
  if (feedbackEl) { feedbackEl.style.color = "#2b3b4a"; feedbackEl.textContent = "Make a shot — hit all 4 in 6 tries!"; }
}

function onReset() { resetGameState(); updateUI(); }

function updateUI() {
  if (attemptsLeftEl) attemptsLeftEl.textContent = attemptsLeft;
  if (brokenCountEl) brokenCountEl.textContent = `${brokenCount} / ${TARGETS.length}`;
}

// ----- helpers & math -----
function byId(id){ const el = document.getElementById(id); if (!el) console.warn(`#${id} not found`); return el; }
function radians(deg){ return deg * Math.PI / 180; }

// ---- popups (unchanged from your version) ----
function showReloadPopup() {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.45)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "999";

  const popup = document.createElement("div");
  popup.style.background = "white";
  popup.style.padding = "30px 40px";
  popup.style.borderRadius = "12px";
  popup.style.boxShadow = "0 4px 25px rgba(0,0,0,0.2)";
  popup.style.textAlign = "center";
  popup.style.fontFamily = "Poppins, sans-serif";
  popup.style.color = "#1a1a1a";

  const msg = document.createElement("h2");
  msg.textContent = "You failed 😢";
  msg.style.marginBottom = "8px";
  msg.style.fontWeight = "600";

  const info = document.createElement("p");
  info.textContent = "Better luck next time!";
  info.style.marginBottom = "18px";

  const reloadBtn = document.createElement("button");
  reloadBtn.textContent = "Try Again 🔁";
  reloadBtn.style.padding = "10px 22px";
  reloadBtn.style.fontSize = "16px";
  reloadBtn.style.background = "#007BFF";
  reloadBtn.style.color = "#fff";
  reloadBtn.style.border = "none";
  reloadBtn.style.borderRadius = "8px";
  reloadBtn.style.cursor = "pointer";
  reloadBtn.style.transition = "0.25s";
  reloadBtn.addEventListener("mouseenter", () => reloadBtn.style.background = "#0056b3");
  reloadBtn.addEventListener("mouseleave", () => reloadBtn.style.background = "#007BFF");
  reloadBtn.addEventListener("click", () => location.reload());

  popup.appendChild(msg);
  popup.appendChild(info);
  popup.appendChild(reloadBtn);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

function showVictoryPopup() {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = 0;
  overlay.style.backgroundColor = "rgba(0,0,0,0.35)";
  overlay.style.zIndex = 9999;
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";

  const popup = document.createElement("div");
  popup.style.width = "480px";
  popup.style.maxWidth = "90%";
  popup.style.padding = "28px 26px";
  popup.style.borderRadius = "14px";
  popup.style.background = "linear-gradient(180deg,#ffffff,#f6fbff)";
  popup.style.boxShadow = "0 18px 60px rgba(9,30,66,0.18)";
  popup.style.textAlign = "center";
  popup.style.fontFamily = "Poppins, sans-serif";
  popup.style.position = "relative";
  popup.style.overflow = "visible";

  const confettiCanvas = document.createElement("canvas");
  confettiCanvas.style.position = "absolute";
  confettiCanvas.style.left = "-50%";
  confettiCanvas.style.top = "-50%";
  confettiCanvas.style.width = "200%";
  confettiCanvas.style.height = "200%";
  confettiCanvas.style.pointerEvents = "none";
  confettiCanvas.style.zIndex = 10000;

  const h = document.createElement("h2");
  h.textContent = "HURRAAY!! 🎉";
  h.style.margin = "0 0 8px 0";
  h.style.fontSize = "26px";
  h.style.color = "#06304a";
  h.style.fontWeight = "700";

  const msg = document.createElement("p");
  msg.textContent = "You cleared the challenge — all buckets broken!";
  msg.style.margin = "0 0 18px 0";
  msg.style.color = "#234657";
  msg.style.fontSize = "15px";

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.justifyContent = "center";
  btnRow.style.gap = "12px";

  const playAgain = document.createElement("button");
  playAgain.textContent = "Play Again";
  playAgain.style.padding = "10px 18px";
  playAgain.style.borderRadius = "10px";
  playAgain.style.border = "none";
  playAgain.style.background = "#00a86b";
  playAgain.style.color = "#fff";
  playAgain.style.fontWeight = "700";
  playAgain.style.cursor = "pointer";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.padding = "10px 18px";
  closeBtn.style.borderRadius = "10px";
  closeBtn.style.border = "1px solid #d6e3ea";
  closeBtn.style.background = "#fff";
  closeBtn.style.color = "#073b4c";
  closeBtn.style.fontWeight = "700";
  closeBtn.style.cursor = "pointer";

  btnRow.appendChild(playAgain);
  btnRow.appendChild(closeBtn);

  popup.appendChild(confettiCanvas);
  popup.appendChild(h);
  popup.appendChild(msg);
  popup.appendChild(btnRow);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  const ctx = confettiCanvas.getContext("2d");
  let W = confettiCanvas.width = Math.floor(confettiCanvas.clientWidth);
  let H = confettiCanvas.height = Math.floor(confettiCanvas.clientHeight);

  window.addEventListener("resize", () => {
    W = confettiCanvas.width = Math.floor(confettiCanvas.clientWidth);
    H = confettiCanvas.height = Math.floor(confettiCanvas.clientHeight);
  });

  const colors = ["#FF4C4C", "#FFB86B", "#FFD166", "#7EE787", "#6CCFFD", "#C291FF", "#FF6BAC"];
  const particles = [];
  const PARTICLE_COUNT = 140;
  const GRAVITY = 0.35;

  function rand(min, max){ return Math.random() * (max - min) + min; }

  for (let i=0;i<PARTICLE_COUNT;i++){
    particles.push({
      x: rand(W*0.25, W*0.75),
      y: rand(H*0.1, H*0.3),
      vx: rand(-6, 6),
      vy: rand(-12, -4),
      size: Math.floor(rand(6, 12)),
      color: colors[Math.floor(Math.random()*colors.length)],
      rotation: rand(0, Math.PI*2),
      spin: rand(-0.2, 0.2),
      ttl: rand(2.0, 4.0),
      age: 0
    });
  }

  let lastTime = performance.now();
  let animId;
  let running = true;

  function step(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    ctx.clearRect(0,0,W,H);

    for (let p of particles) {
      if (!running) continue;
      p.age += dt;
      if (p.age > p.ttl) {
        p.x = rand(W*0.25, W*0.75);
        p.y = rand(H*0.05, H*0.25);
        p.vx = rand(-6, 6); p.vy = rand(-10, -4);
        p.age = 0; p.ttl = rand(2.0, 4.0);
        p.size = Math.floor(rand(6,12));
        p.color = colors[Math.floor(Math.random()*colors.length)];
      }

      p.vy += GRAVITY * dt * 30 * 0.033;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
      ctx.restore();
    }

    animId = requestAnimationFrame(step);
  }

  animId = requestAnimationFrame(step);
  setTimeout(() => stopConfetti(), 4500);

  function stopConfetti() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    confettiCanvas.style.transition = "opacity 600ms ease";
    confettiCanvas.style.opacity = "0";
    setTimeout(()=> { try { confettiCanvas.remove(); } catch(e) {} }, 650);
  }

  playAgain.addEventListener("click", () => {
    stopConfetti(); overlay.remove(); location.reload();
  });
  closeBtn.addEventListener("click", () => { stopConfetti(); overlay.remove(); });
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) { stopConfetti(); overlay.remove(); }});
}
