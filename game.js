(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const $ = id => document.getElementById(id);

  const ui = {
    start: $('startScreen'), death: $('deathScreen'), hud: $('hud'), inventoryPanel: $('inventoryPanel'),
    phase: $('phaseLabel'), clock: $('clockLabel'), location: $('locationLabel'),
    healthOrbFill: $('healthOrbFill'), healthText: $('healthText'), infectionRing: $('infectionRing'),
    powerOrbFill: $('powerOrbFill'), powerText: $('powerText'), powerName: $('powerName'),
    wood: $('woodCount'), herb: $('herbCount'), crystal: $('crystalCount'), kills: $('killCount'),
    damageStat: $('damageStat'), armorStat: $('armorStat'), objective: $('objective'), message: $('message'),
    abilityQ: $('abilityQ'), abilityR: $('abilityR'), healthPotionCount: $('healthPotionCount'),
    manaPotionCount: $('manaPotionCount'), manaPotionLabel: $('manaPotionLabel'), deathTitle: $('deathTitle'), deathStats: $('deathStats'),
    characterNameLabel: $('characterNameLabel'), characterClassLabel: $('characterClassLabel'), paperDollPreview: $('paperDollPreview'),
    backpackList: $('backpackList'), backpackCount: $('backpackCount'), sheetDamage: $('sheetDamage'), sheetArmor: $('sheetArmor'),
    sheetHealth: $('sheetHealth'), sheetPower: $('sheetPower'), sheetPowerName: $('sheetPowerName'), sheetRegen: $('sheetRegen'),
    creatorPreview: $('creatorPreview'), nameInput: $('characterNameInput'), skinOptions: $('skinOptions'), hairOptions: $('hairOptions'),
    outfitOptions: $('outfitOptions'), hairStyleBtn: $('hairStyleBtn'), beginBtn: $('beginBtn')
  };

  const WORLD = { w: 3300, h: 2450, shoreX: 520 };
  const DAY_LENGTH = 64;
  const NIGHT_LENGTH = 54;
  const TAU = Math.PI * 2;
  const BACKPACK_CAP = 12;
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let state = null;
  let raf = 0;
  let previous = performance.now();
  let messageTimer = 0;
  let audioCtx = null;

  const creator = { className: 'holy', appearance: { skin: '#b97955', hair: '#3a261c', outfit: '#4f5b43', hairStyle: 'cropped' } };
  const palettes = {
    skin: ['#8a563d', '#b97955', '#d2a47e', '#6f4435'],
    hair: ['#211a17', '#3a261c', '#74512f', '#a29a8e'],
    outfit: ['#4f5b43', '#66513c', '#403f59', '#4a565b']
  };
  const hairStyles = ['cropped', 'wild', 'shaved', 'hooded'];
  const RARITIES = {
    common: { label: 'Common', color: '#b8b3a8', beam: 0, mult: 1 },
    magic: { label: 'Enchanted', color: '#5f8fdf', beam: 44, mult: 1.28 },
    rare: { label: 'Rare', color: '#d7b74e', beam: 96, mult: 1.62 },
    relic: { label: 'Relic', color: '#ad62d4', beam: 150, mult: 2.1 }
  };
  const SLOT_LABELS = { weapon: 'Weapon', helm: 'Head', chest: 'Chest', boots: 'Boots', charm: 'Charm' };
  const BUILD = {
    barricade: { wood: 4, herb: 0, r: 28, hp: 135 },
    campfire: { wood: 8, herb: 0, r: 28, hp: 90 },
    ward: { wood: 6, herb: 2, r: 31, hp: 100 }
  };

  const POIS = [
    { id: 'wreck', name: 'Wreck of the Mercy', x: 555, y: 1190, r: 185, type: 'wreck' },
    { id: 'camp', name: 'Abandoned Camp', x: 1040, y: 880, r: 145, type: 'camp' },
    { id: 'chapel', name: 'Broken Chapel', x: 1850, y: 650, r: 200, type: 'chapel' },
    { id: 'graveyard', name: 'Drowned Graveyard', x: 2050, y: 990, r: 175, type: 'graveyard' },
    { id: 'cabin', name: 'Ruined Cabin', x: 1450, y: 1640, r: 150, type: 'cabin' },
    { id: 'grove', name: 'Infected Grove', x: 2550, y: 1490, r: 225, type: 'grove' }
  ];

  const terrainPatches = [
    { x: 720, y: 1210, rx: 330, ry: 230, type: 'beachgrass' },
    { x: 1070, y: 865, rx: 240, ry: 180, type: 'dirt' },
    { x: 1500, y: 1240, rx: 530, ry: 260, type: 'deadgrass' },
    { x: 1880, y: 665, rx: 330, ry: 220, type: 'stone' },
    { x: 2060, y: 1020, rx: 280, ry: 230, type: 'mud' },
    { x: 1470, y: 1650, rx: 300, ry: 200, type: 'dirt' },
    { x: 2550, y: 1490, rx: 390, ry: 320, type: 'sick' },
    { x: 2750, y: 730, rx: 300, ry: 190, type: 'mud' }
  ];

  function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function normalize(x, y) { const d = Math.hypot(x, y) || 1; return { x: x / d, y: y / d }; }
  function classLabel(c) { return c === 'holy' ? 'Holy Warden' : 'Arcane Mage'; }
  function powerLabel(c) { return c === 'holy' ? 'Faith' : 'Mana'; }
  function pointInEllipse(px, py, e) { const dx = (px - e.x) / e.rx, dy = (py - e.y) / e.ry; return dx * dx + dy * dy < 1; }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize);
  resize();

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx?.state === 'suspended') audioCtx.resume();
  }

  function tone(freq, duration = .12, gain = .04, type = 'sine', delay = 0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, audioCtx.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + delay + .01);
    g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + delay + duration);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(audioCtx.currentTime + delay); o.stop(audioCtx.currentTime + delay + duration + .02);
  }

  function relicChime() { tone(392, .18, .05, 'triangle'); tone(523, .22, .04, 'sine', .08); tone(784, .34, .035, 'sine', .16); }

  function personMarkup(appearance, player = null) {
    const weaponRarity = player?.gear?.weapon?.rarity || 'common';
    const weaponColor = RARITIES[weaponRarity].color;
    const chestColor = player?.gear?.chest ? RARITIES[player.gear.chest.rarity].color : appearance.outfit;
    const helmColor = player?.gear?.helm ? RARITIES[player.gear.helm.rarity].color : appearance.hair;
    return `<div class="pixel-person ${appearance.hairStyle}"><i class="shadow"></i><i class="leg left"></i><i class="leg right"></i><i class="arm left" style="background:${appearance.skin}"></i><i class="arm right" style="background:${appearance.skin}"></i><i class="body" style="background:${chestColor}"></i><i class="head" style="background:${appearance.skin}"></i><i class="hair" style="background:${helmColor}"></i><i class="weapon-sprite" style="background:${weaponColor}"></i></div>`;
  }

  function renderSwatches(kind, root) {
    root.innerHTML = '';
    palettes[kind].forEach(color => {
      const b = document.createElement('button');
      b.className = `swatch${creator.appearance[kind] === color ? ' selected' : ''}`;
      b.style.background = color;
      b.setAttribute('aria-label', `${kind} color`);
      b.addEventListener('click', () => { creator.appearance[kind] = color; renderSwatches(kind, root); renderCreator(); });
      root.appendChild(b);
    });
  }
  function renderCreator() { ui.creatorPreview.innerHTML = personMarkup(creator.appearance); ui.hairStyleBtn.textContent = `HAIR: ${creator.appearance.hairStyle.toUpperCase()}`; }
  function initCreator() { renderSwatches('skin', ui.skinOptions); renderSwatches('hair', ui.hairOptions); renderSwatches('outfit', ui.outfitOptions); renderCreator(); }
  ui.hairStyleBtn.addEventListener('click', () => { const i = hairStyles.indexOf(creator.appearance.hairStyle); creator.appearance.hairStyle = hairStyles[(i + 1) % hairStyles.length]; renderCreator(); });
  document.querySelectorAll('[data-class]').forEach(card => card.addEventListener('click', () => { creator.className = card.dataset.class; document.querySelectorAll('[data-class]').forEach(c => c.classList.toggle('selected', c === card)); }));

  function starterItem(slot, className) {
    if (slot === 'weapon') return { id: uid(), slot, rarity: 'common', level: 1, name: className === 'holy' ? 'Saltworn Mace' : 'Driftwood Staff', stats: { damage: 2 } };
    return { id: uid(), slot, rarity: 'common', level: 1, name: 'Tattered Shorecoat', stats: { armor: 1, health: 5 } };
  }

  function rollRarity(day) {
    const bonus = Math.min(.12, Math.max(0, day - 1) * .012), r = Math.random();
    if (r < .02 + bonus * .25) return 'relic';
    if (r < .11 + bonus) return 'rare';
    if (r < .38 + bonus * 1.4) return 'magic';
    return 'common';
  }

  function generateItem(day, className) {
    const slot = pick(['weapon', 'helm', 'chest', 'boots', 'charm']);
    const rarity = rollRarity(day), level = Math.max(1, day + Math.floor(rand(-1, 2))), m = RARITIES[rarity].mult, stats = {};
    if (slot === 'weapon') stats.damage = Math.max(1, Math.round((2 + level * 1.5) * m));
    if (slot === 'helm') { stats.armor = Math.round((1 + level * .7) * m); if (rarity !== 'common') stats.health = Math.round((2 + level * 1.8) * m); }
    if (slot === 'chest') { stats.armor = Math.round((2 + level * 1.1) * m); stats.health = Math.round((4 + level * 2.4) * m); }
    if (slot === 'boots') { stats.armor = Math.round((1 + level * .55) * m); if (rarity !== 'common') stats.speed = Math.round((1.5 + level * .45) * m); }
    if (slot === 'charm') { stats.power = Math.round((5 + level * 2.5) * m); stats.regen = Number(((.3 + level * .09) * m).toFixed(1)); }
    const affixes = rarity === 'magic' ? 1 : rarity === 'rare' ? 2 : rarity === 'relic' ? 3 : 0;
    for (let i = 0; i < affixes; i++) {
      const a = pick(['health', 'power', 'armor', 'damage', 'regen']);
      if (a === 'health') stats.health = (stats.health || 0) + Math.round((3 + level * 1.5) * m);
      if (a === 'power') stats.power = (stats.power || 0) + Math.round((4 + level * 1.8) * m);
      if (a === 'armor') stats.armor = (stats.armor || 0) + Math.max(1, Math.round(level * .45 * m));
      if (a === 'damage') stats.damage = (stats.damage || 0) + Math.max(1, Math.round(level * .55 * m));
      if (a === 'regen') stats.regen = Number(((stats.regen || 0) + .25 * m).toFixed(1));
    }
    const nouns = {
      weapon: className === 'holy' ? ['Mace', 'Flail', 'Hammer', 'Scepter'] : ['Staff', 'Wand', 'Rod', 'Focus'],
      helm: ['Hood', 'Coif', 'Cowl', 'Helm'], chest: ['Hauberk', 'Coat', 'Vestment', 'Mail'],
      boots: ['Treads', 'Greaves', 'Boots', 'Walkers'], charm: ['Talisman', 'Idol', 'Charm', 'Seal']
    };
    const prefixes = {
      common: ['Worn', 'Saltbitten', 'Weathered', 'Driftwood'], magic: ['Gleaming', 'Runed', 'Stormbound', 'Moonlit'],
      rare: ['Hallowed', 'Dreadwoven', 'Gravetouched', 'Starforged'], relic: ['Forgotten', 'Crowned', 'Sainted', 'Voidscarred']
    };
    const suffix = rarity === 'common' ? '' : ` of ${pick(['Ash', 'Tides', 'Vigil', 'the Deep', 'Dawn', 'Embers'])}`;
    return { id: uid(), slot, rarity, level, name: `${pick(prefixes[rarity])} ${pick(nouns[slot])}${suffix}`, stats };
  }

  function recalcStats(p, refill = false) {
    let health = 0, power = 0, damage = 0, armor = 0, regen = 0, speed = 0;
    Object.values(p.gear).forEach(item => {
      if (!item) return;
      health += item.stats.health || 0; power += item.stats.power || 0; damage += item.stats.damage || 0;
      armor += item.stats.armor || 0; regen += item.stats.regen || 0; speed += item.stats.speed || 0;
    });
    const oldH = p.maxHealth || p.baseHealth, oldP = p.maxPower || p.basePower;
    p.maxHealth = p.baseHealth + health; p.maxPower = p.basePower + power; p.damage = p.baseDamage + damage;
    p.armor = armor; p.powerRegen = p.baseRegen + regen; p.speed = p.baseSpeed * (1 + speed / 100);
    if (refill) { p.health = p.maxHealth; p.power = p.maxPower; }
    else {
      if (p.maxHealth > oldH) p.health += p.maxHealth - oldH;
      if (p.maxPower > oldP) p.power += p.maxPower - oldP;
      p.health = clamp(p.health, 1, p.maxHealth); p.power = clamp(p.power, 0, p.maxPower);
    }
  }

  function nearPoi(x, y, margin = 0) { return POIS.some(p => Math.hypot(x - p.x, y - p.y) < p.r + margin); }
  function pathY(x) { return 1200 - Math.sin(x / 330) * 130 + Math.sin(x / 110) * 28; }
  function nearPath(x, y, width = 55) { return Math.abs(y - pathY(x)) < width; }

  function createWorldResources() {
    const resources = [];
    const clusters = [
      [900, 650, 14], [1200, 520, 11], [1420, 980, 12], [1700, 1380, 14], [2150, 560, 13],
      [2400, 930, 13], [2800, 1150, 15], [2780, 1830, 12], [2050, 1850, 11], [1180, 1900, 10]
    ];
    for (const [cx, cy, count] of clusters) {
      for (let i = 0; i < count; i++) {
        const a = rand(0, TAU), d = rand(30, 250), x = clamp(cx + Math.cos(a) * d, 620, WORLD.w - 80), y = clamp(cy + Math.sin(a) * d, 80, WORLD.h - 80);
        if (nearPoi(x, y, -20) || nearPath(x, y, 46)) continue;
        resources.push({ id: uid(), type: 'tree', x, y, r: rand(28, 38), hp: 3 });
      }
    }
    for (let i = 0; i < 46; i++) resources.push({ id: uid(), type: 'herb', x: rand(650, WORLD.w - 100), y: rand(100, WORLD.h - 100), r: 12, hp: 1 });
    for (let i = 0; i < 27; i++) resources.push({ id: uid(), type: 'crystal', x: rand(900, WORLD.w - 100), y: rand(100, WORLD.h - 100), r: 14, hp: 2 });
    return resources;
  }

  function createDecor() {
    const decor = [];
    for (let i = 0; i < 220; i++) {
      const x = rand(570, WORLD.w - 40), y = rand(30, WORLD.h - 30), roll = Math.random();
      decor.push({ x, y, type: roll < .36 ? 'grass' : roll < .52 ? 'leaves' : roll < .68 ? 'stone' : roll < .79 ? 'root' : roll < .9 ? 'stump' : 'bone', size: rand(2, 8), rot: rand(-.7, .7) });
    }
    for (let i = 0; i < 24; i++) decor.push({ x: rand(720, 3000), y: rand(150, 2300), type: 'log', size: rand(24, 45), rot: rand(-.8, .8) });
    return decor;
  }

  function createState(className, appearance, name) {
    const baseHealth = className === 'holy' ? 112 : 94, basePower = className === 'holy' ? 100 : 122;
    const p = {
      x: 720, y: 1200, r: 22, baseSpeed: 220, speed: 220, baseHealth, maxHealth: baseHealth, health: baseHealth,
      basePower, maxPower: basePower, power: basePower, baseDamage: className === 'holy' ? 16 : 13, baseRegen: className === 'holy' ? 6.6 : 9.6,
      damage: 0, armor: 0, powerRegen: 0, infection: 0, className, appearance, name,
      facing: { x: 1, y: 0 }, facingDir: 'right', moving: false, attackCd: 0, qCd: 0, rCd: 0, attackVisual: 0,
      inv: { wood: 2, herb: 1, crystal: 0 }, potions: { health: 2, power: 2 }, kills: 0,
      gear: { weapon: starterItem('weapon', className), helm: null, chest: starterItem('chest', className), boots: null, charm: null }, backpack: []
    };
    recalcStats(p, true);
    return {
      running: true, inventoryOpen: false, player: p, resources: createWorldResources(), decor: createDecor(), loot: [], buildings: [], enemies: [],
      projectiles: [], particles: [], floaters: [], deaths: [], slashes: [], spells: [], day: 1, phase: 'day', phaseTime: DAY_LENGTH,
      nightsSurvived: 0, waveSpawnTimer: 1, buildMode: null, camera: { x: p.x, y: p.y }, elapsed: 0, shake: 0,
      discovered: new Set(['wreck']), visitedMessage: new Set(), fogSeed: Array.from({ length: 18 }, (_, i) => ({ x: (i * 127) % innerWidth, y: (i * 83) % innerHeight, speed: rand(8, 22), size: rand(90, 220) }))
    };
  }

  function start() {
    ensureAudio();
    const name = ui.nameInput.value.trim() || 'Wanderer', appearance = JSON.parse(JSON.stringify(creator.appearance));
    state = createState(creator.className, appearance, name);
    ui.start.classList.add('hidden'); ui.death.classList.add('hidden'); ui.inventoryPanel.classList.add('hidden'); ui.hud.classList.remove('hidden');
    ui.powerName.textContent = powerLabel(state.player.className).toUpperCase();
    ui.abilityQ.textContent = state.player.className === 'holy' ? 'Smite' : 'Arcane Volley';
    ui.abilityR.textContent = state.player.className === 'holy' ? 'Cleanse' : 'Frost Nova';
    ui.manaPotionLabel.textContent = powerLabel(state.player.className);
    renderInventory(); showMessage('Stranded. Gather driftwood and make the shore defensible.');
    previous = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  ui.beginBtn.addEventListener('click', start);
  $('restartBtn').addEventListener('click', () => { state = null; ui.death.classList.add('hidden'); ui.start.classList.remove('hidden'); ui.hud.classList.add('hidden'); ui.inventoryPanel.classList.add('hidden'); draw(); });

  function itemStatsText(item) {
    const s = item.stats, out = [];
    if (s.damage) out.push(`+${s.damage} damage`); if (s.armor) out.push(`+${s.armor} armor`); if (s.health) out.push(`+${s.health} life`);
    if (s.power) out.push(`+${s.power} ${powerLabel(state?.player?.className || creator.className).toLowerCase()}`); if (s.regen) out.push(`+${s.regen}/s regen`); if (s.speed) out.push(`+${s.speed}% move`);
    return out.join(' · ');
  }

  function renderInventory() {
    if (!state) return; const p = state.player;
    ui.characterNameLabel.textContent = p.name; ui.characterClassLabel.textContent = classLabel(p.className); ui.paperDollPreview.innerHTML = personMarkup(p.appearance, p);
    ui.sheetDamage.textContent = p.damage; ui.sheetArmor.textContent = p.armor; ui.sheetHealth.textContent = p.maxHealth; ui.sheetPower.textContent = p.maxPower;
    ui.sheetPowerName.textContent = `Maximum ${powerLabel(p.className)}`; ui.sheetRegen.textContent = `${p.powerRegen.toFixed(1)}/s`; ui.backpackCount.textContent = `${p.backpack.length} / ${BACKPACK_CAP}`;
    document.querySelectorAll('[data-gear-slot]').forEach(btn => {
      const item = p.gear[btn.dataset.gearSlot], strong = btn.querySelector('strong'); strong.textContent = item ? item.name : 'Empty'; strong.style.color = item ? RARITIES[item.rarity].color : '#777169';
      btn.title = item ? `${item.name}\n${itemStatsText(item)}` : `Empty ${SLOT_LABELS[btn.dataset.gearSlot]} slot`;
    });
    ui.backpackList.innerHTML = '';
    if (!p.backpack.length) { const empty = document.createElement('div'); empty.className = 'empty-pack'; empty.textContent = 'THE PACK IS EMPTY — THE FOG HAS BETTER THINGS'; ui.backpackList.appendChild(empty); return; }
    p.backpack.forEach(item => {
      const b = document.createElement('button'); b.className = 'item-card';
      b.innerHTML = `<small>${RARITIES[item.rarity].label.toUpperCase()} · LV ${item.level} · ${SLOT_LABELS[item.slot].toUpperCase()}</small><strong style="color:${RARITIES[item.rarity].color}">${item.name}</strong><span>${itemStatsText(item)}</span>`;
      b.addEventListener('click', () => equipItem(item.id)); ui.backpackList.appendChild(b);
    });
  }

  function equipItem(id) {
    const p = state.player, i = p.backpack.findIndex(x => x.id === id); if (i < 0) return;
    const item = p.backpack[i], old = p.gear[item.slot]; p.backpack.splice(i, 1); if (old) p.backpack.push(old); p.gear[item.slot] = item;
    recalcStats(p); renderInventory(); updateUI(); showMessage(`${item.name} equipped.`); tone(220, .08, .025, 'square');
  }
  function unequipSlot(slot) {
    const p = state.player, item = p.gear[slot]; if (!item) return; if (p.backpack.length >= BACKPACK_CAP) return showMessage('Backpack is full.');
    p.gear[slot] = null; p.backpack.push(item); recalcStats(p); renderInventory(); updateUI();
  }
  document.querySelectorAll('[data-gear-slot]').forEach(btn => btn.addEventListener('click', () => unequipSlot(btn.dataset.gearSlot)));
  function toggleInventory(force) {
    if (!state) return; state.inventoryOpen = typeof force === 'boolean' ? force : !state.inventoryOpen; state.buildMode = null; mouse.down = false;
    document.querySelectorAll('[data-build]').forEach(b => b.classList.remove('active')); ui.inventoryPanel.classList.toggle('hidden', !state.inventoryOpen); if (state.inventoryOpen) renderInventory();
  }
  $('inventoryBtn').addEventListener('click', () => toggleInventory()); $('closeInventoryBtn').addEventListener('click', () => toggleInventory(false));
  document.querySelectorAll('[data-build]').forEach(btn => btn.addEventListener('click', () => setBuildMode(btn.dataset.build)));
  $('healthPotionBtn').addEventListener('click', () => usePotion('health')); $('manaPotionBtn').addEventListener('click', () => usePotion('power'));

  addEventListener('keydown', e => {
    keys.add(e.key.toLowerCase()); if (!state || !state.running) return; const k = e.key.toLowerCase();
    if (k === 'i') { toggleInventory(); return; } if (e.key === 'Escape' && state.inventoryOpen) { toggleInventory(false); return; } if (state.inventoryOpen) return;
    if (['1', '2', '3'].includes(e.key)) setBuildMode({ '1': 'barricade', '2': 'campfire', '3': 'ward' }[e.key]);
    if (k === 'e') interact(); if (k === 'q') useQ(); if (k === 'r') useR(); if (e.key === '4') usePotion('health'); if (e.key === '5') usePotion('power'); if (e.key === 'Escape') setBuildMode(null);
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; if (state && !state.inventoryOpen) { const w = screenToWorld(mouse.x, mouse.y); state.player.facing = normalize(w.x - state.player.x, w.y - state.player.y); updateFacing(state.player); } });
  canvas.addEventListener('mousedown', e => { if (e.button !== 0 || !state || !state.running || state.inventoryOpen) return; mouse.down = true; state.buildMode ? placeBuilding() : basicAttack(); });
  addEventListener('mouseup', () => mouse.down = false); canvas.addEventListener('contextmenu', e => e.preventDefault());

  function updateFacing(p) {
    if (Math.abs(p.facing.x) > Math.abs(p.facing.y)) p.facingDir = p.facing.x >= 0 ? 'right' : 'left'; else p.facingDir = p.facing.y >= 0 ? 'down' : 'up';
  }
  function setBuildMode(type) { if (!state || state.inventoryOpen) return; state.buildMode = state.buildMode === type ? null : type; document.querySelectorAll('[data-build]').forEach(b => b.classList.toggle('active', b.dataset.build === state.buildMode)); }
  function screenToWorld(x, y) { return { x: x + state.camera.x - innerWidth / 2, y: y + state.camera.y - innerHeight / 2 }; }
  function showMessage(text) { ui.message.textContent = text; ui.message.classList.add('show'); messageTimer = 2.6; }
  function addFloater(x, y, text, color = '#e8e0d2') { state.floaters.push({ x, y, text, color, life: 1.25 }); }

  function interact() {
    const p = state.player; let loot = null, lootD = 82;
    state.loot.forEach(l => { const d = distance(p, l); if (d < lootD) { loot = l; lootD = d; } }); if (loot) return pickupLoot(loot);
    let res = null, best = 72; state.resources.forEach(r => { const d = distance(p, r); if (d < best) { res = r; best = d; } });
    if (!res) return showMessage('Nothing close enough to gather or loot.');
    res.hp -= 1; burst(res.x, res.y, res.type === 'tree' ? '#7d866a' : res.type === 'herb' ? '#738f63' : '#8579a7', 7);
    if (res.hp <= 0) {
      if (res.type === 'tree') { const n = Math.floor(rand(3, 6)); p.inv.wood += n; addFloater(res.x, res.y, `+${n} wood`); }
      if (res.type === 'herb') { const n = Math.floor(rand(1, 3)); p.inv.herb += n; addFloater(res.x, res.y, `+${n} herb`, '#a6bf88'); }
      if (res.type === 'crystal') { p.inv.crystal++; addFloater(res.x, res.y, '+1 crystal', '#a994d0'); }
      state.resources = state.resources.filter(x => x !== res);
    }
  }

  function pickupLoot(loot) {
    const p = state.player;
    if (loot.kind === 'item') {
      if (p.backpack.length >= BACKPACK_CAP) return showMessage('Backpack full — open inventory and make room.');
      p.backpack.push(loot.item); state.loot = state.loot.filter(x => x !== loot); renderInventory();
      showMessage(`${RARITIES[loot.item.rarity].label}: ${loot.item.name}`); addFloater(p.x, p.y - 34, loot.item.name, RARITIES[loot.item.rarity].color);
      if (loot.item.rarity === 'relic') relicChime(); else tone(loot.item.rarity === 'rare' ? 420 : 280, .1, .025, 'triangle');
    } else {
      p.potions[loot.potion]++; state.loot = state.loot.filter(x => x !== loot); showMessage(`${loot.potion === 'health' ? 'Health' : powerLabel(p.className)} potion collected.`); tone(300, .08, .02, 'sine');
    }
  }

  function usePotion(type) {
    if (!state || state.inventoryOpen) return; const p = state.player; if (p.potions[type] <= 0) return showMessage('No potions left.');
    if (type === 'health') {
      if (p.health >= p.maxHealth) return showMessage('Life is already full.'); p.potions.health--; const n = Math.round(p.maxHealth * .48); p.health = Math.min(p.maxHealth, p.health + n); burst(p.x, p.y, '#a43f43', 22, 135); addFloater(p.x, p.y - 30, `+${n} life`, '#e08383'); tone(190, .13, .03, 'sine');
    } else {
      if (p.power >= p.maxPower) return showMessage(`${powerLabel(p.className)} is already full.`); p.potions.power--; const n = Math.round(p.maxPower * .52); p.power = Math.min(p.maxPower, p.power + n); burst(p.x, p.y, '#4f6fb5', 22, 135); addFloater(p.x, p.y - 30, `+${n} ${powerLabel(p.className).toLowerCase()}`, '#7fa1ec'); tone(360, .13, .025, 'sine');
    }
    updateUI();
  }

  function placeBuilding() {
    const cfg = BUILD[state.buildMode]; if (!cfg) return; const p = state.player, w = screenToWorld(mouse.x, mouse.y);
    if (distance(p, w) > 165) return showMessage('Build closer to yourself.'); if (p.inv.wood < cfg.wood || p.inv.herb < cfg.herb) return showMessage('Not enough materials.');
    if (state.buildings.some(b => distance(b, w) < b.r + cfg.r + 8)) return showMessage('Too close to another structure.');
    p.inv.wood -= cfg.wood; p.inv.herb -= cfg.herb; state.buildings.push({ type: state.buildMode, x: clamp(w.x, 570, WORLD.w - 40), y: clamp(w.y, 40, WORLD.h - 40), r: cfg.r, hp: cfg.hp, maxHp: cfg.hp, pulse: 0 });
    burst(w.x, w.y, '#a8895d', 12); showMessage(`${state.buildMode[0].toUpperCase() + state.buildMode.slice(1)} built.`);
  }

  function basicAttack() {
    const p = state.player; if (p.attackCd > 0) return; p.attackVisual = .24;
    if (p.className === 'holy') {
      p.attackCd = .42; const reach = 92, arcDot = .28; let hit = false;
      state.slashes.push({ x: p.x, y: p.y, dir: { ...p.facing }, life: .18, max: .18, color: p.gear.weapon ? RARITIES[p.gear.weapon.rarity].color : '#cfc8b8' });
      for (const e of state.enemies) {
        const d = distance(p, e); if (d > reach + e.r) continue; const to = normalize(e.x - p.x, e.y - p.y), dot = to.x * p.facing.x + to.y * p.facing.y;
        if (dot > arcDot) { damageEnemy(e, p.damage, p.facing.x * 170, p.facing.y * 170, '#bba77c'); hit = true; }
      }
      tone(hit ? 105 : 82, .055, .028, 'square');
    } else {
      p.attackCd = .28; shoot(p.x + p.facing.x * 28, p.y + p.facing.y * 20, p.facing, p.damage, '#7e9ee7', 650, 1.1, 7, 'arcane'); tone(245, .05, .018, 'sine');
    }
  }

  function useQ() {
    const p = state.player; if (p.qCd > 0) return;
    if (p.className === 'holy') {
      if (p.power < 24) return showMessage('Not enough faith.'); p.power -= 24; p.qCd = 2.0; const target = nearestEnemy(410), dir = target ? normalize(target.x - p.x, target.y - p.y) : p.facing;
      state.spells.push({ type: 'smite', x: target?.x || p.x + dir.x * 250, y: target?.y || p.y + dir.y * 250, life: .38, max: .38 });
      if (target) damageEnemy(target, Math.round(p.damage * 2.9), dir.x * 260, dir.y * 260, '#e3cf77'); else shoot(p.x, p.y, dir, Math.round(p.damage * 2.7), '#e3cf77', 760, .75, 10, 'holy');
      state.shake = Math.max(state.shake, 4); addFloater(p.x, p.y - 34, 'SMITE', '#e7d68a'); tone(530, .12, .04, 'triangle');
    } else {
      if (p.power < 20) return showMessage('Not enough mana.'); p.power -= 20; p.qCd = 1.3;
      for (let a = -.16; a <= .16; a += .16) { const angle = Math.atan2(p.facing.y, p.facing.x) + a; shoot(p.x, p.y, { x: Math.cos(angle), y: Math.sin(angle) }, Math.round(p.damage * 1.75), '#8a79d8', 790, .98, 7, 'arcane'); }
      addFloater(p.x, p.y - 34, 'ARCANE VOLLEY', '#a795e0'); tone(330, .08, .03, 'sine'); tone(440, .1, .022, 'sine', .04);
    }
  }

  function useR() {
    const p = state.player; if (p.rCd > 0) return;
    if (p.className === 'holy') {
      if (p.power < 42) return showMessage('Not enough faith.'); p.power -= 42; p.rCd = 9.5; p.infection = Math.max(0, p.infection - 34); p.health = Math.min(p.maxHealth, p.health + Math.round(p.maxHealth * .22));
      burst(p.x, p.y, '#ded79d', 34, 180); state.spells.push({ type: 'cleanse', x: p.x, y: p.y, life: .7, max: .7 }); showMessage('Cleanse: infection purged, wounds restored.'); tone(460, .2, .035, 'sine'); tone(620, .22, .025, 'sine', .09);
    } else {
      if (p.power < 40) return showMessage('Not enough mana.'); p.power -= 40; p.rCd = 8.2;
      state.enemies.forEach(e => { if (distance(p, e) < 230) { const d = normalize(e.x - p.x, e.y - p.y); damageEnemy(e, Math.round(p.damage * 1.9), d.x * 260, d.y * 260, '#81afd0'); e.slow = 4; } });
      burst(p.x, p.y, '#8ab9d4', 46, 220); state.spells.push({ type: 'nova', x: p.x, y: p.y, life: .5, max: .5 }); state.shake = Math.max(state.shake, 5); showMessage('Frost Nova: nearby enemies frozen and damaged.'); tone(165, .24, .035, 'sawtooth');
    }
  }

  function nearestEnemy(range) { let target = null, best = range; state.enemies.forEach(e => { const d = distance(state.player, e); if (d < best) { target = e; best = d; } }); return target; }
  function shoot(x, y, dir, damage, color, speed, life, r = 5, type = 'basic') { state.projectiles.push({ x, y, px: x, py: y, vx: dir.x * speed, vy: dir.y * speed, damage, color, life, r, type }); }
  function burst(x, y, color, count, speed = 90) { for (let i = 0; i < count; i++) { const a = rand(0, TAU), s = rand(speed * .35, speed); state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.25, .8), max: .8, color, size: rand(1, 4) }); } }
  function damageEnemy(e, amount, kx = 0, ky = 0, color = '#d8c49d') {
    e.health -= amount; e.hitFlash = .12; e.kvx += kx; e.kvy += ky; state.shake = Math.max(state.shake, amount > 30 ? 4 : 2); burst(e.x, e.y, e.type === 'wraith' ? '#7e6b9e' : '#7b382f', 8, 130); addFloater(e.x, e.y - 28, `-${Math.round(amount)}`, color);
  }

  function spawnEnemy() {
    const p = state.player, a = rand(0, TAU), radius = Math.max(innerWidth, innerHeight) * .72 + rand(90, 260), x = clamp(p.x + Math.cos(a) * radius, 610, WORLD.w - 30), y = clamp(p.y + Math.sin(a) * radius, 30, WORLD.h - 30);
    const roll = Math.random(); let type = 'drowned'; if (state.day >= 2 && roll > .62) type = 'rotter'; if (state.day >= 3 && roll > .86) type = 'wraith';
    const cfg = {
      drowned: { r: 18, health: 42 + state.day * 5, speed: 82 + state.day * 2, damage: 9 + state.day * .4, infection: 2, color: '#67766c' },
      rotter: { r: 20, health: 60 + state.day * 7, speed: 69, damage: 10 + state.day * .5, infection: 7, color: '#777241' },
      wraith: { r: 16, health: 36 + state.day * 6, speed: 126, damage: 12 + state.day * .55, infection: 4, color: '#71618e' }
    }[type];
    state.enemies.push({ type, x, y, ...cfg, maxHealth: cfg.health, hitCd: 0, slow: 0, hitFlash: 0, kvx: 0, kvy: 0, spawnAlpha: 0, attackAnim: 0 });
  }

  function respawnResources() {
    const c = { tree: 0, herb: 0, crystal: 0 }; state.resources.forEach(r => c[r.type]++);
    while (c.tree++ < 88) { const x = rand(650, WORLD.w - 70), y = rand(70, WORLD.h - 70); if (!nearPoi(x, y, 0) && !nearPath(x, y, 40)) state.resources.push({ id: uid(), type: 'tree', x, y, r: rand(28, 38), hp: 3 }); }
    while (c.herb++ < 36) state.resources.push({ id: uid(), type: 'herb', x: rand(650, WORLD.w - 70), y: rand(70, WORLD.h - 70), r: 12, hp: 1 });
    while (c.crystal++ < 20) state.resources.push({ id: uid(), type: 'crystal', x: rand(900, WORLD.w - 70), y: rand(70, WORLD.h - 70), r: 14, hp: 2 });
  }

  function dropItemNearPlayer() {
    const p = state.player, a = rand(0, TAU), d = rand(65, 125), item = generateItem(state.day, p.className), loot = { id: uid(), kind: 'item', item, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, life: 90, pulse: 0 };
    state.loot.push(loot); if (item.rarity === 'relic') relicChime();
  }

  function killEnemy(e) {
    state.enemies = state.enemies.filter(x => x !== e); state.player.kills++; if (Math.random() < .15) state.player.inv.crystal++;
    state.deaths.push({ x: e.x, y: e.y, type: e.type, color: e.color, life: .65, max: .65, r: e.r });
    const r = Math.random();
    if (r < .31) {
      const item = generateItem(state.day, state.player.className); state.loot.push({ id: uid(), kind: 'item', item, x: e.x, y: e.y, life: 85, pulse: 0 }); addFloater(e.x, e.y - 30, item.name, RARITIES[item.rarity].color); if (item.rarity === 'relic') relicChime();
    } else if (r < .42) { state.loot.push({ id: uid(), kind: 'potion', potion: 'health', x: e.x, y: e.y, life: 85, pulse: 0 }); addFloater(e.x, e.y - 30, 'Health Potion', '#cc5d62'); }
    else if (r < .53) { state.loot.push({ id: uid(), kind: 'potion', potion: 'power', x: e.x, y: e.y, life: 85, pulse: 0 }); addFloater(e.x, e.y - 30, `${powerLabel(state.player.className)} Potion`, '#6e86c8'); }
    burst(e.x, e.y, e.color, 16); addFloater(e.x, e.y, '+1 kill', '#c7c1b7'); tone(72, .06, .022, 'square');
  }

  function discoverPoi() {
    const p = state.player; let nearest = null, best = 1e9;
    for (const poi of POIS) { const d = distance(p, poi); if (d < best) { best = d; nearest = poi; } if (d < poi.r + 75 && !state.discovered.has(poi.id)) { state.discovered.add(poi.id); showMessage(`Discovered: ${poi.name}`); tone(260, .14, .025, 'triangle'); tone(390, .16, .02, 'triangle', .08); } }
    ui.location.textContent = best < nearest.r + 120 ? nearest.name : p.x < 800 ? 'The Strand' : p.x < 1750 ? 'Greywood' : p.x < 2350 ? 'The Old Parish' : 'The Blighted Interior';
  }

  function update(dt) {
    const s = state, p = s.player; s.elapsed += dt; p.attackCd = Math.max(0, p.attackCd - dt); p.qCd = Math.max(0, p.qCd - dt); p.rCd = Math.max(0, p.rCd - dt); p.attackVisual = Math.max(0, p.attackVisual - dt); p.power = Math.min(p.maxPower, p.power + dt * p.powerRegen);
    let mx = 0, my = 0; if (keys.has('w') || keys.has('arrowup')) my--; if (keys.has('s') || keys.has('arrowdown')) my++; if (keys.has('a') || keys.has('arrowleft')) mx--; if (keys.has('d') || keys.has('arrowright')) mx++;
    p.moving = !!(mx || my);
    if (p.moving) { const d = normalize(mx, my); p.x = clamp(p.x + d.x * p.speed * dt, 555, WORLD.w - 22); p.y = clamp(p.y + d.y * p.speed * dt, 22, WORLD.h - 22); if (!mouse.down) { p.facing = d; updateFacing(p); } }
    if (mouse.down && !s.buildMode) basicAttack();

    s.phaseTime -= dt;
    if (s.phaseTime <= 0) {
      if (s.phase === 'day') { s.phase = 'night'; s.phaseTime = NIGHT_LENGTH; s.waveSpawnTimer = .5; showMessage(`Night ${s.day}. Stay near the fire. The fog is moving.`); tone(88, .5, .025, 'sawtooth'); }
      else { s.phase = 'day'; s.phaseTime = DAY_LENGTH; s.nightsSurvived++; s.day++; s.enemies = s.enemies.filter(e => e.type === 'wraith' && Math.random() < .12); p.health = Math.min(p.maxHealth, p.health + Math.round(p.maxHealth * .12)); p.infection = Math.max(0, p.infection - 6); respawnResources(); if (Math.random() < .55) dropItemNearPlayer(); showMessage(`Dawn ${s.day}. The shore's loot grows stronger.`); }
    }
    if (s.phase === 'night') { s.waveSpawnTimer -= dt; if (s.waveSpawnTimer <= 0) { if (s.enemies.length < 8 + s.day * 4) spawnEnemy(); s.waveSpawnTimer = Math.max(.55, 2.25 - s.day * .13); } }

    state.buildings.forEach(b => {
      b.pulse += dt;
      if (b.type === 'campfire' && distance(p, b) < 135) { p.health = Math.min(p.maxHealth, p.health + 2.4 * dt); p.infection = Math.max(0, p.infection - 1.8 * dt); }
      if (b.type === 'ward') state.enemies.forEach(e => { if (distance(b, e) < 175) e.health -= 4.2 * dt; });
    });
    state.buildings = state.buildings.filter(b => b.hp > 0);

    state.enemies.forEach(e => {
      e.hitCd = Math.max(0, e.hitCd - dt); e.slow = Math.max(0, e.slow - dt); e.hitFlash = Math.max(0, e.hitFlash - dt); e.attackAnim = Math.max(0, e.attackAnim - dt); e.spawnAlpha = Math.min(1, e.spawnAlpha + dt * 2.2);
      e.x += e.kvx * dt; e.y += e.kvy * dt; e.kvx *= Math.pow(.015, dt); e.kvy *= Math.pow(.015, dt);
      let target = p, building = false, best = distance(e, p);
      state.buildings.forEach(b => { const d = distance(e, b); if (d < best && d < 165) { target = b; building = true; best = d; } });
      const d = normalize(target.x - e.x, target.y - e.y), speed = e.speed * (e.slow > 0 ? .45 : 1); e.x += d.x * speed * dt; e.y += d.y * speed * dt;
      if (distance(e, target) < e.r + target.r + 6 && e.hitCd <= 0) {
        e.hitCd = .85; e.attackAnim = .22;
        if (building) { target.hp -= e.damage * 1.25; burst(target.x, target.y, '#907454', 5); }
        else { const incoming = Math.max(1, Math.round(e.damage * (100 / (100 + p.armor * 8)))); p.health -= incoming; p.infection = clamp(p.infection + e.infection, 0, 100); state.shake = Math.max(state.shake, 5); burst(p.x, p.y, '#9a514a', 10, 150); addFloater(p.x, p.y - 31, `-${incoming}`, '#db7b72'); if (e.type === 'rotter') showMessage('Rotter bite — infection rising. Find fire or use Cleanse.'); tone(62, .07, .035, 'square'); }
      }
    });
    [...state.enemies].forEach(e => { if (e.health <= 0) killEnemy(e); });

    state.projectiles.forEach(pr => {
      pr.px = pr.x; pr.py = pr.y; pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      for (const e of state.enemies) { if (pr.life <= 0) break; if (Math.hypot(pr.x - e.x, pr.y - e.y) < pr.r + e.r) { const d = normalize(pr.vx, pr.vy); damageEnemy(e, pr.damage, d.x * 180, d.y * 180, pr.color); pr.life = 0; if (pr.type === 'arcane') state.spells.push({ type: 'arcaneHit', x: pr.x, y: pr.y, life: .25, max: .25 }); } }
    });
    state.projectiles = state.projectiles.filter(pr => pr.life > 0 && pr.x > 0 && pr.y > 0 && pr.x < WORLD.w && pr.y < WORLD.h);

    state.particles.forEach(x => { x.x += x.vx * dt; x.y += x.vy * dt; x.vx *= .96; x.vy *= .96; x.life -= dt; }); state.particles = state.particles.filter(x => x.life > 0);
    state.floaters.forEach(x => { x.y -= 28 * dt; x.life -= dt; }); state.floaters = state.floaters.filter(x => x.life > 0);
    state.loot.forEach(x => { x.life -= dt; x.pulse += dt; }); state.loot = state.loot.filter(x => x.life > 0);
    state.deaths.forEach(x => x.life -= dt); state.deaths = state.deaths.filter(x => x.life > 0);
    state.slashes.forEach(x => x.life -= dt); state.slashes = state.slashes.filter(x => x.life > 0);
    state.spells.forEach(x => x.life -= dt); state.spells = state.spells.filter(x => x.life > 0);
    s.shake = Math.max(0, s.shake - dt * 18);

    if (p.infection >= 100) p.health -= 8 * dt; if (p.health <= 0) die(); discoverPoi();
    const smooth = 1 - Math.pow(.0008, dt); s.camera.x += (p.x - s.camera.x) * smooth; s.camera.y += (p.y - s.camera.y) * smooth;
    const hw = Math.min(innerWidth / 2, WORLD.w / 2), hh = Math.min(innerHeight / 2, WORLD.h / 2); s.camera.x = clamp(s.camera.x, hw, WORLD.w - hw); s.camera.y = clamp(s.camera.y, hh, WORLD.h - hh);
    if (messageTimer > 0) { messageTimer -= dt; if (messageTimer <= 0) ui.message.classList.remove('show'); }
    updateUI();
  }

  function die() {
    state.running = false; ui.hud.classList.add('hidden'); ui.inventoryPanel.classList.add('hidden'); ui.death.classList.remove('hidden');
    ui.deathTitle.textContent = `${state.player.name} survived ${state.nightsSurvived} night${state.nightsSurvived === 1 ? '' : 's'}.`;
    ui.deathStats.textContent = `${state.player.kills} enemies defeated · Day ${state.day} · ${state.player.damage} damage · ${state.player.armor} armor`;
  }

  function updateUI() {
    const s = state, p = s.player; ui.phase.textContent = `${s.phase === 'day' ? 'DAY' : 'NIGHT'} ${s.day}`;
    const f = 1 - s.phaseTime / (s.phase === 'day' ? DAY_LENGTH : NIGHT_LENGTH); ui.clock.textContent = s.phase === 'day' ? (f < .33 ? 'Morning' : f < .66 ? 'Afternoon' : 'Dusk') : (f < .33 ? 'Nightfall' : f < .76 ? 'Midnight' : 'Before dawn');
    ui.healthOrbFill.style.height = `${clamp(p.health / p.maxHealth * 100, 0, 100)}%`; ui.healthText.textContent = `${Math.max(0, Math.round(p.health))} / ${p.maxHealth}`;
    ui.infectionRing.style.background = `conic-gradient(#9c8732 ${p.infection * 3.6}deg, transparent ${p.infection * 3.6}deg)`;
    ui.powerOrbFill.style.height = `${clamp(p.power / p.maxPower * 100, 0, 100)}%`; ui.powerText.textContent = `${Math.round(p.power)} / ${p.maxPower}`;
    ui.wood.textContent = p.inv.wood; ui.herb.textContent = p.inv.herb; ui.crystal.textContent = p.inv.crystal; ui.kills.textContent = p.kills; ui.damageStat.textContent = p.damage; ui.armorStat.textContent = p.armor; ui.healthPotionCount.textContent = p.potions.health; ui.manaPotionCount.textContent = p.potions.power;
    if (s.phase === 'day' && s.day === 1) ui.objective.textContent = 'STRANDED — gather driftwood, build a campfire, then explore inland before sunset.';
    else if (s.phase === 'night') ui.objective.textContent = `SURVIVE — stay near light, collect colored drops with E. ${Math.ceil(s.phaseTime)} seconds to dawn.`;
    else if (p.infection > 45) ui.objective.textContent = 'INFECTION RISING — campfire light suppresses it. Holy Wardens can Cleanse.';
    else if (s.loot.length) ui.objective.textContent = 'LOOT NEARBY — blue is Enchanted, gold is Rare, violet is Relic. Move close and press E.';
    else ui.objective.textContent = 'Push farther inland, improve your gear, and return to camp before dark.';
  }

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight); const s = state, camX = s ? s.camera.x - innerWidth / 2 : 0, camY = s ? s.camera.y - innerHeight / 2 : 0;
    const shakeX = s?.shake ? rand(-s.shake, s.shake) : 0, shakeY = s?.shake ? rand(-s.shake, s.shake) : 0;
    ctx.save(); ctx.translate(-camX + shakeX, -camY + shakeY); drawGround(camX, camY);
    if (s) { drawTerrainPatches(); drawPaths(); drawDecor(); drawPoisBack(); drawResources(); drawBuildings(); drawLoot(); drawDeaths(); drawProjectiles(); drawEnemies(); drawPoisFront(); drawPlayer(); drawSlashes(); drawSpells(); drawParticles(); drawFloaters(); drawBuildGhost(); }
    ctx.restore(); if (s) drawNightOverlay();
  }

  function drawGround(camX, camY) {
    ctx.fillStyle = '#172017'; ctx.fillRect(WORLD.shoreX, 0, WORLD.w - WORLD.shoreX, WORLD.h);
    ctx.fillStyle = '#33413b'; ctx.fillRect(0, 0, 330, WORLD.h);
    ctx.fillStyle = '#8b7b5a'; ctx.fillRect(330, 0, 245, WORLD.h);
    for (let y = Math.floor(camY / 28) * 28; y < camY + innerHeight + 28; y += 28) {
      ctx.strokeStyle = `rgba(196,214,199,${.03 + .02 * Math.sin(y * .08 + (state?.elapsed || 0))})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, y); ctx.bezierCurveTo(90, y - 5, 220, y + 7, 330, y); ctx.stroke();
    }
    const grid = 64, x0 = Math.floor(Math.max(WORLD.shoreX, camX) / grid) * grid, y0 = Math.floor(camY / grid) * grid; ctx.strokeStyle = 'rgba(210,190,150,.018)'; ctx.lineWidth = 1;
    for (let x = x0; x < camX + innerWidth + grid; x += grid) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, camY + innerHeight + grid); ctx.stroke(); }
    for (let y = y0; y < camY + innerHeight + grid; y += grid) { ctx.beginPath(); ctx.moveTo(Math.max(WORLD.shoreX, camX), y); ctx.lineTo(camX + innerWidth + grid, y); ctx.stroke(); }
  }

  function drawTerrainPatches() {
    const colors = { beachgrass: '#3a4030', dirt: '#4b3f2d', deadgrass: '#3b3c2b', stone: '#353934', mud: '#302f26', sick: '#2e3522' };
    for (const p of terrainPatches) { ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, p.ry / p.rx); ctx.fillStyle = colors[p.type]; ctx.globalAlpha = .68; ctx.beginPath(); ctx.arc(0, 0, p.rx, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.restore(); }
    for (let i = 0; i < 18; i++) { const x = 370 + i * 10, y = 140 + (i * 131) % 2100; ctx.fillStyle = i % 2 ? '#5a6246' : '#6e6848'; ctx.fillRect(x, y, 6, 18); }
  }

  function drawPaths() {
    ctx.strokeStyle = '#62533a'; ctx.lineWidth = 44; ctx.lineCap = 'round'; ctx.globalAlpha = .34; ctx.beginPath();
    for (let x = 620; x <= 2850; x += 80) { const y = pathY(x); if (x === 620) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#86704c'; ctx.lineWidth = 2; ctx.globalAlpha = .15; ctx.stroke(); ctx.globalAlpha = 1;
  }

  function drawDecor() {
    state.decor.forEach(d => {
      const x = Math.round(d.x), y = Math.round(d.y); ctx.save(); ctx.translate(x, y); ctx.rotate(d.rot || 0);
      if (d.type === 'grass') { ctx.strokeStyle = '#4d6746'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(-3, -d.size); ctx.moveTo(0, 4); ctx.lineTo(4, -d.size * .7); ctx.stroke(); }
      else if (d.type === 'leaves') { ctx.fillStyle = '#4a5136'; ctx.fillRect(-5, -2, 4, 3); ctx.fillStyle = '#635a37'; ctx.fillRect(3, 2, 3, 2); }
      else if (d.type === 'stone') { ctx.fillStyle = '#4b4d45'; ctx.fillRect(-d.size, -d.size * .5, d.size * 2, d.size); ctx.fillStyle = '#63665c'; ctx.fillRect(-d.size + 2, -d.size * .5, d.size * 1.5, 2); }
      else if (d.type === 'root') { ctx.strokeStyle = '#564431'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(0, -5, 9, 2); ctx.stroke(); }
      else if (d.type === 'stump') { ctx.fillStyle = '#53402d'; ctx.fillRect(-6, -7, 12, 12); ctx.fillStyle = '#796245'; ctx.fillRect(-5, -7, 10, 3); }
      else if (d.type === 'bone') { ctx.strokeStyle = '#b0aa97'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, 2); ctx.moveTo(-5, 3); ctx.lineTo(5, -3); ctx.stroke(); }
      else if (d.type === 'log') { ctx.fillStyle = '#382e23'; ctx.fillRect(-d.size, -6, d.size * 2, 14); ctx.fillStyle = '#594631'; ctx.fillRect(-d.size, -6, d.size * 2, 7); }
      ctx.restore();
    });
  }

  function drawPoisBack() {
    for (const poi of POIS) {
      const x = poi.x, y = poi.y;
      if (poi.type === 'wreck') {
        ctx.fillStyle = '#3a2d21'; ctx.save(); ctx.translate(x, y); ctx.rotate(-.18); ctx.fillRect(-90, -18, 180, 36); ctx.fillStyle = '#5c4730'; ctx.fillRect(-70, -24, 120, 10); ctx.fillStyle = '#28241f'; ctx.fillRect(34, -90, 8, 85); ctx.restore();
      } else if (poi.type === 'chapel') {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 66, 120, 34, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#41413b'; ctx.fillRect(x - 92, y - 70, 184, 136); ctx.fillStyle = '#55534b'; ctx.fillRect(x - 76, y - 92, 152, 35); ctx.fillStyle = '#2b2c29'; ctx.fillRect(x - 20, y + 12, 40, 54); ctx.fillStyle = '#707067'; ctx.fillRect(x - 4, y - 124, 8, 42); ctx.fillRect(x - 15, y - 110, 30, 8);
      } else if (poi.type === 'camp') {
        ctx.fillStyle = '#4e3d2e'; ctx.fillRect(x - 75, y + 20, 150, 11); ctx.fillStyle = '#635640'; ctx.beginPath(); ctx.moveTo(x - 52, y + 18); ctx.lineTo(x - 10, y - 40); ctx.lineTo(x + 30, y + 18); ctx.closePath(); ctx.fill();
      } else if (poi.type === 'cabin') {
        ctx.fillStyle = '#45362a'; ctx.fillRect(x - 72, y - 48, 144, 104); ctx.fillStyle = '#2f2922'; ctx.beginPath(); ctx.moveTo(x - 90, y - 48); ctx.lineTo(x, y - 100); ctx.lineTo(x + 88, y - 48); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#171715'; ctx.fillRect(x - 15, y + 5, 30, 51);
      } else if (poi.type === 'graveyard') {
        for (let i = 0; i < 10; i++) { const gx = x - 100 + (i % 5) * 48, gy = y - 65 + Math.floor(i / 5) * 90; ctx.fillStyle = '#565952'; ctx.fillRect(gx - 8, gy - 20, 16, 35); ctx.fillRect(gx - 13, gy - 14, 26, 6); }
      } else if (poi.type === 'grove') {
        ctx.fillStyle = 'rgba(88,101,43,.12)'; ctx.beginPath(); ctx.arc(x, y, 190, 0, TAU); ctx.fill();
      }
    }
  }

  function drawPoisFront() {
    for (const poi of POIS) {
      if (poi.type === 'camp') { ctx.fillStyle = '#c47735'; ctx.fillRect(poi.x - 7, poi.y + 4, 14, 18); ctx.fillStyle = 'rgba(210,125,52,.08)'; ctx.beginPath(); ctx.arc(poi.x, poi.y + 10, 72, 0, TAU); ctx.fill(); }
      if (poi.type === 'wreck') { ctx.fillStyle = '#9a895f'; ctx.fillRect(poi.x + 68, poi.y - 22, 26, 16); }
      if (poi.type === 'grove') { for (let i = 0; i < 8; i++) { const a = i * TAU / 8, r = 120 + (i % 2) * 28, gx = poi.x + Math.cos(a) * r, gy = poi.y + Math.sin(a) * r; ctx.fillStyle = '#374424'; ctx.fillRect(gx - 12, gy - 60, 24, 70); ctx.fillStyle = '#556833'; ctx.fillRect(gx - 24, gy - 80, 48, 34); } }
    }
  }

  function drawResources() {
    state.resources.slice().sort((a, b) => a.y - b.y).forEach(r => {
      const x = Math.round(r.x), y = Math.round(r.y);
      if (r.type === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,.36)'; ctx.beginPath(); ctx.ellipse(x + 12, y + 22, r.r * .9, r.r * .35, .15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#4c3a28'; ctx.fillRect(x - 6, y - 2, 12, 42); ctx.fillStyle = '#6a5031'; ctx.fillRect(x - 3, y - 2, 6, 40);
        ctx.fillStyle = '#263429'; ctx.beginPath(); ctx.ellipse(x, y - 28, r.r * 1.05, r.r * .72, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#344536'; ctx.beginPath(); ctx.ellipse(x - 8, y - 40, r.r * .78, r.r * .56, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#40523f'; ctx.fillRect(x - r.r * .55, y - 58, r.r * .7, 10);
      } else if (r.type === 'herb') {
        ctx.strokeStyle = '#6f8d65'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x - 7, y - 8); ctx.moveTo(x, y + 7); ctx.lineTo(x + 8, y - 5); ctx.moveTo(x, y + 7); ctx.lineTo(x + 1, y - 11); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(129,112,170,.16)'; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#7f70a6'; ctx.beginPath(); ctx.moveTo(x, y - 17); ctx.lineTo(x + 10, y + 5); ctx.lineTo(x, y + 15); ctx.lineTo(x - 10, y + 5); ctx.closePath(); ctx.fill();
      }
    });
  }

  function drawBuildings() {
    state.buildings.slice().sort((a, b) => a.y - b.y).forEach(b => {
      const x = Math.round(b.x), y = Math.round(b.y);
      if (b.type === 'barricade') {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x + 7, y + 15, 38, 12, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#4f3d2c'; for (let i = -1; i <= 1; i++) { ctx.fillRect(-32, i * 11 - 5, 64, 9); ctx.fillStyle = i === 0 ? '#6d5035' : '#4f3d2c'; ctx.fillRect(-31, i * 11 - 5, 58, 3); } ctx.restore();
      } else if (b.type === 'campfire') {
        ctx.fillStyle = 'rgba(0,0,0,.36)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 30, 10, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#665039'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - 16, y + 10); ctx.lineTo(x + 16, y - 10); ctx.moveTo(x - 16, y - 10); ctx.lineTo(x + 16, y + 10); ctx.stroke();
        const pulse = 5 + Math.sin(b.pulse * 7) * 2; ctx.fillStyle = '#c67b39'; ctx.beginPath(); ctx.moveTo(x, y - 25 - pulse); ctx.lineTo(x + 11, y + 5); ctx.lineTo(x, y + 11); ctx.lineTo(x - 11, y + 5); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e5b65d'; ctx.fillRect(x - 4, y - 12 - pulse * .5, 8, 17);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(x, y + 14, 28, 10, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#9e986b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x + 24, y + 16); ctx.lineTo(x - 24, y + 16); ctx.closePath(); ctx.stroke();
      }
      if (b.hp < b.maxHp) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x - 22, y - b.r - 24, 44, 4); ctx.fillStyle = '#8b805a'; ctx.fillRect(x - 22, y - b.r - 24, 44 * b.hp / b.maxHp, 4); }
    });
  }

  function drawLoot() {
    ctx.textAlign = 'center'; ctx.font = '700 10px ui-sans-serif,system-ui';
    state.loot.forEach(l => {
      const x = Math.round(l.x), y = Math.round(l.y), bob = Math.sin(l.pulse * 4) * 2;
      if (l.kind === 'item') {
        const r = RARITIES[l.item.rarity], beam = r.beam;
        if (beam) { const g = ctx.createLinearGradient(x, y - beam, x, y + 2); g.addColorStop(0, 'transparent'); g.addColorStop(.45, r.color + '33'); g.addColorStop(1, r.color + 'cc'); ctx.fillStyle = g; ctx.fillRect(x - (l.item.rarity === 'relic' ? 8 : 4), y - beam, l.item.rarity === 'relic' ? 16 : 8, beam); }
        if (l.item.rarity === 'magic') { ctx.fillStyle = r.color + '22'; ctx.beginPath(); ctx.arc(x, y, 22 + Math.sin(l.pulse * 4) * 2, 0, TAU); ctx.fill(); }
        if (l.item.rarity === 'rare' || l.item.rarity === 'relic') { ctx.strokeStyle = r.color + '88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 5, 15 + Math.sin(l.pulse * 3) * 3, 7, 0, 0, TAU); ctx.stroke(); }
        if (l.item.rarity === 'relic') { for (let i = 0; i < 4; i++) { const a = l.pulse * 1.8 + i * TAU / 4; ctx.fillStyle = r.color; ctx.fillRect(x + Math.cos(a) * 18, y - 14 + Math.sin(a) * 11, 3, 3); } }
        ctx.fillStyle = r.color; ctx.beginPath(); ctx.moveTo(x, y - 8 + bob); ctx.lineTo(x + 8, y + bob); ctx.lineTo(x, y + 8 + bob); ctx.lineTo(x - 8, y + bob); ctx.closePath(); ctx.fill(); ctx.fillText(l.item.name, x, y - 22 - Math.min(28, beam * .14));
      } else {
        const c = l.potion === 'health' ? '#b94b50' : '#526fb4'; ctx.fillStyle = c; ctx.fillRect(x - 7, y - 10 + bob, 14, 17); ctx.fillStyle = '#cfc8bb'; ctx.fillRect(x - 4, y - 14 + bob, 8, 4); ctx.fillStyle = c; ctx.fillText(l.potion === 'health' ? 'Health Potion' : `${powerLabel(state.player.className)} Potion`, x, y - 20);
      }
    });
  }

  function drawDeaths() {
    state.deaths.forEach(d => { const t = 1 - d.life / d.max; ctx.globalAlpha = d.life / d.max; ctx.fillStyle = d.type === 'wraith' ? '#625177' : '#5c2d27'; ctx.beginPath(); ctx.ellipse(d.x, d.y + t * 15, d.r * (1 + t * .8), Math.max(2, d.r * .45 * (1 - t)), 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; });
  }

  function drawPlayer() {
    const p = state.player, x = Math.round(p.x), y = Math.round(p.y), a = p.appearance, weapon = p.gear.weapon, weaponColor = RARITIES[weapon?.rarity || 'common'].color;
    const walk = p.moving ? Math.sin(state.elapsed * 12) : 0, bob = p.moving ? Math.abs(Math.sin(state.elapsed * 12)) * 3 : 0, attack = p.attackVisual > 0 ? 1 - p.attackVisual / .24 : 0;
    const chestColor = p.gear.chest ? mixColor(a.outfit, RARITIES[p.gear.chest.rarity].color, .28) : a.outfit;
    ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 24, 29, 11, .08, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y - bob); if (p.facingDir === 'left') ctx.scale(-1, 1);
    const sideways = p.facingDir === 'left' || p.facingDir === 'right';
    ctx.fillStyle = '#252422'; ctx.fillRect(-15 + walk * 2, 17, 10, 27); ctx.fillRect(6 - walk * 2, 17, 10, 27);
    ctx.fillStyle = chestColor; if (sideways) { ctx.fillRect(-15, -15, 29, 38); ctx.fillStyle = shade(chestColor, -.18); ctx.fillRect(6, -14, 8, 36); } else { ctx.fillRect(-18, -15, 36, 39); ctx.fillStyle = shade(chestColor, -.15); ctx.fillRect(-18, 13, 36, 11); }
    if (p.gear.chest) { ctx.strokeStyle = RARITIES[p.gear.chest.rarity].color; ctx.lineWidth = 2; ctx.strokeRect(-16, -14, 32, 35); }
    ctx.fillStyle = a.skin; const armSwing = walk * 5; ctx.fillRect(-23, -10 + armSwing, 8, 31); ctx.fillRect(15, -10 - armSwing, 8, 31);
    ctx.fillStyle = a.skin; ctx.fillRect(-11, -38, 22, 24);
    if (a.hairStyle === 'hooded') { ctx.fillStyle = chestColor; ctx.fillRect(-15, -44, 30, 29); ctx.fillStyle = a.skin; ctx.fillRect(-8, -36, 16, 19); }
    else { ctx.fillStyle = a.hair; if (a.hairStyle === 'wild') { ctx.fillRect(-15, -45, 30, 11); ctx.fillRect(-11, -50, 8, 8); ctx.fillRect(5, -48, 8, 8); } else if (a.hairStyle === 'shaved') ctx.fillRect(-11, -42, 22, 5); else ctx.fillRect(-12, -44, 24, 9); }
    if (p.gear.helm) { ctx.strokeStyle = RARITIES[p.gear.helm.rarity].color; ctx.lineWidth = 3; ctx.strokeRect(-14, -45, 28, 17); }
    if (p.className === 'holy') {
      ctx.save(); ctx.translate(18, 3); ctx.rotate(-.8 + attack * 1.55); ctx.fillStyle = '#312b23'; ctx.fillRect(-3, -1, 6, 42); ctx.fillStyle = weaponColor; ctx.fillRect(-7, -8, 14, 12); ctx.restore();
      ctx.fillStyle = p.gear.chest ? RARITIES[p.gear.chest.rarity].color : '#6b6659'; ctx.beginPath(); ctx.ellipse(-22, 3, 11, 18, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#24231f'; ctx.stroke();
    } else {
      ctx.save(); ctx.translate(19, -1); ctx.rotate(-.45 + attack * .55); ctx.fillStyle = '#312b23'; ctx.fillRect(-3, -12, 6, 57); ctx.fillStyle = weaponColor; ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(8, -10); ctx.lineTo(0, -4); ctx.lineTo(-8, -10); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemies() {
    state.enemies.slice().sort((a, b) => a.y - b.y).forEach(e => {
      const x = Math.round(e.x), y = Math.round(e.y), bob = Math.sin(state.elapsed * 8 + e.x) * 2; ctx.globalAlpha = e.spawnAlpha;
      ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(x + 5, y + e.r, e.r * 1.1, e.r * .4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = e.hitFlash > 0 ? '#e6d9be' : e.color;
      if (e.type === 'wraith') { ctx.beginPath(); ctx.moveTo(x, y - 24 + bob); ctx.lineTo(x + 16, y + 10); ctx.lineTo(x + 7, y + 6); ctx.lineTo(x, y + 23); ctx.lineTo(x - 7, y + 6); ctx.lineTo(x - 16, y + 10); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#b76be0'; ctx.fillRect(x - 7, y - 9, 3, 3); ctx.fillRect(x + 4, y - 9, 3, 3); }
      else { const lunge = e.attackAnim > 0 ? 5 : 0; ctx.fillRect(x - e.r + 3, y - e.r + 7 + lunge, e.r * 2 - 6, e.r * 2 - 2); ctx.fillStyle = e.hitFlash > 0 ? '#f4ead7' : e.type === 'rotter' ? '#8b8450' : '#75837a'; ctx.fillRect(x - 10, y - e.r - 5 + lunge, 20, 16); ctx.fillStyle = '#171718'; ctx.fillRect(x - 6, y - 7 + lunge, 3, 3); ctx.fillRect(x + 3, y - 7 + lunge, 3, 3); }
      ctx.fillStyle = 'rgba(0,0,0,.48)'; ctx.fillRect(x - 18, y - e.r - 17, 36, 4); ctx.fillStyle = '#9b4b46'; ctx.fillRect(x - 18, y - e.r - 17, 36 * clamp(e.health / e.maxHealth, 0, 1), 4);
      if (e.slow > 0) { ctx.strokeStyle = '#7e9db0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, e.r + 7, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
  }

  function drawProjectiles() {
    state.projectiles.forEach(p => {
      ctx.strokeStyle = p.color + '66'; ctx.lineWidth = p.r * 1.5; ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.6); g.addColorStop(0, '#ffffff'); g.addColorStop(.22, p.color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.6, 0, TAU); ctx.fill();
    });
  }

  function drawSlashes() {
    state.slashes.forEach(s => { const t = 1 - s.life / s.max, angle = Math.atan2(s.dir.y, s.dir.x); ctx.strokeStyle = s.color; ctx.globalAlpha = s.life / s.max; ctx.lineWidth = 7 * (1 - t * .4); ctx.beginPath(); ctx.arc(s.x, s.y, 46 + t * 30, angle - .65, angle + .65); ctx.stroke(); ctx.globalAlpha = 1; });
  }

  function drawSpells() {
    state.spells.forEach(s => {
      const t = 1 - s.life / s.max; ctx.globalAlpha = s.life / s.max;
      if (s.type === 'smite') { ctx.strokeStyle = '#f0d77b'; ctx.lineWidth = 8 * (1 - t); ctx.beginPath(); ctx.moveTo(s.x, s.y - 150 + t * 120); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.fillStyle = '#f0d77b44'; ctx.beginPath(); ctx.arc(s.x, s.y, 18 + t * 36, 0, TAU); ctx.fill(); }
      if (s.type === 'cleanse') { ctx.strokeStyle = '#e9e0a4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(s.x, s.y, 20 + t * 90, 0, TAU); ctx.stroke(); }
      if (s.type === 'nova') { ctx.strokeStyle = '#94c2da'; ctx.lineWidth = 8 * (1 - t); ctx.beginPath(); ctx.arc(s.x, s.y, 28 + t * 210, 0, TAU); ctx.stroke(); }
      if (s.type === 'arcaneHit') { ctx.fillStyle = '#9e87e555'; ctx.beginPath(); ctx.arc(s.x, s.y, 8 + t * 28, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    });
  }

  function drawParticles() { state.particles.forEach(p => { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }); ctx.globalAlpha = 1; }
  function drawFloaters() { ctx.font = '700 10px ui-sans-serif,system-ui'; ctx.textAlign = 'center'; state.floaters.forEach(f => { ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }); ctx.globalAlpha = 1; }
  function drawBuildGhost() { if (!state.buildMode) return; const cfg = BUILD[state.buildMode], w = screenToWorld(mouse.x, mouse.y); ctx.strokeStyle = distance(state.player, w) <= 165 ? 'rgba(190,167,113,.82)' : 'rgba(187,92,78,.82)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(w.x, w.y, cfg.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }

  function drawNightOverlay() {
    const s = state; let alpha = 0;
    if (s.phase === 'night') alpha = .72 + .04 * Math.sin(s.elapsed * .35); else { const f = s.phaseTime / DAY_LENGTH; if (f < .18) alpha = (.18 - f) / .18 * .26; if (f > .86) alpha = (f - .86) / .14 * .18; }
    if (alpha <= 0) return;
    const layer = document.createElement('canvas'); layer.width = Math.ceil(innerWidth); layer.height = Math.ceil(innerHeight); const l = layer.getContext('2d');
    l.fillStyle = `rgba(5,7,11,${alpha})`; l.fillRect(0, 0, innerWidth, innerHeight); l.globalCompositeOperation = 'destination-out';
    const lights = [{ x: s.player.x, y: s.player.y, r: s.phase === 'night' ? 175 : 120 }]; state.buildings.filter(b => b.type === 'campfire').forEach(b => lights.push({ x: b.x, y: b.y, r: 230 }));
    for (const light of lights) { const sx = light.x - s.camera.x + innerWidth / 2, sy = light.y - s.camera.y + innerHeight / 2, g = l.createRadialGradient(sx, sy, 18, sx, sy, light.r); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(.42, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); l.fillStyle = g; l.beginPath(); l.arc(sx, sy, light.r, 0, TAU); l.fill(); }
    l.globalCompositeOperation = 'source-over'; ctx.drawImage(layer, 0, 0);
    if (s.phase === 'night') {
      for (let i = 0; i < s.fogSeed.length; i++) { const f = s.fogSeed[i], x = ((f.x + s.elapsed * f.speed) % (innerWidth + f.size * 2)) - f.size, y = (f.y + Math.sin(s.elapsed * .18 + i) * 34) % innerHeight; const g = ctx.createRadialGradient(x, y, 0, x, y, f.size); g.addColorStop(0, 'rgba(160,172,166,.055)'); g.addColorStop(1, 'rgba(160,172,166,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, f.size, 0, TAU); ctx.fill(); }
      for (let i = 0; i < 6; i++) { const edge = i % 2, ex = edge ? 40 + (i * 173) % Math.max(80, innerWidth - 80) : innerWidth - 40 - (i * 137) % Math.max(80, innerWidth - 80), ey = 90 + (i * 131) % Math.max(100, innerHeight - 190); const blink = Math.sin(s.elapsed * 1.3 + i * 2.2); if (blink > .2) { ctx.fillStyle = 'rgba(190,82,64,.45)'; ctx.fillRect(ex - 5, ey, 3, 2); ctx.fillRect(ex + 3, ey, 3, 2); } }
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), r = clamp((n >> 16) + amt * 255, 0, 255), g = clamp(((n >> 8) & 255) + amt * 255, 0, 255), b = clamp((n & 255) + amt * 255, 0, 255); return `rgb(${r|0},${g|0},${b|0})`;
  }
  function mixColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255, br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
    return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
  }

  function loop(now) {
    const dt = Math.min(.033, (now - previous) / 1000); previous = now; if (state?.running && !state.inventoryOpen) update(dt); draw(); if (state?.running) raf = requestAnimationFrame(loop);
  }

  initCreator(); draw();
})();
