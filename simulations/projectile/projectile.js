// === Controls ===
const angleSlider = document.getElementById("angleSlider");
const angleInput = document.getElementById("angleInput");
const velocitySlider = document.getElementById("velocitySlider");
const velocityInput = document.getElementById("velocityInput");
const launchButton = document.getElementById("launchBtn");
const clearButton = document.getElementById("clearBtn");

// === Physics settings ===
const gravityInput = document.getElementById("gravityInput");
const dragInput = document.getElementById("dragInput");
const airResistanceToggle = document.getElementById("airResistanceToggle");

// === Globals ===
let g = 9.8;
let airResistanceEnabled = false;
let dragCoefficient = 0.02;

let baseScale = 20; // px/m
let scale = baseScale;

let groundY;
let trajectories = [];
let colors = ["#007BFF", "#FF6B00", "#00C49A", "#AA00FF", "#FF004C", "#008080"];
let colorIndex = 0;
let projectileCount = 0;

// === Sync controls ===
function syncControls(slider, input, min, max) {
  slider.addEventListener("input", () => (input.value = slider.value));
  input.addEventListener("input", () => {
    let val = parseFloat(input.value);
    if (isNaN(val)) val = 0;
    if (val < min) val = min;
    if (val > max) val = max;
    slider.value = val;
  });
}
syncControls(angleSlider, angleInput, 0, 90);
syncControls(velocitySlider, velocityInput, 0, 100);

// === Physics parameter controls ===
gravityInput.addEventListener("input", () => {
  const newG = parseFloat(gravityInput.value);
  if (!isNaN(newG) && newG > 0) g = newG;
});

dragInput.addEventListener("input", () => {
  const newK = parseFloat(dragInput.value);
  if (!isNaN(newK) && newK >= 0) dragCoefficient = newK;
});

airResistanceToggle.addEventListener("change", (e) => {
  airResistanceEnabled = e.target.checked;
});

// === p5 Setup (responsive canvas) ===
function setup() {
  const { w, h } = measureCanvas();
  let c = createCanvas(w, h);
  c.parent("projectileCanvasContainer");

  // Start with ~30 m visible width (roughly)
  baseScale = Math.max(10, Math.floor((width - 120) / 30));
  scale = baseScale;

  groundY = height - 50;

  // Resize handler
  window.addEventListener("resize", handleResize);
}

// compute canvas size from container (uses CSS aspect-ratio)
function measureCanvas() {
  const holder = document.getElementById("projectileCanvasContainer");
  // fallback sizes if not yet laid out
  const w = Math.max(320, holder.clientWidth || 900);
  const h = Math.max(200, holder.clientHeight || Math.round(w * 9 / 16));
  return { w, h };
}

function handleResize() {
  const { w, h } = measureCanvas();
  resizeCanvas(w, h);
  groundY = height - 50;
  recomputePathsForResize();
}

// Recompute pixel paths for all projectiles after resize (keep animation states)
function recomputePathsForResize() {
  for (let proj of trajectories) {
    const gUse = proj.gUsed;
    const air = proj.air;
    const kUse = proj.k;
    const theta = (proj.angle * Math.PI) / 180;
    const v0 = proj.velocity;

    proj.path = [];
    let tEnd = proj.hasLanded ? proj.tLanded : proj.t; // how far to draw

    const dt = 0.02;
    let t = 0;

    if (!air) {
      while (t <= tEnd) {
        const x = v0 * Math.cos(theta) * t;
        const y = v0 * Math.sin(theta) * t - 0.5 * gUse * t * t;
        const sx = 40 + x * scale;
        const sy = groundY - y * scale;
        if (sy >= groundY) break;
        proj.path.push({ x: sx, y: sy });
        t += dt;
      }
    } else {
      // linear-drag rendering (approx)
      while (t <= tEnd) {
        const vx0 = v0 * Math.cos(theta);
        const vy0 = v0 * Math.sin(theta);
        const eTerm = Math.exp(-kUse * t);
        const x = (vx0 / kUse) * (1 - eTerm);
        const y = (1 / kUse) * ((vy0 + gUse / kUse) * (1 - eTerm)) - (gUse * t) / kUse;

        const sx = 40 + x * scale;
        const sy = groundY - y * scale;
        if (sy >= groundY) break;
        proj.path.push({ x: sx, y: sy });
        t += dt;
      }
    }
  }
}

