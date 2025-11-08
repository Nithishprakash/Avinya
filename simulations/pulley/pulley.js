let pulleys = [], movablePulleys = [], loads = [], connections = [];
let draggingItem = null, offsetX, offsetY, selectedConnector = null;
let fixedIcon, movableIcon, loadIcon;
let iconSize = 80, nextId = 1, SNAP_DISTANCE = 20;
let simulationPairs = [], isSimulating = false, lastTime = 0;

const boundary = { left: 60, top: 60, right: 680, bottom: 500 };
let dustbin = { x: boundary.right - 50, y: boundary.bottom - 50, size: 60 };

function setup() {
  let canvas = createCanvas(900, 550);
  canvas.parent("pulleyCanvasContainer");
  canvas.elt.oncontextmenu = () => false;

  const sidebarX = width - 120;
  fixedIcon   = { x: sidebarX, y: 130, type: "fixed" };
  movableIcon = { x: sidebarX, y: 280, type: "movable" };
  loadIcon    = { x: sidebarX, y: 430, type: "load" };

  document.getElementById("startBtn").onclick = startSimulation;
}

function draw() {
  background("#f8fbff");
  drawCanvasBoundary();
  drawSidebarIcons();
  drawConnections();

  pulleys.forEach(p => drawPulley(p, "fixed"));
  movablePulleys.forEach(p => drawPulley(p, "movable"));
  loads.forEach(drawLoad);

  drawDustbin();

  if (selectedConnector) {
    stroke("#007bff"); strokeWeight(2);
    line(selectedConnector.x, selectedConnector.y, mouseX, mouseY);
  }

  if (isSimulating) {
    const now = millis();
    const dt = (now - lastTime) / 1000;
    updatePhysics(dt);
    lastTime = now;
  }
}

/* ===============================
   DRAWING HELPERS
=============================== */
function drawCanvasBoundary() {
  push();
  noFill(); stroke("#000"); strokeWeight(2);
  rectMode(CORNERS);
  rect(boundary.left, boundary.top, boundary.right, boundary.bottom, 10);
  pop();
}

function drawSidebarIcons() {
  drawIcon(fixedIcon, "#007bff", "Fixed Pulley");
  drawIcon(movableIcon, "#00aa55", "Movable Pulley");
  drawIcon(loadIcon, "#ff8800", "Load");
}

function drawIcon(icon, color, label) {
  push();
  fill("#ffffff"); stroke(color); strokeWeight(2);
  rectMode(CENTER);
  rect(icon.x, icon.y, iconSize + 20, iconSize + 40, 15);

  if (icon.type !== "load")
    drawPulley({ x: icon.x, y: icon.y - 10, r: 25 }, icon.type, true);
  else {
    fill(color);
    rect(icon.x - 20, icon.y - 25, 40, 40, 5);
  }

  noStroke();
  fill(color);
  textAlign(CENTER, CENTER);
  textSize(13);
  text(label, icon.x, icon.y + 28);
  pop();
}

function drawPulley(p, type = "fixed", preview = false) {
  const { x, y, r = 25, rotation = 0 } = p;
  push();
  translate(x, y);
  rotate(radians(rotation));

  fill(preview ? "rgba(0,123,255,0.25)" : (type === "movable" ? "#00aa55" : "#007bff"));
  ellipse(0, 0, r * 2);

  fill("#555");
  rectMode(CENTER);
  const barHeight = r + 20;
  rect(0, -barHeight / 2, 10, barHeight);

  if (type === "fixed") {
    fill("#555");
    rect(0, -barHeight + 5, r + 20, 10);
  }

  const aPos = createVector(-r - 5, 0);
  const bPos = createVector(r + 5, 0);
  const cPos = createVector(0, -barHeight);

  p.connectionPoints = {
    a: { x: x + aPos.x, y: y + aPos.y },
    b: { x: x + bPos.x, y: y + bPos.y }
  };
  if (type === "movable") p.connectionPoints.c = { x: x + cPos.x, y: y + cPos.y };

  for (let s in p.connectionPoints) {
    const cp = p.connectionPoints[s];
    push();
    resetMatrix();
    stroke(isConnectorUsed(p.id, s) ? "#007bff" : 80);
    fill(isConnectorUsed(p.id, s) ? "#d0e8ff" : "#f8f9fa");
    ellipse(cp.x, cp.y, 12);
    pop();
  }
  pop();
}

