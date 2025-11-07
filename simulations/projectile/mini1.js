// mini1.js — Bucket Blitz with image assets (no air resistance)
// Place cannon.png, bucket.png, bucket_broken.png in same folder as HTML

console.log("mini1.js (images) loaded");

// ----- CONFIG -----
const ANGLE_DEG = 45;
const G = 10;
const TARGETS = [10, 20, 30, 40];
const BUCKET_WIDTH = 1.0;
const ATTEMPTS_ALLOWED = 6;

const CANVAS_W = 920, CANVAS_H = 520;
// Increase left margin to make room for cannon image
const MARGIN_LEFT = 90; // ← increased to leave space for cannon image
const GROUND_OFFSET = 50;
const SCALE_INIT = 20;
// ------------------

// image file names (change if your files have different names/extensions)
const CANNON_IMG = "Assets/cannon.png";
const BUCKET_IMG = "Assets/bucket.png";
const BUCKET_BROKEN_IMG = "Assets/bucket_broken.png";

// image objects (p5 will load)
let imgCannon = null, imgBucket = null, imgBucketBroken = null;

// Cannon-tip offset (pixels from the image's top-left to the barrel tip).
// You will likely need to tweak these values once you have your image.
// Default offsets work for many simple cannon graphics — adjust if the ball appears off the muzzle.
let cannonTipOffset = { x: 55, y: 18 }; // px: distance from top-left of cannon image to the firing tip

// UI refs
let velocityInput, shootBtn, resetBtn, attemptsLeftEl, brokenCountEl, feedbackEl, lastResultEl;

// state
let scalePx = SCALE_INIT;
let groundY;
let trajectories = [];
let broken = {};
let attemptsLeft = ATTEMPTS_ALLOWED;
let brokenCount = 0;
let colorPalette = ["#FF6B00", "#007BFF", "#00C49A", "#AA00FF", "#FF004C"];
let colorIndex = 0;
let gameOver = false;

// ----- pre-load images -----
function preload() {
  // Try to load images. If they fail p5 will throw warnings; we catch that by testing .width later.
  try {
    imgCannon = loadImage(CANNON_IMG, () => console.log("cannon image loaded"), (err) => {
      console.warn("cannon image failed to load:", CANNON_IMG, err);
      imgCannon = null;
    });
  } catch (e) { console.warn("cannon load exception", e); imgCannon = null; }

  try {
    imgBucket = loadImage(BUCKET_IMG, () => console.log("bucket image loaded"), (err) => {
      console.warn("bucket image failed to load:", BUCKET_IMG, err);
      imgBucket = null;
    });
  } catch (e) { console.warn("bucket load exception", e); imgBucket = null; }

  try {
    imgBucketBroken = loadImage(BUCKET_BROKEN_IMG, () => console.log("bucket_broken image loaded"), (err) => {
      console.warn("bucket_broken image failed to load:", BUCKET_BROKEN_IMG, err);
      imgBucketBroken = null;
    });
  } catch (e) { console.warn("bucket_broken load exception", e); imgBucketBroken = null; }
}

// ----- setup / draw -----
function setup() {
  console.log("p5 setup (images)");
  const c = createCanvas(CANVAS_W, CANVAS_H);
  c.parent("canvasContainer");
  groundY = height - GROUND_OFFSET;

  // UI
  velocityInput = safeGet("velocityInput");
  shootBtn = safeGet("shootBtn");
  resetBtn = safeGet("resetBtn");
  attemptsLeftEl = safeGet("attemptsLeft");
  brokenCountEl = safeGet("brokenCount");
  feedbackEl = safeGet("feedback");
  lastResultEl = safeGet("lastResult");

  if (shootBtn) shootBtn.addEventListener("click", onShoot);
  if (resetBtn) resetBtn.addEventListener("click", onReset);

  resetGameState();
  updateUI();
}

function draw() {
  background("#f8fbff");
  drawAxesAndTicks();
  drawAllBuckets();
  drawCannonImage();
  updateAndDrawTrajectories();
}

// ----- drawing helpers (images-aware) -----
function drawCannonImage() {
  if (imgCannon && imgCannon.width > 1) {
    const CANNON_SCALE = 0.3; // 🔹 tweak this between 0.2–0.5 depending on your image
    const drawWidth = imgCannon.width * CANNON_SCALE;
    const drawHeight = imgCannon.height * CANNON_SCALE;

    // 🔹 Position so top-right of cannon image aligns with the projectile origin
    const imgX = MARGIN_LEFT - drawWidth+20;  // top-right at origin (so shift left by its width)
    const imgY = groundY - drawHeight+50;     // top-right corner at ground level (y direction)

    push();
    imageMode(CORNER);
    image(imgCannon, imgX, imgY, drawWidth, drawHeight);
    pop();
  } else {
    drawFallbackCannon();
  }
}


