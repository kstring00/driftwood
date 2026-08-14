(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const ui = {
    start: document.getElementById('startScreen'),
    death: document.getElementById('deathScreen'),
    hud: document.getElementById('hud'),
    phase: document.getElementById('phaseLabel'),
    clock: document.getElementById('clockLabel'),
    healthBar: document.getElementById('healthBar'),
    healthText: document.getElementById('healthText'),
    infectionBar: document.getElementById('infectionBar'),
    infectionText: document.getElementById('infectionText'),
    powerBar: document.getElementById('powerBar'),
    powerText: document.getElementById('powerText'),
    powerName: document.getElementById('powerName'),
    wood: document.getElementById('woodCount'),
    herb: document.getElementById('herbCount'),
    crystal: document.getElementById('crystalCount'),
    kills: document.getElementById('killCount'),
    objective: document.getElementById('objective'),
    message: document.getElementById('message'),
    abilityQ: document.getElementById('abilityQ'),
    abilityR: document.getElementById('abilityR'),
    deathTitle: document.getElementById('deathTitle'),
    deathStats: document.getElementById('deathStats'),
  };

  const WORLD = { w: 3000, h: 2200 };
  const DAY_LENGTH = 55;
  const NIGHT_LENGTH = 48;
  const TAU = Math.PI * 2;
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };

  let state = null;
  let raf = 0;
  let previous = performance.now();
  let msgTimer = 0;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function normalize(x, y) {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  function createState(playerClass) {
    const player = {
      x: WORLD.w / 2, y: WORLD.h / 2, r: 16,
      speed: 235, health: 100, maxHealth: 100,
      infection: 0, power: 100, maxPower: 100,
      className: playerClass,
      facing: { x: 1, y: 0 }, attackCd: 0, qCd: 0, rCd: 0,
      inv: { wood: 2, herb: 1, crystal: 0 }, kills: 0,
    };

    const resources = [];
    const safe = 230;
    for (let i = 0; i < 78; i++) {
      let x, y;
      do { x = rand(70, WORLD.w - 70); y = rand(70, WORLD.h - 70); }
      while (Math.hypot(x - player.x, y - player.y) < safe);
      resources.push({ id: crypto.randomUUID(), type: 'tree', x, y, r: rand(22, 32), hp: 3, maxHp: 3 });
    }
    for (let i = 0; i < 40; i++) resources.push({ id: crypto.randomUUID(), type: 'herb', x: rand(80, WORLD.w - 80), y: rand(80, WORLD.h - 80), r: 12, hp: 1, maxHp: 1 });
    for (let i = 0; i < 25; i++) resources.push({ id: crypto.randomUUID(), type: 'crystal', x: rand(80, WORLD.w - 80), y: rand(80, WORLD.h - 80), r: 14, hp: 2, maxHp: 2 });

    return {
      running: true,
      player,
      resources,
      buildings: [],
      enemies: [],
      projectiles: [],
      particles: [],
      floaters: [],
      day: 1,
      phase: 'day',
      phaseTime: DAY_LENGTH,
      nightsSurvived: 0,
      waveSpawnTimer: 1,
      buildMode: null,
      camera: { x: player.x, y: player.y },
      elapsed: 0,
    };
  }

  function start(playerClass) {
    state = createState(playerClass);
    ui.start.classList.add('hidden');
    ui.death.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.powerName.textContent = playerClass === 'holy' ? 'FAITH' : 'MANA';
    ui.abilityQ.textContent = playerClass === 'holy' ? 'Smite' : 'Arcane Bolt';
    ui.abilityR.textContent = playerClass === 'holy' ? 'Cleanse' : 'Frost Nova';
    showMessage('Dawn breaks. Gather. Build. Prepare.');
    previous = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  document.querySelectorAll('[data-class]').forEach(btn => btn.addEventListener('click', () => start(btn.dataset.class)));
  document.getElementById('restartBtn').addEventListener('click', () => {
    ui.death.classList.add('hidden');
    ui.start.classList.remove('hidden');
    ui.hud.classList.add('hidden');
  });

  document.querySelectorAll('[data-build]').forEach(btn => {
    btn.addEventListener('click', () => setBuildMode(btn.dataset.build));
  });

  addEventListener('keydown', e => {
    keys.add(e.key.toLowerCase());
    if (!state || !state.running) return;
    if (['1', '2', '3'].includes(e.key)) setBuildMode({ '1': 'barricade', '2': 'campfire', '3': 'ward' }[e.key]);
    if (e.key.toLowerCase() === 'e') harvest();
    if (e.key.toLowerCase() === 'q') useQ();
    if (e.key.toLowerCase() === 'r') useR();
    if (e.key === 'Escape') setBuildMode(null);
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  canvas.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (state) {
      const world = screenToWorld(mouse.x, mouse.y);
      state.player.facing = normalize(world.x - state.player.x, world.y - state.player.y);
    }
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0 || !state || !state.running) return;
    mouse.down = true;
    if (state.buildMode) placeBuilding(); else basicAttack();
  });
  addEventListener('mouseup', () => mouse.down = false);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  function setBuildMode(type) {
    if (!state) return;
    state.buildMode = state.buildMode === type ? null : type;
    document.querySelectorAll('[data-build]').forEach(btn => btn.classList.toggle('active', btn.dataset.build === state.buildMode));
  }

  function screenToWorld(x, y) {
    return { x: x + state.camera.x - innerWidth / 2, y: y + state.camera.y - innerHeight / 2 };
  }

  function showMessage(text) {
    ui.message.textContent = text;
    ui.message.classList.add('show');
    msgTimer = 2.4;
  }

  function addFloater(x, y, text, color = '#f0f7f2') {
    state.floaters.push({ x, y, text, color, life: 1.2 });
  }

  function harvest() {
    const p = state.player;
    let nearest = null;
    let best = 66;
    for (const r of state.resources) {
      const d = distance(p, r);
      if (d < best) { best = d; nearest = r; }
    }
    if (!nearest) { showMessage('Nothing close enough to harvest.'); return; }
    nearest.hp -= 1;
    burst(nearest.x, nearest.y, nearest.type === 'tree' ? '#7d9b72' : nearest.type === 'herb' ? '#88c98f' : '#bca9ff', 7);
    if (nearest.hp <= 0) {
      if (nearest.type === 'tree') { const n = Math.floor(rand(3, 6)); p.inv.wood += n; addFloater(nearest.x, nearest.y, `+${n} wood`); }
      if (nearest.type === 'herb') { const n = Math.floor(rand(1, 3)); p.inv.herb += n; addFloater(nearest.x, nearest.y, `+${n} herb`, '#a7eab0'); }
      if (nearest.type === 'crystal') { p.inv.crystal += 1; addFloater(nearest.x, nearest.y, '+1 crystal', '#cbbcff'); }
      state.resources = state.resources.filter(r => r !== nearest);
    }
  }

  const BUILD = {
    barricade: { wood: 4, herb: 0, r: 24, hp: 120 },
    campfire: { wood: 8, herb: 0, r: 25, hp: 80 },
    ward: { wood: 6, herb: 2, r: 28, hp: 90 },
  };

  function placeBuilding() {
    const type = state.buildMode;
    const cfg = BUILD[type];
    const p = state.player;
    const w = screenToWorld(mouse.x, mouse.y);
    const d = Math.hypot(w.x - p.x, w.y - p.y);
    if (d > 150) { showMessage('Build closer to yourself.'); return; }
    if (p.inv.wood < cfg.wood || p.inv.herb < cfg.herb) { showMessage('Not enough materials.'); return; }
    if (state.buildings.some(b => Math.hypot(b.x - w.x, b.y - w.y) < b.r + cfg.r + 8)) { showMessage('Too close to another structure.'); return; }
    p.inv.wood -= cfg.wood; p.inv.herb -= cfg.herb;
    state.buildings.push({ type, x: clamp(w.x, 40, WORLD.w - 40), y: clamp(w.y, 40, WORLD.h - 40), r: cfg.r, hp: cfg.hp, maxHp: cfg.hp, pulse: 0 });
    burst(w.x, w.y, '#d9c58d', 12);
    showMessage(`${type[0].toUpperCase() + type.slice(1)} built.`);
  }

  function basicAttack() {
    const p = state.player;
    if (p.attackCd > 0) return;
    p.attackCd = p.className === 'mage' ? .28 : .34;
    shoot(p.x + p.facing.x * 22, p.y + p.facing.y * 22, p.facing, p.className === 'mage' ? 18 : 16, p.className === 'mage' ? '#c1b0ff' : '#d9e9c2', 580, 1.1);
  }

  function useQ() {
    const p = state.player;
    if (p.qCd > 0) return;
    if (p.className === 'holy') {
      if (p.power < 24) { showMessage('Not enough faith.'); return; }
      p.power -= 24; p.qCd = 2.2;
      const target = nearestEnemy(360);
      const dir = target ? normalize(target.x - p.x, target.y - p.y) : p.facing;
      shoot(p.x, p.y, dir, 52, '#f4efad', 720, .8, 8);
      addFloater(p.x, p.y - 28, 'SMITE', '#f4efad');
    } else {
      if (p.power < 18) { showMessage('Not enough mana.'); return; }
      p.power -= 18; p.qCd = 1.4;
      for (let a = -0.12; a <= 0.12; a += 0.12) {
        const base = Math.atan2(p.facing.y, p.facing.x) + a;
        shoot(p.x, p.y, { x: Math.cos(base), y: Math.sin(base) }, 26, '#a991ff', 760, .95);
      }
      addFloater(p.x, p.y - 28, 'ARCANE', '#c0adff');
    }
  }

  function useR() {
    const p = state.player;
    if (p.rCd > 0) return;
    if (p.className === 'holy') {
      if (p.power < 42) { showMessage('Not enough faith.'); return; }
      p.power -= 42; p.rCd = 10;
      p.infection = Math.max(0, p.infection - 32);
      p.health = Math.min(p.maxHealth, p.health + 22);
      burst(p.x, p.y, '#e6f2b2', 34, 180);
      showMessage('Cleanse: infection purged, wounds restored.');
    } else {
      if (p.power < 38) { showMessage('Not enough mana.'); return; }
      p.power -= 38; p.rCd = 8.5;
      for (const e of state.enemies) {
        const d = distance(p, e);
        if (d < 210) {
          e.health -= 26; e.slow = 4;
          const dir = normalize(e.x - p.x, e.y - p.y);
          e.x += dir.x * 60; e.y += dir.y * 60;
        }
      }
      burst(p.x, p.y, '#a9d6ff', 46, 220);
      showMessage('Frost Nova: nearby enemies slowed.');
    }
  }

  function nearestEnemy(range) {
    let target = null, best = range;
    for (const e of state.enemies) {
      const d = distance(state.player, e);
      if (d < best) { best = d; target = e; }
    }
    return target;
  }

  function shoot(x, y, dir, damage, color, speed, life, size = 5) {
    state.projectiles.push({ x, y, vx: dir.x * speed, vy: dir.y * speed, damage, color, life, r: size });
  }

  function burst(x, y, color, count, speed = 90) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU), s = rand(speed * .35, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.25, .8), max: .8, color, size: rand(1, 4) });
    }
  }

  function spawnEnemy() {
    const p = state.player;
    const angle = rand(0, TAU);
    const radius = Math.max(innerWidth, innerHeight) * .72 + rand(60, 240);
    const x = clamp(p.x + Math.cos(angle) * radius, 30, WORLD.w - 30);
    const y = clamp(p.y + Math.sin(angle) * radius, 30, WORLD.h - 30);
    const roll = Math.random();
    let type = 'drowned';
    if (state.day >= 2 && roll > .62) type = 'rotter';
    if (state.day >= 3 && roll > .86) type = 'wraith';
    const cfg = {
      drowned: { r: 15, health: 42 + state.day * 4, speed: 82 + state.day * 2, damage: 8, infection: 2, color: '#7f9b8d' },
      rotter: { r: 17, health: 58 + state.day * 6, speed: 68, damage: 9, infection: 7, color: '#8e8a58' },
      wraith: { r: 13, health: 34 + state.day * 5, speed: 126, damage: 11, infection: 4, color: '#8775ae' },
    }[type];
    state.enemies.push({ type, x, y, ...cfg, maxHealth: cfg.health, hitCd: 0, slow: 0 });
  }

  function update(dt) {
    const s = state;
    const p = s.player;
    s.elapsed += dt;
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.qCd = Math.max(0, p.qCd - dt);
    p.rCd = Math.max(0, p.rCd - dt);
    p.power = Math.min(p.maxPower, p.power + dt * (p.className === 'holy' ? 7 : 10));

    let mx = 0, my = 0;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (mx || my) {
      const dir = normalize(mx, my);
      p.x = clamp(p.x + dir.x * p.speed * dt, 22, WORLD.w - 22);
      p.y = clamp(p.y + dir.y * p.speed * dt, 22, WORLD.h - 22);
    }

    if (mouse.down && !s.buildMode) basicAttack();

    s.phaseTime -= dt;
    if (s.phaseTime <= 0) {
      if (s.phase === 'day') {
        s.phase = 'night'; s.phaseTime = NIGHT_LENGTH; s.waveSpawnTimer = .5;
        showMessage(`Night ${s.day}. The fog is moving.`);
      } else {
        s.phase = 'day'; s.phaseTime = DAY_LENGTH; s.nightsSurvived += 1; s.day += 1;
        s.enemies = s.enemies.filter(e => e.type === 'wraith' && Math.random() < .15);
        p.health = Math.min(p.maxHealth, p.health + 12);
        p.infection = Math.max(0, p.infection - 6);
        respawnResources();
        showMessage(`Dawn ${s.day}. You survived the night.`);
      }
    }

    if (s.phase === 'night') {
      s.waveSpawnTimer -= dt;
      if (s.waveSpawnTimer <= 0) {
        const maxEnemies = 8 + s.day * 4;
        if (s.enemies.length < maxEnemies) spawnEnemy();
        s.waveSpawnTimer = Math.max(.55, 2.25 - s.day * .13);
      }
    }

    updateBuildings(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateFloaters(dt);

    if (p.infection >= 100) p.health -= 8 * dt;
    if (p.health <= 0) die();

    const smoothing = 1 - Math.pow(.0008, dt);
    s.camera.x += (p.x - s.camera.x) * smoothing;
    s.camera.y += (p.y - s.camera.y) * smoothing;
    const halfW = Math.min(innerWidth / 2, WORLD.w / 2);
    const halfH = Math.min(innerHeight / 2, WORLD.h / 2);
    s.camera.x = clamp(s.camera.x, halfW, WORLD.w - halfW);
    s.camera.y = clamp(s.camera.y, halfH, WORLD.h - halfH);

    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) ui.message.classList.remove('show'); }
    updateUI();
  }

  function respawnResources() {
    const counts = { tree: 0, herb: 0, crystal: 0 };
    state.resources.forEach(r => counts[r.type]++);
    while (counts.tree++ < 72) state.resources.push({ id: crypto.randomUUID(), type: 'tree', x: rand(70, WORLD.w - 70), y: rand(70, WORLD.h - 70), r: rand(22, 32), hp: 3, maxHp: 3 });
    while (counts.herb++ < 34) state.resources.push({ id: crypto.randomUUID(), type: 'herb', x: rand(70, WORLD.w - 70), y: rand(70, WORLD.h - 70), r: 12, hp: 1, maxHp: 1 });
    while (counts.crystal++ < 20) state.resources.push({ id: crypto.randomUUID(), type: 'crystal', x: rand(70, WORLD.w - 70), y: rand(70, WORLD.h - 70), r: 14, hp: 2, maxHp: 2 });
  }

  function updateBuildings(dt) {
    const p = state.player;
    for (const b of state.buildings) {
      b.pulse += dt;
      if (b.type === 'campfire' && distance(p, b) < 115) {
        p.health = Math.min(p.maxHealth, p.health + 2.6 * dt);
        p.infection = Math.max(0, p.infection - 1.7 * dt);
      }
      if (b.type === 'ward') {
        for (const e of state.enemies) {
          if (distance(b, e) < 155) e.health -= 4.2 * dt;
        }
      }
    }
    state.buildings = state.buildings.filter(b => b.hp > 0);
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      e.hitCd = Math.max(0, e.hitCd - dt);
      e.slow = Math.max(0, e.slow - dt);
      let target = p;
      let targetIsBuilding = false;
      let best = distance(e, p);
      for (const b of state.buildings) {
        const d = distance(e, b);
        if (d < best && d < 150) { best = d; target = b; targetIsBuilding = true; }
      }
      const dir = normalize(target.x - e.x, target.y - e.y);
      const speed = e.speed * (e.slow > 0 ? .45 : 1);
      e.x += dir.x * speed * dt;
      e.y += dir.y * speed * dt;
      const reach = e.r + target.r + 4;
      if (distance(e, target) < reach && e.hitCd <= 0) {
        e.hitCd = .85;
        if (targetIsBuilding) {
          target.hp -= e.damage * 1.25;
          burst(target.x, target.y, '#c0a27d', 5);
        } else {
          p.health -= e.damage;
          p.infection = clamp(p.infection + e.infection, 0, 100);
          burst(p.x, p.y, '#d47e6f', 8);
          addFloater(p.x, p.y - 24, `-${e.damage}`, '#ff9b8b');
          if (e.type === 'rotter') showMessage('Rotter bite — infection rising. Find herbs, fire, or a cleanse.');
        }
      }
    }
    for (const e of [...state.enemies]) if (e.health <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    state.enemies = state.enemies.filter(x => x !== e);
    state.player.kills += 1;
    if (Math.random() < .16) state.player.inv.crystal += 1;
    burst(e.x, e.y, e.color, 15);
    addFloater(e.x, e.y, '+1 kill', '#dbe7df');
  }

  function updateProjectiles(dt) {
    for (const pr of state.projectiles) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      for (const e of state.enemies) {
        if (pr.life <= 0) break;
        if (Math.hypot(pr.x - e.x, pr.y - e.y) < pr.r + e.r) {
          e.health -= pr.damage;
          pr.life = 0;
          burst(pr.x, pr.y, pr.color, 7);
          addFloater(e.x, e.y - 18, `-${Math.round(pr.damage)}`, pr.color);
        }
      }
    }
    state.projectiles = state.projectiles.filter(pr => pr.life > 0 && pr.x > 0 && pr.y > 0 && pr.x < WORLD.w && pr.y < WORLD.h);
  }

  function updateParticles(dt) {
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.life -= dt; }
    state.particles = state.particles.filter(p => p.life > 0);
  }

  function updateFloaters(dt) {
    for (const f of state.floaters) { f.y -= 28 * dt; f.life -= dt; }
    state.floaters = state.floaters.filter(f => f.life > 0);
  }

  function die() {
    state.running = false;
    ui.hud.classList.add('hidden');
    ui.death.classList.remove('hidden');
    ui.deathTitle.textContent = `You survived ${state.nightsSurvived} night${state.nightsSurvived === 1 ? '' : 's'}.`;
    ui.deathStats.textContent = `${state.player.kills} enemies defeated · Day ${state.day} reached · ${Math.round(state.player.infection)}% infection`;
  }

  function updateUI() {
    const s = state, p = s.player;
    ui.phase.textContent = `${s.phase === 'day' ? 'DAY' : 'NIGHT'} ${s.day}`;
    const fraction = 1 - s.phaseTime / (s.phase === 'day' ? DAY_LENGTH : NIGHT_LENGTH);
    if (s.phase === 'day') ui.clock.textContent = fraction < .33 ? 'Morning' : fraction < .66 ? 'Afternoon' : 'Dusk';
    else ui.clock.textContent = fraction < .33 ? 'Nightfall' : fraction < .76 ? 'Midnight' : 'Before dawn';
    ui.healthBar.style.width = `${clamp(p.health / p.maxHealth * 100, 0, 100)}%`;
    ui.healthText.textContent = Math.max(0, Math.round(p.health));
    ui.infectionBar.style.width = `${p.infection}%`;
    ui.infectionText.textContent = `${Math.round(p.infection)}%`;
    ui.powerBar.style.width = `${p.power}%`;
    ui.powerText.textContent = Math.round(p.power);
    ui.wood.textContent = p.inv.wood;
    ui.herb.textContent = p.inv.herb;
    ui.crystal.textContent = p.inv.crystal;
    ui.kills.textContent = p.kills;

    if (s.phase === 'day' && s.day === 1) ui.objective.textContent = 'Gather wood and herbs. Build a campfire and barricades before dusk.';
    else if (s.phase === 'night') ui.objective.textContent = `Survive until dawn. ${Math.ceil(s.phaseTime)} seconds remain.`;
    else if (p.infection > 45) ui.objective.textContent = 'Infection is dangerous. Stand near a campfire or use a holy cleanse.';
    else ui.objective.textContent = 'Expand the camp. Stockpile materials. The next night will be worse.';
  }

  function draw() {
    const s = state;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const camX = s ? s.camera.x - innerWidth / 2 : 0;
    const camY = s ? s.camera.y - innerHeight / 2 : 0;

    ctx.save();
    ctx.translate(-camX, -camY);
    drawGround(camX, camY);
    if (s) {
      drawResources();
      drawBuildings();
      drawProjectiles();
      drawEnemies();
      drawPlayer();
      drawParticles();
      drawFloaters();
      drawBuildGhost();
    }
    ctx.restore();

    if (s) drawNightOverlay();
  }

  function drawGround(camX, camY) {
    ctx.fillStyle = '#10211f';
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    ctx.strokeStyle = 'rgba(187, 216, 199, .035)';
    ctx.lineWidth = 1;
    const grid = 56;
    const x0 = Math.floor(camX / grid) * grid;
    const y0 = Math.floor(camY / grid) * grid;
    for (let x = x0; x < camX + innerWidth + grid; x += grid) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, camY + innerHeight + grid); ctx.stroke(); }
    for (let y = y0; y < camY + innerHeight + grid; y += grid) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(camX + innerWidth + grid, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(125, 164, 148, .24)';
    ctx.lineWidth = 4; ctx.strokeRect(8, 8, WORLD.w - 16, WORLD.h - 16);
  }

  function drawResources() {
    for (const r of state.resources) {
      if (r.type === 'tree') {
        ctx.fillStyle = '#273e34'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4c6a55'; ctx.beginPath(); ctx.arc(r.x - 4, r.y - 5, r.r * .72, 0, TAU); ctx.fill();
        ctx.fillStyle = '#7d6748'; ctx.fillRect(r.x - 4, r.y + r.r * .5, 8, 18);
      } else if (r.type === 'herb') {
        ctx.strokeStyle = '#7dc48b'; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) { const a = i * TAU / 4; ctx.beginPath(); ctx.moveTo(r.x, r.y + 5); ctx.quadraticCurveTo(r.x + Math.cos(a) * 5, r.y - 4, r.x + Math.cos(a) * 11, r.y + Math.sin(a) * 11); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#9682d5'; ctx.beginPath(); ctx.moveTo(r.x, r.y - 16); ctx.lineTo(r.x + 10, r.y + 6); ctx.lineTo(r.x, r.y + 15); ctx.lineTo(r.x - 10, r.y + 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(206,190,255,.25)'; ctx.beginPath(); ctx.arc(r.x, r.y, 23, 0, TAU); ctx.fill();
      }
    }
  }

  function drawBuildings() {
    for (const b of state.buildings) {
      if (b.type === 'barricade') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#66533d';
        for (let i = -1; i <= 1; i++) ctx.fillRect(-27, i * 10 - 4, 54, 8);
        ctx.restore();
      } else if (b.type === 'campfire') {
        ctx.strokeStyle = '#745e45'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(b.x - 16, b.y + 10); ctx.lineTo(b.x + 16, b.y - 10); ctx.moveTo(b.x - 16, b.y - 10); ctx.lineTo(b.x + 16, b.y + 10); ctx.stroke();
        const pulse = 5 + Math.sin(b.pulse * 7) * 2;
        ctx.fillStyle = '#e7a85f'; ctx.beginPath(); ctx.arc(b.x, b.y - 5, 9 + pulse * .3, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(231,168,95,.08)'; ctx.beginPath(); ctx.arc(b.x, b.y, 115, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = '#b6d89f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 19, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x, b.y - 25); ctx.lineTo(b.x + 22, b.y + 15); ctx.lineTo(b.x - 22, b.y + 15); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = 'rgba(178,222,159,.045)'; ctx.beginPath(); ctx.arc(b.x, b.y, 155, 0, TAU); ctx.fill();
      }
      const ratio = b.hp / b.maxHp;
      if (ratio < .98) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(b.x - 22, b.y - b.r - 14, 44, 4); ctx.fillStyle = '#9fc88d'; ctx.fillRect(b.x - 22, b.y - b.r - 14, 44 * ratio, 4); }
    }
  }

  function drawPlayer() {
    const p = state.player;
    ctx.fillStyle = p.className === 'holy' ? '#d7e6b8' : '#b6a6ea';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#081213'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.facing.x * 24, p.y + p.facing.y * 24); ctx.stroke();
    ctx.strokeStyle = p.className === 'holy' ? 'rgba(222,242,183,.28)' : 'rgba(190,170,255,.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, TAU); ctx.stroke();
  }

  function drawEnemies() {
    for (const e of state.enemies) {
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111717'; ctx.beginPath(); ctx.arc(e.x - 5, e.y - 3, 2, 0, TAU); ctx.arc(e.x + 5, e.y - 3, 2, 0, TAU); ctx.fill();
      const ratio = e.health / e.maxHealth;
      ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(e.x - 16, e.y - e.r - 11, 32, 3);
      ctx.fillStyle = '#c27967'; ctx.fillRect(e.x - 16, e.y - e.r - 11, 32 * clamp(ratio,0,1), 3);
      if (e.slow > 0) { ctx.strokeStyle = '#a8d5ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, TAU); ctx.stroke(); }
    }
  }

  function drawProjectiles() {
    for (const p of state.projectiles) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  }

  function drawParticles() {
    for (const p of state.particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    ctx.font = '700 12px ui-sans-serif, system-ui'; ctx.textAlign = 'center';
    for (const f of state.floaters) { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
  }

  function drawBuildGhost() {
    if (!state.buildMode) return;
    const cfg = BUILD[state.buildMode];
    const w = screenToWorld(mouse.x, mouse.y);
    const valid = distance(state.player, w) <= 150;
    ctx.strokeStyle = valid ? 'rgba(193,227,190,.8)' : 'rgba(235,126,110,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6,5]);
    ctx.beginPath(); ctx.arc(w.x, w.y, cfg.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }

  function drawNightOverlay() {
    const s = state;
    let alpha = 0;
    if (s.phase === 'night') alpha = .5 + .08 * Math.sin(s.elapsed * .35);
    else {
      const f = s.phaseTime / DAY_LENGTH;
      if (f < .18) alpha = (.18 - f) / .18 * .22;
      if (f > .86) alpha = (f - .86) / .14 * .12;
    }
    if (alpha <= 0) return;
    ctx.fillStyle = `rgba(7, 10, 22, ${alpha})`; ctx.fillRect(0, 0, innerWidth, innerHeight);
    if (s.phase === 'night') {
      const px = s.player.x - s.camera.x + innerWidth / 2;
      const py = s.player.y - s.camera.y + innerHeight / 2;
      const g = ctx.createRadialGradient(px, py, 40, px, py, 300);
      g.addColorStop(0, 'rgba(199,220,187,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0,0,innerWidth,innerHeight);
    }
  }

  function loop(now) {
    const dt = Math.min(.033, (now - previous) / 1000);
    previous = now;
    if (state?.running) update(dt);
    draw();
    if (state?.running) raf = requestAnimationFrame(loop);
  }

  draw();
})();