function drawLoad(l) {
  push();
  fill("#ff8800");
  stroke("#aa5500");
  rect(l.x, l.y, l.w, l.h, 5);

  const cx = l.x + l.w / 2;
  const cy = l.y - 6;
  l.connectionPoint = { x: cx, y: cy };

  stroke(isConnectorUsed(l.id, "c") ? "#007bff" : 80);
  strokeWeight(2);
  fill(isConnectorUsed(l.id, "c") ? "#d0e8ff" : "#f8f9fa");
  ellipse(cx, cy, 12);

  noStroke();
  fill("#333");
  textSize(10);
  textAlign(CENTER, CENTER);
  text("C", cx, cy - 12);

  fill("#fff");
  text(`${l.mass}kg`, l.x + l.w / 2, l.y + l.h / 2);
  pop();
}

function drawDustbin() {
  push();
  fill("#e74c3c");
  rectMode(CENTER);
  rect(dustbin.x, dustbin.y, dustbin.size, dustbin.size, 10);
  fill("#fff");
  textAlign(CENTER, CENTER);
  textSize(18);
  text("🗑️", dustbin.x, dustbin.y + 2);
  pop();
}

/* ===============================
   MOUSE & CONNECTION LOGIC
=============================== */
function mousePressed() {
  // Connectors first
  const clicked = findClickedConnector(mouseX, mouseY);
  if (clicked) {
    if (isConnectorUsed(clicked.id, clicked.side)) return;

    if (mouseButton === RIGHT) {
      removeConnection(clicked);
      return;
    }

    if (!selectedConnector) selectedConnector = clicked;
    else {
      if (!(clicked.id === selectedConnector.id && clicked.side === selectedConnector.side)) {
        connections.push({ from: selectedConnector, to: clicked });
      }
      selectedConnector = null;
    }
    return;
  }

  // Sidebar icons
  for (let icon of [fixedIcon, movableIcon, loadIcon]) {
    if (mouseX > icon.x - 50 && mouseX < icon.x + 50 && mouseY > icon.y - 50 && mouseY < icon.y + 50) {
      if (icon.type === "load")
        draggingItem = { fromIcon: true, type: "load", w: 40, h: 40, mass: 1 };
      else
        draggingItem = { fromIcon: true, type: icon.type, r: 25, rotation: 0 };
      return;
    }
  }

  // Existing objects
  for (let arr of [pulleys, movablePulleys, loads]) {
    for (let o of arr) {
      if (o.type === "load") {
        if (mouseX > o.x && mouseX < o.x + o.w && mouseY > o.y && mouseY < o.y + o.h) {
          draggingItem = o;
          offsetX = mouseX - o.x;
          offsetY = mouseY - o.y;
          return;
        }
      } else if (dist(mouseX, mouseY, o.x, o.y) < o.r + 10) {
        if (mouseButton === RIGHT) o.rotation = (o.rotation + 90) % 360;
        else {
          draggingItem = o;
          offsetX = mouseX - o.x;
          offsetY = mouseY - o.y;
        }
        return;
      }
    }
  }
}

function mouseReleased() {
  if (draggingItem && draggingItem.fromIcon) {
    if (mouseX > boundary.left && mouseX < boundary.right && mouseY > boundary.top && mouseY < boundary.bottom) {
      if (draggingItem.type === "fixed")
        pulleys.push({ id: nextId++, x: mouseX, y: mouseY, r: 25, rotation: 0, type: "fixed" });
      else if (draggingItem.type === "movable")
        movablePulleys.push({ id: nextId++, x: mouseX, y: mouseY, r: 25, rotation: 0, type: "movable" });
      else if (draggingItem.type === "load") {
        let m = prompt("Enter load mass (kg):", "1");
        if (m !== null && !isNaN(m))
          loads.push({ id: nextId++, x: mouseX - 20, y: mouseY - 20, w: 40, h: 40, mass: parseFloat(m), type: "load" });
      }
    }
  }

  // Delete if near dustbin
  pulleys = pulleys.filter(o => dist(o.x, o.y, dustbin.x, dustbin.y) > 50);
  movablePulleys = movablePulleys.filter(o => dist(o.x, o.y, dustbin.x, dustbin.y) > 50);
  loads = loads.filter(o => dist(o.x, o.y, dustbin.x, dustbin.y) > 50);

  draggingItem = null;
}

