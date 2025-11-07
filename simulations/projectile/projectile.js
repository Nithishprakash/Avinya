// === Controls ===
const angleSlider = document.getElementById("angleSlider");
const angleInput = document.getElementById("angleInput");
const velocitySlider = document.getElementById("velocitySlider");
const velocityInput = document.getElementById("velocityInput");
const launchButton = document.getElementById("launchBtn");
const clearButton = document.getElementById("clearBtn");

// === Globals ===
let airResistanceEnabled = false;
let dragCoefficient = 0.02; // k value for air resistance
let g = 9.8;
let baseScale = 20;
let scale = baseScale;
let groundY;
let trajectories = [];
let colors = ["#007BFF", "#FF6B00", "#00C49A", "#AA00FF", "#FF004C", "#008080"];
let colorIndex = 0;
let projectileCount = 0;
let maxRangeSeen = 30;

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

// === p5 Setup ===
function setup() {
  let canvas = createCanvas(900, 500);
  canvas.parent("projectileCanvasContainer");
  groundY = height - 50;
}

// === Physics parameter controls ===
const gravityInput = document.getElementById("gravityInput");
const dragInput = document.getElementById("dragInput");
const airResistanceToggle = document.getElementById("airResistanceToggle");

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


// === p5 Draw ===
function draw() {
  background("#f8fbff");
  drawStaticElements();

  for (let projectile of trajectories) {
    if (!projectile.hasLanded) {
      projectile.t += deltaTime / 1000;
      //const x = projectile.velocity * Math.cos((projectile.angle * Math.PI) / 180) * projectile.t;
      /*const y =
        projectile.velocity * Math.sin((projectile.angle * Math.PI) / 180) * projectile.t -
        0.5 * g * projectile.t * projectile.t;*/
        let x, y;

// --- Case 1: Normal projectile (no air resistance)
if (!airResistanceEnabled) {
  x = projectile.velocity * Math.cos((projectile.angle * Math.PI) / 180) * projectile.t;
  y = projectile.velocity * Math.sin((projectile.angle * Math.PI) / 180) * projectile.t -
      0.5 * g * projectile.t * projectile.t;
}
// --- Case 2: With air resistance (simplified linear drag model)
else {
  const v0 = projectile.velocity;
  const theta = (projectile.angle * Math.PI) / 180;
  const k = dragCoefficient;

  const vx0 = v0 * Math.cos(theta);
  const vy0 = v0 * Math.sin(theta);

  // Analytic solution for motion with linear drag
  const eTerm = Math.exp(-k * projectile.t);
  x = (vx0 / k) * (1 - eTerm);
  y = (1 / k) * ((vy0 + g / k) * (1 - eTerm)) - (g * projectile.t) / k;
}

      const ballX = 40 + x * scale;
      const ballY = groundY - y * scale;

      if (ballY >= groundY) {
        projectile.hasLanded = true;
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
      circle(last.x, last.y, 20);
    }
  }
}

// === Draw axes and markings ===
function drawStaticElements() {
  stroke(80);
  strokeWeight(3);
  line(40, groundY, width - 40, groundY); // x-axis
  line(40, groundY, 40, 50); // y-axis

  const visibleMetersX = Math.floor((width - 80) / scale);
  const visibleMetersY = Math.floor((groundY - 50) / scale);

  // --- Dynamic tick spacing ---
  let step = 1;
  if (scale < 18) step = 2;      // start simplifying early
  if (scale < 12) step = 5;
  if (scale < 8) step = 10;
  if (scale < 4) step = 20;

  textSize(12);
  fill(60);
  noStroke();

  // X-axis markings
  textAlign(CENTER);
  for (let i = 0; i <= visibleMetersX; i += step) {
    const x = 40 + i * scale;
    stroke(160);
    line(x, groundY, x, groundY - 10);
    noStroke();
    text(i, x, groundY + 18);
  }

  // Y-axis markings
  textAlign(RIGHT, CENTER);
  for (let j = 0; j <= visibleMetersY; j += step) {
    const y = groundY - j * scale;
    stroke(160);
    line(35, y, 45, y);
    noStroke();
    text(j, 28, y);
  }

  // Axis labels
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

  const projectile = {
    angle: angle,
    velocity: velocity,
    t: 0,
    path: [],
    color: colors[colorIndex % colors.length],
    hasLanded: false,
  };
  colorIndex++;

  // Check for scaling need first
  const scaleChanged = autoScaleIfNeeded(projectile);

  // Add projectile after scaling adjustments
  trajectories.push(projectile);

  // If scaling happened, we instantly redraw old projectiles (already handled by draw)
  // But let new projectile animate naturally
  if (!scaleChanged) {
    // nothing special — normal launch
  }
});