// === p5 Draw ===
function draw() {
  background("#ffffff");
  drawStaticElements();

  for (let projectile of trajectories) {
    // advance simulation for in-flight projectiles only
    if (!projectile.hasLanded) {
      projectile.t += deltaTime / 1000;

      // physics based on the settings at launch (per projectile)
      const theta = (projectile.angle * Math.PI) / 180;
      const v0 = projectile.velocity;
      const gUse = projectile.gUsed;
      const kUse = projectile.k;

      let x, y;
      if (!projectile.air) {
        x = v0 * Math.cos(theta) * projectile.t;
        y = v0 * Math.sin(theta) * projectile.t - 0.5 * gUse * projectile.t * projectile.t;
      } else {
        const vx0 = v0 * Math.cos(theta);
        const vy0 = v0 * Math.sin(theta);
        const eTerm = Math.exp(-kUse * projectile.t);
        x = (vx0 / kUse) * (1 - eTerm);
        y = (1 / kUse) * ((vy0 + gUse / kUse) * (1 - eTerm)) - (gUse * projectile.t) / kUse;
      }

      const ballX = 40 + x * scale;
      const ballY = groundY - y * scale;

      if (ballY >= groundY) {
        projectile.hasLanded = true;
        projectile.tLanded = projectile.t;
        updateResults(projectile);
      } else {
        projectile.path.push({ x: ballX, y: ballY });
      }
    }

    // Draw trajectory
    noFill();
    stroke(projectile.color);
    strokeWeight(2);
    beginShape();
    for (let p of projectile.path) vertex(p.x, p.y);
    endShape();

    // Draw projectile ball
    if (projectile.path.length > 0) {
      const last = projectile.path[projectile.path.length - 1];
      fill(projectile.color);
      noStroke();
      circle(last.x, last.y, 18);
    }
  }
}

// === Axes & Markings (responsive ticks) ===
function drawStaticElements() {
  stroke(80);
  strokeWeight(3);
  line(40, groundY, width - 40, groundY); // x-axis
  line(40, groundY, 40, 50); // y-axis

  const visibleMetersX = Math.floor((width - 80) / scale);
  const visibleMetersY = Math.floor((groundY - 50) / scale);

  // dynamic tick step for readability
  let step = 1;
  if (scale < 18) step = 2;
  if (scale < 12) step = 5;
  if (scale < 8) step = 10;
  if (scale < 4) step = 20;

  textSize(12);
  fill(60);
  noStroke();

  // X-axis
  textAlign(CENTER);
  for (let i = 0; i <= visibleMetersX; i += step) {
    const x = 40 + i * scale;
    stroke(160);
    line(x, groundY, x, groundY - 10);
    noStroke();
    text(i, x, groundY + 18);
  }

  // Y-axis
  textAlign(RIGHT, CENTER);
  for (let j = 0; j <= visibleMetersY; j += step) {
    const y = groundY - j * scale;
    stroke(160);
    line(35, y, 45, y);
    noStroke();
    text(j, 28, y);
  }

  // Labels
  textAlign(CENTER);
  fill(0);
  textSize(14);
  text("Distance (m)", width / 2, groundY + 40);

  push();
  translate(10, groundY - (visibleMetersY * scale) / 2);
  rotate(-PI / 2);
  text("Height (m)", 0, 0);
  pop();
}

// === Launch ===
launchButton.addEventListener("click", () => {
  const angle = parseFloat(angleInput.value);
  const velocity = parseFloat(velocityInput.value);
  if (isNaN(angle) || isNaN(velocity) || velocity <= 0) {
    alert("Please enter valid angle and velocity.");
    return;
  }

  // store per-projectile physics so later UI changes don’t affect old shots
  const projectile = {
    angle,
    velocity,
    t: 0,
    tLanded: 0,
    path: [],
    color: colors[colorIndex % colors.length],
    hasLanded: false,
    air: airResistanceEnabled,
    k: dragCoefficient,
    gUsed: g
  };
  colorIndex++;

  // Fit to screen if needed (uses vacuum range/height for simplicity)
  autoScaleIfNeeded(projectile);

  // Add and start animating
  trajectories.push(projectile);
});