function mouseDragged() {
  if (draggingItem && !draggingItem.fromIcon) {
    let nx = mouseX - offsetX;
    let ny = mouseY - offsetY;

    if (draggingItem.type === "fixed") {
      const off = draggingItem.r + 20;
      if (abs(ny - (boundary.top + off)) < SNAP_DISTANCE) ny = boundary.top + off;
      else if (abs(ny - (boundary.bottom - off)) < SNAP_DISTANCE) ny = boundary.bottom - off;
      else if (abs(nx - (boundary.left + off)) < SNAP_DISTANCE) nx = boundary.left + off;
      else if (abs(nx - (boundary.right - off)) < SNAP_DISTANCE) nx = boundary.right - off;
    }

    draggingItem.x = constrain(nx, boundary.left + 20, boundary.right - 20);
    draggingItem.y = constrain(ny, boundary.top + 20, boundary.bottom - 20);
  }
}

function keyPressed() {
  if (keyCode === ESCAPE && selectedConnector) selectedConnector = null;
}

function drawConnections() {
  stroke("#444"); strokeWeight(2);
  for (let c of connections) {
    const a = getConnectorPosition(c.from);
    const b = getConnectorPosition(c.to);
    if (a && b) line(a.x, a.y, b.x, b.y);
  }
}

function getConnectorPosition(conn) {
  const all = [...pulleys, ...movablePulleys, ...loads];
  const o = all.find(x => x.id === conn.id);
  if (!o) return null;
  if (o.type === "load") return o.connectionPoint;
  return o.connectionPoints ? o.connectionPoints[conn.side] : null;
}

function findClickedConnector(mx, my) {
  const all = [...pulleys, ...movablePulleys, ...loads];
  for (let o of all) {
    const pts = o.type === "load" ? { c: o.connectionPoint } : o.connectionPoints;
    if (!pts) continue;
    for (let s in pts) {
      const cp = pts[s];
      if (cp && dist(mx, my, cp.x, cp.y) < 12)
        return { id: o.id, side: s, x: cp.x, y: cp.y };
    }
  }
  return null;
}

function isConnectorUsed(id, side) {
  return connections.some(c =>
    (c.from.id === id && c.from.side === side) ||
    (c.to.id === id && c.to.side === side)
  );
}

function removeConnection(conn) {
  connections = connections.filter(
    c => !(
      (c.from.id === conn.id && c.from.side === conn.side) ||
      (c.to.id === conn.id && c.to.side === conn.side)
    )
  );
}

/* ===============================
   PHYSICS (ALIGNED + STOP SAFE)
=============================== */
function getMassConnectedTo(pid, side) {
  const c = connections.find(x =>
    (x.from.id === pid && x.from.side === side) ||
    (x.to.id === pid && x.to.side === side)
  );
  if (!c) return null;
  const other = c.from.id === pid ? c.to : c.from;
  return loads.find(l => l.id === other.id) || null;
}

function startSimulation() {
  if (isSimulating) return;
  simulationPairs = [];

  pulleys.forEach(p => {
    const A = getMassConnectedTo(p.id, "a");
    const B = getMassConnectedTo(p.id, "b");
    if (A && B) {
      const g = 9.8;
      const a = ((B.mass - A.mass) * g) / (A.mass + B.mass);
      const T = (2 * A.mass * B.mass * g) / (A.mass + B.mass);
      simulationPairs.push({ pid: p.id, A, B, a, T });
    }
  });

  if (simulationPairs.length > 0) {
    isSimulating = true;
    lastTime = millis();
  }
}

function updatePhysics(dt) {
  if (!isSimulating) return;
  const scale = 35;
  const safeGap = 35; // stop before small connector circles

  simulationPairs.forEach(sim => {
    const { A, B, a, T, pid } = sim;
    const pulley = pulleys.find(p => p.id === pid);
    if (!pulley) return;

    const direction = B.mass > A.mass ? 1 : -1;
    A.velocity = A.velocity || 0;
    B.velocity = B.velocity || 0;

    // Apply acceleration
    A.velocity -= direction * a * dt;
    B.velocity += direction * a * dt;

    // Update positions
    A.y += A.velocity * scale * dt;
    B.y += B.velocity * scale * dt;

    // Keep x aligned with pulley connectors
    A.x = pulley.connectionPoints.a.x - A.w / 2;
    B.x = pulley.connectionPoints.b.x - B.w / 2;

    // Prevent overlap with pulley circles
    const pulleyTop = pulley.y - pulley.r - safeGap;
    const bottomY = boundary.bottom - A.h - 5;

    if (A.y <= pulleyTop || B.y <= pulleyTop || A.y >= bottomY || B.y >= bottomY) {
      A.velocity = 0;
      B.velocity = 0;
      isSimulating = false;
    }

    document.getElementById("accValue").textContent = Math.abs(a).toFixed(2);
    document.getElementById("tensionValue").textContent = T.toFixed(2);
  });
}