// === Auto scaling ===
function autoScaleIfNeeded(newProj) {
  // Calculate the projectile’s full physics-based reach
  const range = (Math.pow(newProj.velocity, 2) * Math.sin(2 * (newProj.angle * Math.PI) / 180)) / g;
  const maxHeight = (Math.pow(newProj.velocity, 2) * Math.pow(Math.sin((newProj.angle * Math.PI) / 180), 2)) / (2 * g);

  let scaleChanged = false;

  // Compute visible world in meters
  const visibleMetersX = (width - 120) / scale; // add side margins
  const visibleMetersY = (groundY - 80) / scale; // add top & bottom margins

  // Compute shrink factors needed for both directions
  const shrinkX = range > visibleMetersX ? range / visibleMetersX : 1;
  const shrinkY = maxHeight > visibleMetersY ? maxHeight / visibleMetersY : 1;

  // Choose the more restrictive one — we must fit both
  const shrinkFactor = Math.max(shrinkX, shrinkY);

  if (shrinkFactor > 1.05) { // tolerance to avoid micro jitter
    scale /= shrinkFactor;
    scaleChanged = true;
    maxRangeSeen = Math.max(maxRangeSeen, range);

    // Instantly recompute all previous trajectories for new scale
    for (let proj of trajectories) {
      proj.path = [];
      let dt = 0.05;
      let t = 0;
      while (true) {
        const x = proj.velocity * Math.cos((proj.angle * Math.PI) / 180) * t;
        const y =
          proj.velocity * Math.sin((proj.angle * Math.PI) / 180) * t -
          0.5 * g * t * t;
        if (y < 0) break;
        proj.path.push({ x: 40 + x * scale, y: groundY - y * scale });
        t += dt;
      }
      proj.hasLanded = true;
    }
  }

  return scaleChanged;
}


// === Clear ===
clearButton.addEventListener("click", () => {
  trajectories = [];
  projectileCount = 0;
  scale = baseScale;
  maxRangeSeen = 30;
  document.getElementById("resultsList").innerHTML =
    '<p style="color:#666; font-style:italic;">No projectiles launched yet</p>';
});

// === Update results ===
function updateResults(projectile) {
  projectileCount++;
  const v = projectile.velocity;
  const theta = (projectile.angle * Math.PI) / 180;
  const resultsList = document.getElementById("resultsList");
  if (projectileCount === 1) resultsList.innerHTML = "";

  let range, maxHeight, timeOfFlight;

  // === Case 1: Air resistance OFF (analytical) ===
  if (!airResistanceEnabled) {
    timeOfFlight = ((2 * v * Math.sin(theta)) / g).toFixed(3);
    maxHeight = ((v ** 2 * Math.sin(theta) ** 2) / (2 * g)).toFixed(3);
    range = ((v ** 2 * Math.sin(2 * theta)) / g).toFixed(3);
  }

  // === Case 2: Air resistance ON (numerical approximation) ===
  else {
    const k = dragCoefficient;

    // initial velocity components
    let vx = v * Math.cos(theta);
    let vy = v * Math.sin(theta);

    // initial positions and trackers
    let x = 0;
    let y = 0;
    let maxY = 0;
    let t = 0;
    const dt = 0.01; // time step

    // integrate motion until projectile hits ground
    while (y >= 0) {
      // compute current speed
      const speed = Math.sqrt(vx * vx + vy * vy);

      // drag accelerations (proportional to v²)
      const ax = -k * speed * vx;
      const ay = -g - k * speed * vy;

      // update velocities
      vx += ax * dt;
      vy += ay * dt;

      // update positions
      x += vx * dt;
      y += vy * dt;

      // track peak height
      if (y > maxY) maxY = y;

      // increment time
      t += dt;

      // stop when below ground
      if (y < 0) break;
    }

    range = x.toFixed(3);
    maxHeight = maxY.toFixed(3);
    timeOfFlight = t.toFixed(3);
  }

  // === Display results ===
  const entry = document.createElement("p");
  entry.innerHTML = `
    <strong style="color:${projectile.color}">Projectile ${projectileCount}:</strong><br>
    Angle: ${projectile.angle.toFixed(1)}° | Velocity: ${projectile.velocity.toFixed(3)} m/s<br>
    Gravity: ${g.toFixed(3)} m/s² | Air: ${airResistanceEnabled ? "On" : "Off"} (k=${dragCoefficient.toFixed(3)})<br>
    Range: ${range} m<br>
    Max Height: ${maxHeight} m<br>
    Time of Flight: ${timeOfFlight} s
  `;
  resultsList.prepend(entry);
}