function drawFallbackCannon() {
  push();
  const baseX = MARGIN_LEFT - 6;
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

function drawAllBuckets() {
  for (let tx of TARGETS) {
    const pxCenter = MARGIN_LEFT + tx * scalePx;
    const widthPx = BUCKET_WIDTH * scalePx;
    const heightPx = 40;
    const left = pxCenter - widthPx / 2;
    const top = groundY - heightPx;

    if (broken[tx]) {
      // broken state: prefer broken image if available
      if (imgBucketBroken && imgBucketBroken.width > 1) {
        // draw image centered on bucket base such that its bottom-center rests on ground at pxCenter
        const wImg = imgBucketBroken.width;
        const hImg = imgBucketBroken.height;
        // scale image so its width ≈ bucket visual width (widthPx). Keep aspect ratio.
        const scaleFactor = widthPx / wImg;
        push();
        translate(pxCenter, groundY - (hImg * scaleFactor) / 2);
        imageMode(CENTER);
        image(imgBucketBroken, 0, 0, wImg * scaleFactor, hImg * scaleFactor);
        pop();
      } else {
        // fallback broken drawing
        drawBrokenBucket(left, top, widthPx, heightPx);
      }
    } else {
      // intact: prefer bucket image
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
        // fallback intact bucket
        stroke(70); strokeWeight(3); noFill();
        line(left, groundY, left, top);
        line(left + widthPx, groundY, left + widthPx, top);
        line(left, top, left + widthPx, top);
        noStroke(); fill("rgba(0,0,0,0.06)");
        rect(left, groundY - 4, widthPx, 4);
        // label
        noStroke(); fill("#0f2538"); textSize(12); textAlign(CENTER, CENTER);
        text(tx.toString() + "m", pxCenter, top - 12);
      }
    }
  }
}