// === Auto scaling ===
function autoScaleIfNeeded(newProj) {
  // Estimate with vacuum equations to decide scale (simple + fast)
  const theta = (newProj.angle * Math.PI) / 180;
  const v0 = newProj.velocity;
  const gUse = newProj.gUsed;

  const range = (v0 ** 2 * Math.sin(2 * theta)) / gUse;
  const maxHeight = (v0 ** 2 * Math.sin(theta) ** 2) / (2 * gUse);

  const visibleMetersX = (width - 120) / scale;
  const visibleMetersY = (groundY - 80) / scale;

  const shrinkX = range > visibleMetersX ? range / visibleMetersX : 1;
  const shrinkY = maxHeight > visibleMetersY ? maxHeight / visibleMetersY : 1;

  const shrinkFactor = Math.max(shrinkX, shrinkY);
  if (shrinkFactor > 1.05) {
    scale /= shrinkFactor;

    // Recompute paths for already-laned + in-flight to match new scale
    for (let proj of trajectories) {
      const gUse2 = proj.gUsed;
      const air2 = proj.air;
      const kUse2 = proj.k;
      const theta2 = (proj.angle * Math.PI) / 180;
      const v02 = proj.velocity;

      proj.path = [];
      const dt = 0.02;
      let t = 0;
      const tEnd = proj.hasLanded ? proj.tLanded : proj.t;

      if (!air2) {
        while (t <= tEnd) {
          const x = v02 * Math.cos(theta2) * t;
          const y = v02 * Math.sin(theta2) * t - 0.5 * gUse2 * t * t;
          const sx = 40 + x * scale;
          const sy = groundY - y * scale;
          if (sy >= groundY) break;
          proj.path.push({ x: sx, y: sy });
          t += dt;
        }
      } else {
        while (t <= tEnd) {
          const vx0 = v02 * Math.cos(theta2);
          const vy0 = v02 * Math.sin(theta2);
          const eTerm = Math.exp(-kUse2 * t);
          const x = (vx0 / kUse2) * (1 - eTerm);
          const y = (1 / kUse2) * ((vy0 + gUse2 / kUse2) * (1 - eTerm)) - (gUse2 * t) / kUse2;

          const sx = 40 + x * scale;
          const sy = groundY - y * scale;
          if (sy >= groundY) break;
          proj.path.push({ x: sx, y: sy });
          t += dt;
        }
      }
    }
  }
}

// === Clear ===
clearButton.addEventListener("click", () => {
  trajectories = [];
  projectileCount = 0;

  // reset scale relative to current width (≈30 m visible)
  baseScale = Math.max(10, Math.floor((width - 120) / 30));
  scale = baseScale;

  document.getElementById("resultsList").innerHTML =
    '<p style="color:#666; font-style:italic;">No projectiles launched yet</p>';
});

// === Update results ===
function updateResults(projectile) {
  projectileCount++;
  const v = projectile.velocity;
  const theta = (projectile.angle * Math.PI) / 180;
  const gUse = projectile.gUsed;
  const kUse = projectile.k;
  const air = projectile.air;

  let range, maxHeight, timeOfFlight;

  if (!air) {
    timeOfFlight = ((2 * v * Math.sin(theta)) / gUse).toFixed(3);
    maxHeight = ((v ** 2 * Math.sin(theta) ** 2) / (2 * gUse)).toFixed(3);
    range = ((v ** 2 * Math.sin(2 * theta)) / gUse).toFixed(3);
  } else {
    // numerical approximation (v^2 drag) for results display
    let vx = v * Math.cos(theta);
    let vy = v * Math.sin(theta);
    let x = 0, y = 0, maxY = 0, t = 0;
    const dt = 0.01;

    while (y >= 0) {
      const speed = Math.sqrt(vx * vx + vy * vy);
      const ax = -kUse * speed * vx;
      const ay = -gUse - kUse * speed * vy;

      vx += ax * dt;
      vy += ay * dt;

      x += vx * dt;
      y += vy * dt;

      if (y > maxY) maxY = y;
      t += dt;

      if (y < 0) break;
    }

    range = x.toFixed(3);
    maxHeight = maxY.toFixed(3);
    timeOfFlight = t.toFixed(3);
  }

  
  const entry = document.createElement("p");
  entry.innerHTML = `
    <strong style="color:${projectile.color}">Projectile ${projectileCount}:</strong><br>
    Angle: ${projectile.angle.toFixed(1)}° | Velocity: ${projectile.velocity.toFixed(3)} m/s<br>
    Gravity: ${gUse.toFixed(3)} m/s² | Air: ${air ? "On" : "Off"} (k=${kUse.toFixed(3)})<br>
    Range: ${range} m<br>
    Max Height: ${maxHeight} m<br>
    Time of Flight: ${timeOfFlight} s
  `;
  document.getElementById("resultsList").prepend(entry);
}
