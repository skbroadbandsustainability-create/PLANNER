/* ============================================================
   똥괴물 대소동: 마을을 구해라!
   Three.js 기반 3D 어드벤처 미니게임 (순수 JS, 빌드 도구 불필요)
   ============================================================ */

(() => {
  "use strict";

  // ---------------------------------------------------------
  // 기본 설정값
  // ---------------------------------------------------------
  const MAP_SIZE = 46; // 맵 절반 크기 (-MAP_SIZE ~ +MAP_SIZE)
  const TOTAL_MONSTERS = 8;
  const TOTAL_FRIENDS = 4;

  const PLAYER_BASE_SPEED = 6.5;
  const PLAYER_BASE_ATTACK = 22;
  const PLAYER_BASE_ENERGY_REGEN = 6;

  const SWORD_SPEED = 22;
  const SWORD_MAX_RANGE = 26;
  const THROW_COOLDOWN = 0.32;

  const POOP_SPEED = 7.5;
  const POOP_DAMAGE = 10;
  const POOP_ENERGY_DRAIN = 14;
  const POOP_SLOW_DURATION = 1.6;
  const POOP_SLOW_FACTOR = 0.45;

  const MELEE_DEFLECT_RANGE = 3.2;
  const SWING_DURATION = 0.28;

  // ---------------------------------------------------------
  // 상태
  // ---------------------------------------------------------
  const state = {
    started: false,
    over: false,
    clock: new THREE.Clock(),
    keys: {},
    mouseNDC: new THREE.Vector2(0, 0),
    aimPoint: new THREE.Vector3(),

    player: {
      health: 100,
      maxHealth: 100,
      energy: 100,
      maxEnergy: 100,
      speed: PLAYER_BASE_SPEED,
      attack: PLAYER_BASE_ATTACK,
      energyRegen: PLAYER_BASE_ENERGY_REGEN,
      slowTimer: 0,
      throwTimer: 0,
      swingTimer: 0,
      facing: new THREE.Vector3(0, 0, 1),
      handVisible: true,
    },

    inventory: { heal: 1, energyPotion: 1, coin: 0 },
    skills: { attack: 0, speed: 0, energy: 0 },

    monstersDefeated: 0,
    friendsRescued: 0,

    monsters: [],
    poops: [],
    swords: [],
    pickups: [],
    cages: [],
  };

  // ---------------------------------------------------------
  // Three.js 기본 세팅
  // ---------------------------------------------------------
  const canvas = document.getElementById("game-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9db77a);
  scene.fog = new THREE.Fog(0x9db77a, 26, 90);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    300
  );
  const cameraOffset = new THREE.Vector3(0, 9.5, 11.5);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // 조명
  const hemi = new THREE.HemisphereLight(0xdfe9c9, 0x53431f, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 0.9);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // ---------------------------------------------------------
  // 바닥 + 도시(오염된 마을)
  // ---------------------------------------------------------
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE * 2 + 20, MAP_SIZE * 2 + 20);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x77874a });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 오염된 웅덩이 패치들 (장식)
  for (let i = 0; i < 30; i++) {
    const r = 1 + Math.random() * 2;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(r, 10),
      new THREE.MeshStandardMaterial({ color: 0x5b4326, roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(
      (Math.random() - 0.5) * MAP_SIZE * 1.8,
      0.01,
      (Math.random() - 0.5) * MAP_SIZE * 1.8
    );
    scene.add(patch);
  }

  const buildingColors = [0x8c8c86, 0x9c8a6e, 0x7c8a6a, 0xa08a70];
  const buildings = [];
  function addBuilding(x, z, w, h, d) {
    const mat = new THREE.MeshStandardMaterial({
      color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    box.position.set(x, h / 2, z);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    buildings.push({ mesh: box, x, z, w, d });

    // 오염 표시(초록빛 슬라임 패치)
    const slime = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.7, h * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x5e7a2e, roughness: 1 })
    );
    slime.position.set(x, h * 0.3, z + d / 2 + 0.02);
    scene.add(slime);
  }

  // 마을 건물 배치 (링 형태로 배치해서 가운데 광장 확보)
  const buildingSpots = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const radius = 22 + Math.random() * 14;
    buildingSpots.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    });
  }
  buildingSpots.forEach((spot) => {
    const w = 4 + Math.random() * 3;
    const d = 4 + Math.random() * 3;
    const h = 4 + Math.random() * 6;
    addBuilding(spot.x, spot.z, w, h, d);
  });

  // 마을 중앙 깃발 (구출한 친구들이 모이는 곳)
  const villageCenter = new THREE.Vector3(0, 0, 0);
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8c48a })
  );
  flagPole.position.set(0, 2.5, 0);
  flagPole.castShadow = true;
  scene.add(flagPole);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1),
    new THREE.MeshStandardMaterial({ color: 0xffcf3f, side: THREE.DoubleSide })
  );
  flag.position.set(0.85, 4.4, 0);
  scene.add(flag);

  // ---------------------------------------------------------
  // 플레이어(용사) 생성
  // ---------------------------------------------------------
  function makeHumanoid({ bodyColor, headColor = 0xf1c27d, hatColor }) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 1.3, 10),
      new THREE.MeshStandardMaterial({ color: bodyColor })
    );
    body.position.y = 0.95;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 10),
      new THREE.MeshStandardMaterial({ color: headColor })
    );
    head.position.y = 1.78;
    head.castShadow = true;
    group.add(head);

    if (hatColor) {
      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 0.5, 10),
        new THREE.MeshStandardMaterial({ color: hatColor })
      );
      hat.position.y = 2.1;
      hat.castShadow = true;
      group.add(hat);
    }

    return { group, body, head };
  }

  const heroParts = makeHumanoid({ bodyColor: 0x2f6fd6, hatColor: 0xd6342f });
  const player = heroParts.group;
  player.position.set(0, 0, 14);
  scene.add(player);

  // 손에 든 칼 (투척용 pivot)
  const handPivot = new THREE.Group();
  handPivot.position.set(0.55, 1.05, 0.15);
  player.add(handPivot);
  const swordMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.9, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xd7d7e0, metalness: 0.4, roughness: 0.3 })
  );
  swordMesh.position.set(0, 0.45, 0);
  swordMesh.castShadow = true;
  handPivot.add(swordMesh);

  // ---------------------------------------------------------
  // 사운드 (Web Audio API로 직접 합성 - 외부 파일 불필요)
  // ---------------------------------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq, dur, type, vol, glideTo) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (glideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(glideTo, 1),
        audioCtx.currentTime + dur
      );
    }
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  function noiseBurst(dur, vol) {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start();
  }

  const sfx = {
    throwSword: () => beep(720, 0.09, "triangle", 0.16, 380),
    swordHitMonster: () => beep(180, 0.14, "square", 0.22, 90),
    swordHitPoop: () => beep(520, 0.1, "sine", 0.15, 200),
    poopHitPlayer: () => beep(140, 0.22, "sawtooth", 0.28, 55),
    pickup: () => {
      beep(760, 0.08, "sine", 0.18, 1100);
      setTimeout(() => beep(1000, 0.09, "sine", 0.16, 1400), 70);
    },
    swing: () => noiseBurst(0.16, 0.2),
    rescue: () => {
      beep(500, 0.12, "sine", 0.2, 700);
      setTimeout(() => beep(760, 0.16, "sine", 0.2, 1000), 100);
    },
    monsterDie: () => beep(220, 0.18, "square", 0.2, 40),
    victory: () => {
      [520, 660, 780, 1040].forEach((f, i) =>
        setTimeout(() => beep(f, 0.25, "sine", 0.22), i * 140)
      );
    },
    gameOver: () => {
      [420, 360, 300, 220].forEach((f, i) =>
        setTimeout(() => beep(f, 0.3, "sawtooth", 0.2), i * 160)
      );
    },
  };

  // ---------------------------------------------------------
  // 똥괴물 생성
  // ---------------------------------------------------------
  function makeMonster(x, z) {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a5322 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), bodyMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    const swirl = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x936a30 })
    );
    swirl.position.y = 1.65;
    group.add(swirl);

    // 눈
    [-0.28, 0.28].forEach((ex) => {
      const eyeWhite = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      eyeWhite.position.set(ex, 1.05, 0.62);
      group.add(eyeWhite);
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
      );
      pupil.position.set(ex, 1.05, 0.72);
      group.add(pupil);
    });

    group.position.set(x, 0, z);
    scene.add(group);

    return {
      group,
      bodyMat,
      health: 40,
      maxHealth: 40,
      home: new THREE.Vector3(x, 0, z),
      wanderTarget: new THREE.Vector3(x, 0, z),
      wanderPause: 0,
      attackCooldown: 1 + Math.random() * 2,
      alive: true,
      hitFlash: 0,
    };
  }

  for (let i = 0; i < TOTAL_MONSTERS; i++) {
    const angle = (i / TOTAL_MONSTERS) * Math.PI * 2 + Math.random() * 0.5;
    const radius = 14 + Math.random() * 20;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    state.monsters.push(makeMonster(x, z));
  }

  // ---------------------------------------------------------
  // 갇힌 친구(NPC) + 우리(cage) 생성
  // ---------------------------------------------------------
  function makeFriend(x, z, color, gatherSpot) {
    const parts = makeHumanoid({ bodyColor: color, hatColor: null });
    parts.group.scale.set(0.85, 0.85, 0.85);
    parts.group.position.set(x, 0, z);
    scene.add(parts.group);

    const cage = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.6, 2, 1.6)),
      new THREE.LineBasicMaterial({ color: 0x555555 })
    );
    cage.position.set(x, 1, z);
    scene.add(cage);

    return {
      group: parts.group,
      cage,
      pos: new THREE.Vector3(x, 0, z),
      gatherSpot,
      rescued: false,
      following: false,
    };
  }

  const friendColors = [0xe0a63f, 0x4fae5a, 0xd05fae, 0x5fc4d0];
  const friendSpots = [
    { x: 18, z: -8 },
    { x: -16, z: 10 },
    { x: -10, z: -20 },
    { x: 22, z: 18 },
  ];
  friendSpots.slice(0, TOTAL_FRIENDS).forEach((spot, i) => {
    const angle = (i / TOTAL_FRIENDS) * Math.PI * 2;
    const gatherSpot = new THREE.Vector3(
      Math.cos(angle) * 2.4,
      0,
      Math.sin(angle) * 2.4
    );
    state.cages.push(makeFriend(spot.x, spot.z, friendColors[i % friendColors.length], gatherSpot));
  });

  // ---------------------------------------------------------
  // 입력 처리
  // ---------------------------------------------------------
  window.addEventListener("keydown", (e) => {
    state.keys[e.code] = true;
    if (e.code === "KeyI") toggleInventory();
    if (e.code === "KeyK") toggleSkillTree();
    if (e.code === "Space") {
      e.preventDefault();
      trySwing();
    }
  });
  window.addEventListener("keyup", (e) => {
    state.keys[e.code] = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    state.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    state.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) tryThrowSword();
  });

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();

  function updateAimPoint() {
    raycaster.setFromCamera(state.mouseNDC, camera);
    raycaster.ray.intersectPlane(groundPlane, state.aimPoint);
    if (!state.aimPoint) state.aimPoint = new THREE.Vector3();
  }

  // ---------------------------------------------------------
  // 액션: 칼 던지기 / 방어(휘두르기)
  // ---------------------------------------------------------
  function tryThrowSword() {
    if (!state.started || state.over) return;
    const p = state.player;
    if (p.throwTimer > 0) return;
    p.throwTimer = THROW_COOLDOWN;

    updateAimPoint();
    const dir = new THREE.Vector3().subVectors(state.aimPoint, player.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.0001) dir.set(0, 0, 1);
    dir.normalize();

    player.rotation.y = Math.atan2(dir.x, dir.z);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.9),
      new THREE.MeshStandardMaterial({ color: 0xe7e7ef, metalness: 0.5, roughness: 0.2 })
    );
    mesh.position.copy(player.position).add(new THREE.Vector3(0, 1.05, 0));
    mesh.lookAt(mesh.position.clone().add(dir));
    scene.add(mesh);

    state.swords.push({
      mesh,
      velocity: dir.clone().multiplyScalar(SWORD_SPEED),
      traveled: 0,
    });

    p.handVisible = false;
    swordMesh.visible = false;
    setTimeout(() => {
      p.handVisible = true;
      swordMesh.visible = true;
    }, THROW_COOLDOWN * 1000);

    ensureAudio();
    sfx.throwSword();
  }

  function trySwing() {
    if (!state.started || state.over) return;
    const p = state.player;
    if (p.swingTimer > 0) return;
    p.swingTimer = SWING_DURATION;
    ensureAudio();
    sfx.swing();

    // 사거리 내 몬스터의 똥을 튕겨낸다
    let deflectedAny = false;
    state.poops.forEach((poop) => {
      if (poop.owner !== "monster") return;
      const dist = poop.mesh.position.distanceTo(player.position);
      if (dist <= MELEE_DEFLECT_RANGE) {
        const target = findNearestAliveMonster(poop.mesh.position);
        if (target) {
          const dir = new THREE.Vector3()
            .subVectors(target.group.position, poop.mesh.position)
            .setY(0)
            .normalize();
          poop.velocity.copy(dir.multiplyScalar(POOP_SPEED * 1.3));
          poop.owner = "player";
          poop.target = target;
          poop.mesh.material.emissive = new THREE.Color(0x3fae4a);
          poop.mesh.material.emissiveIntensity = 0.6;
          deflectedAny = true;
        }
      }
    });
    if (deflectedAny) sfx.swordHitPoop();
  }

  function findNearestAliveMonster(fromPos) {
    let best = null;
    let bestDist = Infinity;
    state.monsters.forEach((m) => {
      if (!m.alive) return;
      const d = m.group.position.distanceTo(fromPos);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    });
    return best;
  }

  // ---------------------------------------------------------
  // 몬스터가 똥을 던짐
  // ---------------------------------------------------------
  function monsterThrowPoop(monster) {
    const dir = new THREE.Vector3()
      .subVectors(player.position, monster.group.position)
      .setY(0)
      .normalize();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4423 })
    );
    mesh.position.copy(monster.group.position).add(new THREE.Vector3(0, 1.1, 0));
    scene.add(mesh);

    state.poops.push({
      mesh,
      velocity: dir.multiplyScalar(POOP_SPEED),
      owner: "monster",
      life: 4,
    });
  }

  // ---------------------------------------------------------
  // 아이템 드랍 / 픽업
  // ---------------------------------------------------------
  function spawnPickup(pos) {
    const roll = Math.random();
    let type = "coin";
    let color = 0xffd23f;
    if (roll > 0.6 && roll <= 0.8) {
      type = "heal";
      color = 0xff5f7a;
    } else if (roll > 0.8) {
      type = "energyPotion";
      color = 0x5fc4ff;
    }
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
    );
    mesh.position.copy(pos).setY(0.5);
    scene.add(mesh);
    state.pickups.push({ mesh, type, spin: Math.random() * Math.PI });
  }

  // ---------------------------------------------------------
  // 몬스터 처치
  // ---------------------------------------------------------
  function killMonster(monster) {
    if (!monster.alive) return;
    monster.alive = false;
    scene.remove(monster.group);
    state.monstersDefeated++;
    spawnPickup(monster.group.position);
    sfx.monsterDie();
    updateHUD();
    checkWinCondition();
  }

  // ---------------------------------------------------------
  // HUD / UI 로직
  // ---------------------------------------------------------
  const el = (id) => document.getElementById(id);
  const healthBar = el("health-bar");
  const energyBar = el("energy-bar");
  const rescuedCountEl = el("rescued-count");
  const killedCountEl = el("killed-count");
  const coinCountEl = el("coin-count");
  const hitFlash = el("hit-flash");
  const questToast = el("quest-toast");

  el("rescued-total").textContent = TOTAL_FRIENDS;
  el("killed-total").textContent = TOTAL_MONSTERS;

  function updateHUD() {
    healthBar.style.width = `${Math.max(0, (state.player.health / state.player.maxHealth) * 100)}%`;
    energyBar.style.width = `${Math.max(0, (state.player.energy / state.player.maxEnergy) * 100)}%`;
    rescuedCountEl.textContent = state.friendsRescued;
    killedCountEl.textContent = state.monstersDefeated;
    coinCountEl.textContent = state.inventory.coin;

    el("heal-count").textContent = state.inventory.heal;
    el("energy-count").textContent = state.inventory.energyPotion;
    el("inv-coin-count").textContent = state.inventory.coin;

    el("skill-attack-level").textContent = `Lv.${state.skills.attack}`;
    el("skill-speed-level").textContent = `Lv.${state.skills.speed}`;
    el("skill-energy-level").textContent = `Lv.${state.skills.energy}`;
    el("cost-attack").textContent = skillCost(state.skills.attack);
    el("cost-speed").textContent = skillCost(state.skills.speed);
    el("cost-energy").textContent = skillCost(state.skills.energy);
  }

  function skillCost(level) {
    return 10 + level * 8;
  }

  function showToast(msg) {
    questToast.textContent = msg;
    questToast.classList.remove("hidden");
    questToast.style.opacity = "1";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      questToast.style.opacity = "0";
      setTimeout(() => questToast.classList.add("hidden"), 300);
    }, 2200);
  }

  function flashHit() {
    hitFlash.style.opacity = "1";
    setTimeout(() => (hitFlash.style.opacity = "0"), 150);
  }

  // 인벤토리 패널
  const invPanel = el("inventory-panel");
  const skillPanel = el("skill-panel");
  function toggleInventory() {
    if (!state.started || state.over) return;
    invPanel.classList.toggle("hidden");
    skillPanel.classList.add("hidden");
  }
  function toggleSkillTree() {
    if (!state.started || state.over) return;
    skillPanel.classList.toggle("hidden");
    invPanel.classList.add("hidden");
  }

  document.querySelectorAll(".use-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.use;
      if (type === "heal" && state.inventory.heal > 0) {
        if (state.player.health >= state.player.maxHealth) {
          showToast("체력이 이미 가득 찼어요!");
          return;
        }
        state.inventory.heal--;
        state.player.health = Math.min(
          state.player.maxHealth,
          state.player.health + 40
        );
        sfx.pickup();
      } else if (type === "energy" && state.inventory.energyPotion > 0) {
        state.inventory.energyPotion--;
        state.player.energy = Math.min(
          state.player.maxEnergy,
          state.player.energy + 40
        );
        sfx.pickup();
      }
      updateHUD();
    });
  });

  document.querySelectorAll(".skill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const skill = btn.dataset.skill;
      const level = state.skills[skill];
      const cost = skillCost(level);
      if (state.inventory.coin < cost) {
        showToast("코인이 부족해요! 몬스터를 물리치고 코인을 모아보세요.");
        return;
      }
      state.inventory.coin -= cost;
      state.skills[skill]++;

      if (skill === "attack") state.player.attack = PLAYER_BASE_ATTACK + state.skills.attack * 8;
      if (skill === "speed") state.player.speed = PLAYER_BASE_SPEED + state.skills.speed * 0.9;
      if (skill === "energy")
        state.player.energyRegen = PLAYER_BASE_ENERGY_REGEN + state.skills.energy * 3;

      sfx.pickup();
      updateHUD();
    });
  });

  // ---------------------------------------------------------
  // 시작 / 종료 화면
  // ---------------------------------------------------------
  const startScreen = el("start-screen");
  const endScreen = el("end-screen");
  const hud = el("hud");

  el("start-btn").addEventListener("click", () => {
    ensureAudio();
    startScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    state.started = true;
    state.clock.start();
  });

  el("retry-btn").addEventListener("click", () => {
    window.location.reload();
  });

  function endGame(win) {
    if (state.over) return;
    state.over = true;
    hud.classList.add("hidden");
    endScreen.classList.remove("hidden");
    if (win) {
      el("end-title").textContent = "🎉 마을을 구했어요! 🎉";
      el("end-desc").textContent =
        `친구 ${state.friendsRescued}명을 모두 구출하고,\n` +
        `똥괴물 ${state.monstersDefeated}마리를 물리쳤어요!\n용사님, 정말 대단해요!`;
      sfx.victory();
    } else {
      el("end-title").textContent = "😵 힘이 다 빠졌어요...";
      el("end-desc").textContent = "다시 도전해서 마을을 꼭 구해주세요!";
      sfx.gameOver();
    }
  }

  function checkWinCondition() {
    if (
      state.friendsRescued >= TOTAL_FRIENDS &&
      state.monstersDefeated >= TOTAL_MONSTERS
    ) {
      endGame(true);
    }
  }

  // ---------------------------------------------------------
  // 메인 업데이트 루프
  // ---------------------------------------------------------
  function updatePlayer(dt) {
    const p = state.player;
    if (p.throwTimer > 0) p.throwTimer -= dt;
    if (p.swingTimer > 0) p.swingTimer -= dt;
    if (p.slowTimer > 0) p.slowTimer -= dt;

    // 칼 휘두르기 애니메이션
    const swingProgress = p.swingTimer > 0 ? 1 - p.swingTimer / SWING_DURATION : 1;
    handPivot.rotation.x = p.swingTimer > 0 ? Math.sin(swingProgress * Math.PI) * -1.8 : 0;

    // 이동
    let dx = 0;
    let dz = 0;
    if (state.keys["KeyW"] || state.keys["ArrowUp"]) dz -= 1;
    if (state.keys["KeyS"] || state.keys["ArrowDown"]) dz += 1;
    if (state.keys["KeyA"] || state.keys["ArrowLeft"]) dx -= 1;
    if (state.keys["KeyD"] || state.keys["ArrowRight"]) dx += 1;

    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      const speedMult = p.slowTimer > 0 ? POOP_SLOW_FACTOR : 1;
      const speed = p.speed * speedMult;
      player.position.x += dx * speed * dt;
      player.position.z += dz * speed * dt;
      player.position.x = THREE.MathUtils.clamp(player.position.x, -MAP_SIZE, MAP_SIZE);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -MAP_SIZE, MAP_SIZE);

      if (p.swingTimer <= 0) {
        player.rotation.y = Math.atan2(dx, dz);
      }
    }

    // 에너지 자연 회복
    p.energy = Math.min(p.maxEnergy, p.energy + p.energyRegen * dt);
  }

  function updateCamera() {
    const targetPos = new THREE.Vector3().copy(player.position).add(cameraOffset);
    camera.position.lerp(targetPos, 0.12);
    camera.lookAt(
      player.position.x,
      player.position.y + 1.2,
      player.position.z
    );
  }

  function updateMonsters(dt) {
    state.monsters.forEach((m) => {
      if (!m.alive) return;

      if (m.hitFlash > 0) {
        m.hitFlash -= dt;
        m.bodyMat.emissive = new THREE.Color(0xff5555);
        m.bodyMat.emissiveIntensity = Math.max(0, m.hitFlash / 0.15);
      }

      const distToPlayer = m.group.position.distanceTo(player.position);
      const AGGRO = 16;
      const ATTACK_RANGE = 8;
      const MIN_RANGE = 4.5;

      let moveTarget = null;
      if (distToPlayer <= AGGRO) {
        if (distToPlayer > ATTACK_RANGE) {
          moveTarget = player.position;
        } else if (distToPlayer < MIN_RANGE) {
          // 뒤로 살짝 물러남
          const away = new THREE.Vector3()
            .subVectors(m.group.position, player.position)
            .setY(0)
            .normalize();
          moveTarget = m.group.position.clone().add(away.multiplyScalar(3));
        }

        m.attackCooldown -= dt;
        if (m.attackCooldown <= 0 && distToPlayer <= ATTACK_RANGE + 1) {
          monsterThrowPoop(m);
          m.attackCooldown = 1.6 + Math.random() * 1.6;
        }
      } else {
        // 배회
        m.wanderPause -= dt;
        if (m.group.position.distanceTo(m.wanderTarget) < 0.6 && m.wanderPause <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 6;
          m.wanderTarget = m.home.clone().add(
            new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r)
          );
          m.wanderPause = 1 + Math.random() * 2;
        }
        moveTarget = m.wanderTarget;
      }

      if (moveTarget) {
        const dir = new THREE.Vector3().subVectors(moveTarget, m.group.position).setY(0);
        if (dir.lengthSq() > 0.04) {
          dir.normalize();
          const spd = distToPlayer <= AGGRO ? 2.6 : 1.4;
          m.group.position.x += dir.x * spd * dt;
          m.group.position.z += dir.z * spd * dt;
          m.group.rotation.y = Math.atan2(dir.x, dir.z);
        }
      }

      // 위아래로 살짝 통통 튀는 애니메이션
      m.group.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 3 + m.home.x)) * 0.08;
    });
  }

  function updatePoops(dt) {
    for (let i = state.poops.length - 1; i >= 0; i--) {
      const poop = state.poops[i];
      poop.mesh.position.add(poop.velocity.clone().multiplyScalar(dt));
      poop.mesh.rotation.x += dt * 6;
      poop.life -= dt;

      let remove = false;

      if (poop.owner === "monster") {
        const dist = poop.mesh.position.distanceTo(
          player.position.clone().add(new THREE.Vector3(0, 1, 0))
        );
        if (dist < 0.7) {
          hitPlayer();
          remove = true;
        }
      } else if (poop.owner === "player") {
        const target = poop.target;
        if (target && target.alive) {
          const dist = poop.mesh.position.distanceTo(
            target.group.position.clone().add(new THREE.Vector3(0, 1, 0))
          );
          if (dist < 0.8) {
            damageMonster(target, state.player.attack * 0.6);
            remove = true;
          }
        }
      }

      if (poop.life <= 0) remove = true;
      if (
        Math.abs(poop.mesh.position.x) > MAP_SIZE + 5 ||
        Math.abs(poop.mesh.position.z) > MAP_SIZE + 5
      ) {
        remove = true;
      }

      if (remove) {
        scene.remove(poop.mesh);
        state.poops.splice(i, 1);
      }
    }
  }

  function damageMonster(monster, amount) {
    monster.health -= amount;
    monster.hitFlash = 0.15;
    if (monster.health <= 0) {
      killMonster(monster);
    }
  }

  function hitPlayer() {
    const p = state.player;
    p.health -= POOP_DAMAGE;
    p.energy = Math.max(0, p.energy - POOP_ENERGY_DRAIN);
    p.slowTimer = POOP_SLOW_DURATION;
    flashHit();
    sfx.poopHitPlayer();
    updateHUD();
    if (p.health <= 0) {
      p.health = 0;
      updateHUD();
      endGame(false);
    }
  }

  function updateSwords(dt) {
    for (let i = state.swords.length - 1; i >= 0; i--) {
      const sword = state.swords[i];
      const step = sword.velocity.clone().multiplyScalar(dt);
      sword.mesh.position.add(step);
      sword.traveled += step.length();

      let remove = false;

      // 몬스터와 충돌
      for (const m of state.monsters) {
        if (!m.alive) continue;
        if (sword.mesh.position.distanceTo(m.group.position.clone().add(new THREE.Vector3(0, 1, 0))) < 0.9) {
          damageMonster(m, state.player.attack);
          sfx.swordHitMonster();
          remove = true;
          break;
        }
      }

      // 날아오는 똥과 충돌 (없애기)
      if (!remove) {
        for (let j = state.poops.length - 1; j >= 0; j--) {
          const poop = state.poops[j];
          if (poop.owner !== "monster") continue;
          if (sword.mesh.position.distanceTo(poop.mesh.position) < 0.6) {
            scene.remove(poop.mesh);
            state.poops.splice(j, 1);
            sfx.swordHitPoop();
            remove = true;
            break;
          }
        }
      }

      if (sword.traveled > SWORD_MAX_RANGE) remove = true;

      if (remove) {
        scene.remove(sword.mesh);
        state.swords.splice(i, 1);
      }
    }
  }

  function updatePickups(dt) {
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pick = state.pickups[i];
      pick.spin += dt * 2;
      pick.mesh.rotation.y = pick.spin;
      pick.mesh.position.y = 0.5 + Math.sin(pick.spin * 2) * 0.08;

      if (pick.mesh.position.distanceTo(player.position) < 1.2) {
        if (pick.type === "coin") state.inventory.coin += 5;
        else if (pick.type === "heal") state.inventory.heal += 1;
        else if (pick.type === "energyPotion") state.inventory.energyPotion += 1;

        sfx.pickup();
        scene.remove(pick.mesh);
        state.pickups.splice(i, 1);
        updateHUD();
      }
    }
  }

  function updateFriends() {
    state.cages.forEach((f) => {
      if (f.rescued) {
        if (f.following) {
          // 마을 중앙 깃발 주위 자리로 걸어가서 자리를 잡음
          const target = villageCenter.clone().add(f.gatherSpot);
          const dist = f.group.position.distanceTo(target);
          if (dist > 0.3) {
            const dir = new THREE.Vector3().subVectors(target, f.group.position).setY(0).normalize();
            f.group.position.x += dir.x * 2.2 * (1 / 60);
            f.group.position.z += dir.z * 2.2 * (1 / 60);
            f.group.rotation.y = Math.atan2(dir.x, dir.z);
          } else {
            f.following = false;
          }
        }
        return;
      }
      if (f.group.position.distanceTo(player.position) < 2.5) {
        f.rescued = true;
        f.following = true;
        scene.remove(f.cage);
        state.friendsRescued++;
        showToast("친구를 구출했어요! 🎉");
        sfx.rescue();
        updateHUD();
        checkWinCondition();
      }
    });
  }

  // ---------------------------------------------------------
  // 애니메이션 루프
  // ---------------------------------------------------------
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(state.clock.getDelta(), 0.05);

    if (state.started && !state.over) {
      updateAimPoint();
      updatePlayer(dt);
      updateMonsters(dt);
      updatePoops(dt);
      updateSwords(dt);
      updatePickups(dt);
      updateFriends();
      updateHUD();
    }

    updateCamera();
    renderer.render(scene, camera);
  }

  updateHUD();
  animate();
})();