function drawBrokenBucket(left, top, widthPx, heightPx) {
  // small fallback broken look
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

// axes, ticks
function drawAxesAndTicks() {
  stroke(80); strokeWeight(3);
  line(MARGIN_LEFT, groundY, width - 40, groundY);
  line(MARGIN_LEFT, groundY, MARGIN_LEFT, 50);

  const visibleMetersX = Math.floor((width - MARGIN_LEFT - 40) / scalePx);
  const visibleMetersY = Math.floor((groundY - 50) / scalePx);
  let step = 1;
  if (scalePx < 18) step = 2;
  if (scalePx < 12) step = 5;
  if (scalePx < 8) step = 10;

  textSize(12); fill(60); noStroke();
  textAlign(CENTER, TOP);
  for (let i = 0; i <= visibleMetersX; i += step) {
    const x = MARGIN_LEFT + i * scalePx;
    stroke(180); strokeWeight(1);
    line(x, groundY, x, groundY - 8);
    noStroke(); fill(60);
    text(i, x, groundY + 12);
  }

  textAlign(RIGHT, CENTER);
  for (let j = 0; j <= visibleMetersY; j += step) {
    const y = groundY - j * scalePx;
    stroke(180);
    line(MARGIN_LEFT - 4, y, MARGIN_LEFT + 4, y);
    noStroke();
    text(j, MARGIN_LEFT - 8, y);
  }

  textAlign(CENTER); textSize(14); fill(0);
  text("Distance (m)", width / 2, groundY + 36);
  push(); translate(14, groundY - (visibleMetersY * scalePx) / 2); rotate(-PI / 2);
  text("Height (m)", 0, 0); pop();
}



// ----- trajectory integration & drawing -----
function updateAndDrawTrajectories() {
  const frameDt = min(0.04, deltaTime / 1000);
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
  if (!proj._init) {
    // Place projectile start at the cannon tip origin (meters: x=0, y=0)
    proj.x = 0; proj.y = 0;
    proj.vx = proj.speed * Math.cos(radians(ANGLE_DEG));
    proj.vy = proj.speed * Math.sin(radians(ANGLE_DEG));
    proj.time = 0; proj.maxY = 0; proj.path = []; proj._init = true;
  }

  // integrate (ideal projectile)
  proj.vy -= G * dt;
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  if (proj.y > proj.maxY) proj.maxY = proj.y;
  proj.time += dt;

  // store pixel
  const px = MARGIN_LEFT + proj.x * scalePx;
  const py = groundY - proj.y * scalePx;
  proj.path.push({ x: px, y: py });

  // landing check
  if (proj.y <= 0 && proj.time > 0.02) {
    proj.landed = true;
    // more accurate landing X by linear interpolation if possible
    let landingMeters = proj.x;
    if (proj.path.length >= 2) {
      const n = proj.path.length;
      const A = proj.path[n - 2], B = proj.path[n - 1];
      const mAx = (A.x - MARGIN_LEFT) / scalePx, mAy = (groundY - A.y) / scalePx;
      const mBx = (B.x - MARGIN_LEFT) / scalePx, mBy = (groundY - B.y) / scalePx;
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
  if (!velocityInput) { console.warn("no velocityInput element"); return; }
  const v = parseFloat(velocityInput.value);
  if (!v || v <= 0) {
    if (feedbackEl) feedbackEl.textContent = "Enter a valid positive velocity.";
    return;
  }
  if (attemptsLeft <= 0) return;
  const p = { speed: v, color: colorPalette[colorIndex % colorPalette.length], landed: false };
  colorIndex++; trajectories.push(p);
  attemptsLeft--; updateUI();
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
  attemptsLeft = ATTEMPTS_ALLOWED; brokenCount = 0; colorIndex = 0; gameOver = false;
  if (lastResultEl) lastResultEl.innerHTML = "No shots yet.";
  if (feedbackEl) feedbackEl.textContent = "Make a shot — hit all 4 in 6 tries!";
}

function onReset() { resetGameState(); updateUI(); }

function updateUI() {
  if (attemptsLeftEl) attemptsLeftEl.textContent = attemptsLeft;
  if (brokenCountEl) brokenCountEl.textContent = `${brokenCount} / ${TARGETS.length}`;
}

// ----- small helpers -----
function safeGet(id) { const el = document.getElementById(id); if (!el) console.warn(`#${id} not found`); return el; }
function radians(deg) { return deg * Math.PI / 180; }

console.log("mini1.js (images) ready");


// ---- UI popup for failure ----
function showReloadPopup() {
  // Create overlay
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

  // Create popup box
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

  // Create reload button
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

  reloadBtn.addEventListener("click", () => {
    location.reload(); // ✅ Reloads the page
  });

  popup.appendChild(msg);
  popup.appendChild(info);
  popup.appendChild(reloadBtn);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
}

// ---- Victory popup with confetti ----
function showVictoryPopup() {
  // overlay
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = 0;
  overlay.style.backgroundColor = "rgba(0,0,0,0.35)";
  overlay.style.zIndex = 9999;
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";

  // popup container
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

  // confetti canvas (on top of popup)
  const confettiCanvas = document.createElement("canvas");
  confettiCanvas.style.position = "absolute";
  confettiCanvas.style.left = "-50%";
  confettiCanvas.style.top = "-50%";
  confettiCanvas.style.width = "200%";
  confettiCanvas.style.height = "200%";
  confettiCanvas.style.pointerEvents = "none";
  confettiCanvas.style.zIndex = 10000;

  // message content
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

  // confetti implementation (simple particle system)
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
      ttl: rand(2.0, 4.0), // seconds
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
        // respawn slowly while running
        p.x = rand(W*0.25, W*0.75);
        p.y = rand(H*0.05, H*0.25);
        p.vx = rand(-6, 6); p.vy = rand(-10, -4);
        p.age = 0; p.ttl = rand(2.0, 4.0);
        p.size = Math.floor(rand(6,12));
        p.color = colors[Math.floor(Math.random()*colors.length)];
      }

      // physics
      p.vy += GRAVITY * dt * 30 * 0.033; // scale gravity somewhat
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;

      // draw rectangle confetti rotated
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
      ctx.restore();
    }

    animId = requestAnimationFrame(step);
  }

  // start and auto-stop confetti after 4.5s
  animId = requestAnimationFrame(step);
  setTimeout(() => stopConfetti(), 4500);

  function stopConfetti() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    // fade out canvas
    confettiCanvas.style.transition = "opacity 600ms ease";
    confettiCanvas.style.opacity = "0";
    setTimeout(()=> {
      try { confettiCanvas.remove(); } catch(e) {}
    }, 650);
  }

  // button handlers
  playAgain.addEventListener("click", () => {
    // cleanup & reload
    stopConfetti();
    overlay.remove();
    location.reload();
  });

  closeBtn.addEventListener("click", () => {
    stopConfetti();
    overlay.remove();
  });

  // Also close on overlay click (but not when clicking popup)
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) {
      stopConfetti();
      overlay.remove();
    }
  });
}



