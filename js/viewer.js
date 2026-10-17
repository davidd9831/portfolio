// CAD-style 3D viewport, built on three.js (r169, vendored in assets/vendor/three).
//
// Usage: <div class="viewport" data-viewer="brake-pedal">…poster image…</div>
// The name points at a config module in js/models/<name>.js.
// Add data-mode="ambient" for the slowly turning, non-interactive background on the home page.

import * as THREE from '../assets/vendor/three/three.module.min.js';
import { GLTFLoader } from '../assets/vendor/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from '../assets/vendor/three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from '../assets/vendor/three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from '../assets/vendor/three/addons/environments/RoomEnvironment.js';

const DRACO_PATH = new URL('../assets/vendor/three/addons/libs/draco/', import.meta.url).href;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE_POINTER = window.matchMedia('(pointer: fine)').matches;
const SELECT_COLOR = new THREE.Color(0x1f6fd1);
const HOVER_COLOR = new THREE.Color(0x5b9be6);
const EDGE_COLOR = 0x23292f;

let sharedLoader = null;
function getLoader() {
  if (!sharedLoader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    sharedLoader = new GLTFLoader();
    sharedLoader.setDRACOLoader(draco);
  }
  return sharedLoader;
}

const icon = (name) => `<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
const deg = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function orbitToOffset(theta, phi, r) {
  const t = deg(theta), p = deg(clamp(phi, 0.01, 179.99));
  return new THREE.Vector3(r * Math.sin(p) * Math.sin(t), r * Math.cos(p), r * Math.sin(p) * Math.cos(t));
}

class Viewer {
  constructor(el, config) {
    this.el = el;
    this.cfg = config;
    this.ambient = el.dataset.mode === 'ambient';
    this.needsRender = true;
    this.tweens = [];
    this.parts = new Map();        // id -> { def, nodes:[Object3D], meshes:[Mesh] }
    this.meshPart = new Map();     // mesh -> part id
    this.meshes = [];
    this.anim = { travel: 0, explode: 0 };
    this.selected = null;          // { id, node }
    this.hovered = null;
    this.modelIndex = 0;
    this.visible = true;
  }

  // ---------- setup ----------
  async init() {
    this.el.classList.add('is-loading');
    this.buildDom();
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
      this.fail('Your browser could not start 3D graphics, so a still image is shown instead.');
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = this.cfg.exposure || 1.0;
    r.domElement.className = 'vp-canvas';
    r.domElement.setAttribute('aria-hidden', 'true');
    this.stage.prepend(r.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8796a8, 0.35));

    this.camera = new THREE.PerspectiveCamera(this.cfg.fov || 28, 1, 0.001, 100);
    this.target = new THREE.Vector3();

    if (!this.ambient) this.setupControls();
    this.resize();
    new ResizeObserver(() => { this.resize(); this.needsRender = true; }).observe(this.stage);
    new IntersectionObserver((entries) => {
      this.visible = entries[0].isIntersecting;
      if (this.visible) this.kick();
    }, { rootMargin: '120px' }).observe(this.el);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });

    try {
      await this.loadModel(0);
    } catch (err) {
      console.error(err);
      this.fail('The 3D model could not be loaded. A still image is shown instead.');
      return;
    }
    this.el.classList.remove('is-loading');
    this.el.classList.add('is-ready');
    document.documentElement.classList.add('viewer-ready');
    this.kick();
    if (!this.ambient) this.showHint();
  }

  fail(message) {
    this.el.classList.remove('is-loading');
    this.el.classList.add('is-failed');
    if (this.ambient) return;
    const note = document.createElement('p');
    note.className = 'vp-note';
    note.textContent = message;
    this.stage.append(note);
  }

  buildDom() {
    const el = this.el;
    this.stage = el.querySelector('.vp-stage') || el;
    if (this.ambient) {
      this.stage.insertAdjacentHTML('beforeend', this.triadHtml());
      this.triad = this.stage.querySelector('.vp-triad');
      return;
    }
    const cfg = this.cfg;
    const views = (cfg.views || []).map((v, i) =>
      `<li role="none"><button type="button" role="menuitem" data-view="${i}">${escapeHtml(v.label)}</button></li>`).join('');
    const models = cfg.models.length > 1
      ? `<div class="vp-seg" role="group" aria-label="Model">${cfg.models.map((m, i) =>
          `<button type="button" data-model="${i}" aria-pressed="${i === 0}">${escapeHtml(m.label)}</button>`).join('')}</div>`
      : '';
    const tools = [];
    tools.push(`<button type="button" class="vp-btn" data-act="reset" title="Reset view">${icon('fit')}<span>Reset view</span></button>`);
    if (views) {
      tools.push(`<div class="vp-menu"><button type="button" class="vp-btn" data-act="views" aria-haspopup="menu" aria-expanded="false" title="Standard views">${icon('cube')}<span>Views</span>${icon('chev-down')}</button><ul class="vp-menu-list" role="menu" hidden>${views}</ul></div>`);
    }
    if (cfg.edges) tools.push(`<button type="button" class="vp-btn" data-act="edges" aria-pressed="true" title="Show edges">${icon('edges')}<span>Edges</span></button>`);
    if (cfg.explode) tools.push(`<button type="button" class="vp-btn" data-act="explode" aria-pressed="false" title="Exploded view">${icon('explode')}<span>Explode</span></button>`);
    if (cfg.balloons) tools.push(`<button type="button" class="vp-btn" data-act="labels" aria-pressed="false" title="Number the parts">${icon('balloon')}<span>Labels</span></button>`);
    if (models) tools.push(models);
    tools.push(`<button type="button" class="vp-btn" data-act="expand" aria-pressed="false" title="Full screen">${icon('expand')}<span>Full screen</span></button>`);

    this.stage.insertAdjacentHTML('beforeend', `
      <div class="vp-hud" role="toolbar" aria-label="3D view controls">${tools.join('')}</div>
      ${this.triadHtml()}
      <div class="vp-load" role="status"><span class="vp-load-text">Opening ${escapeHtml(cfg.title)}…</span><span class="vp-load-bar"><span></span></span></div>
      <p class="vp-hint" aria-hidden="true"></p>
      <div class="vp-balloons" aria-hidden="false"></div>
      <div class="vp-card" hidden></div>
      <div class="vp-tip" hidden></div>`);
    this.hud = this.stage.querySelector('.vp-hud');
    this.triad = this.stage.querySelector('.vp-triad');
    this.loadBar = this.stage.querySelector('.vp-load-bar span');
    this.hint = this.stage.querySelector('.vp-hint');
    this.balloonLayer = this.stage.querySelector('.vp-balloons');
    this.card = this.stage.querySelector('.vp-card');
    this.tip = this.stage.querySelector('.vp-tip');
    this.bindHud();
    if (cfg.motion) this.buildMotion();
  }

  triadHtml() {
    return `<svg class="vp-triad" viewBox="-40 -40 80 80" aria-hidden="true">
      <g class="ax ax-x"><line x1="0" y1="0" x2="0" y2="0"/><text>X</text></g>
      <g class="ax ax-y"><line x1="0" y1="0" x2="0" y2="0"/><text>Y</text></g>
      <g class="ax ax-z"><line x1="0" y1="0" x2="0" y2="0"/><text>Z</text></g>
      <circle r="2.6"/></svg>`;
  }

  setupControls() {
    const c = new OrbitControls(this.camera, this.renderer.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.rotateSpeed = 0.85;
    c.zoomSpeed = 0.9;
    c.screenSpacePanning = true;
    c.enablePan = FINE_POINTER;
    c.enableZoom = false; // turned on only after the visitor clicks into the view, so page scrolling isn't hijacked
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.autoRotate = !REDUCED_MOTION;
    c.autoRotateSpeed = 0.9; // with update(dt): 0.9 → one turn every ~67 s
    this.controls = c;
    const canvas = this.renderer.domElement;
    canvas.style.touchAction = 'pan-y';
    c.addEventListener('start', () => {
      c.autoRotate = false;
      this.hideHint();
      this.cancelCameraTween();
    });
    c.addEventListener('change', () => { this.needsRender = true; });

    // Zoom rules: wheel zooms once the visitor has clicked into the view, or with Ctrl/⌘ held (also trackpad pinch).
    this.engaged = false;
    canvas.addEventListener('pointerdown', () => { this.engaged = true; c.enableZoom = true; });
    this.stage.addEventListener('pointerleave', () => { if (!this.expanded) { this.engaged = false; c.enableZoom = false; } });
    this.stage.addEventListener('wheel', (e) => {
      if (this.expanded || this.engaged) { c.enableZoom = true; return; }
      if (e.ctrlKey || e.metaKey) { c.enableZoom = true; return; }
      c.enableZoom = false;
      this.flashHint(FINE_POINTER ? 'Click the model first, or hold Ctrl while scrolling, to zoom.' : 'Pinch to zoom.');
    }, { capture: true, passive: true });

    // Picking
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const pick = (e) => {
      if (!this.meshes.length) return null;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObjects(this.meshes, false)[0];
      return hit ? hit.object : null;
    };
    canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || !this.parts.size) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 500;
      down = null;
      if (moved > 6 || !quick) return;
      const mesh = pick(e);
      if (!mesh) { this.select(null); return; }
      const id = this.meshPart.get(mesh);
      if (id) this.select(id, this.findPickNode(mesh, id), true);
    });
    if (FINE_POINTER) {
      let last = 0, pending = null;
      canvas.addEventListener('pointermove', (e) => {
        if (!this.parts.size || e.buttons) { this.setHover(null); return; }
        pending = e;
        const now = performance.now();
        if (now - last < 90) return;
        last = now;
        const mesh = pick(pending);
        const id = mesh ? this.meshPart.get(mesh) : null;
        this.setHover(id, pending, mesh);
      });
      canvas.addEventListener('pointerleave', () => this.setHover(null));
    }
  }

  // ---------- model ----------
  async loadModel(index) {
    const entry = this.cfg.models[index];
    this.modelIndex = index;
    const gltf = await new Promise((resolve, reject) => {
      getLoader().load(entry.url, resolve, (ev) => {
        if (this.loadBar && ev.total) this.loadBar.style.width = `${Math.round((ev.loaded / ev.total) * 100)}%`;
      }, reject);
    });
    if (this.wrapper) {
      this.wrapper.removeFromParent();
      this.disposeTree(this.wrapper);
    }
    const root = gltf.scene;
    const wrapper = new THREE.Group();
    if ((entry.up || this.cfg.up) === 'z') wrapper.rotation.x = -Math.PI / 2;
    wrapper.add(root);
    if (this.ambient) {
      if (!this.ambientPivot) { this.ambientPivot = new THREE.Group(); this.scene.add(this.ambientPivot); }
      this.ambientPivot.add(wrapper);
    } else {
      this.scene.add(wrapper);
    }
    wrapper.updateMatrixWorld(true);
    this.wrapper = wrapper;
    this.root = root;

    // Center the model on the origin (in world space) so orbiting feels natural.
    const box = new THREE.Box3().setFromObject(wrapper);
    const center = box.getCenter(new THREE.Vector3());
    wrapper.position.sub(center);
    wrapper.updateMatrixWorld(true);

    // Bodies the config asks to hide (e.g. duplicate placeholder bodies inside purchased parts)
    const hiddenNames = entry.hidden || this.cfg.hidden || [];
    root.traverse((o) => { if (o.userData && hiddenNames.includes(o.userData.name)) o.visible = false; });
    const isHidden = (o) => { while (o) { if (!o.visible) return true; o = o.parent; } return false; };

    // See-through reference bodies (e.g. a rough outline of a car around a test jig): never picked, no edges
    const ghostNames = entry.ghosts || this.cfg.ghosts || [];
    const isGhost = (o) => { while (o) { if (o.userData && ghostNames.includes(o.userData.name)) return true; o = o.parent; } return false; };

    this.meshes = [];
    this.ghostMeshes = [];
    this.meshPart.clear();
    root.traverse((o) => {
      if (o.isMesh && !isHidden(o)) {
        o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (ghostNames.length && isGhost(o)) {
          mats.forEach((m) => { m.transparent = true; m.depthWrite = false; });
          o.renderOrder = 1;
          o.raycast = () => {};
          this.ghostMeshes.push(o);
          return;
        }
        mats.forEach((m) => { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1; if (m.emissive) m.userData.baseEmissive = m.emissive.clone(); });
        this.meshes.push(o);
      }
    });

    // Rest transforms in the model's own (root) space
    this.rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    this.rest = new Map();
    root.traverse((o) => this.rest.set(o, new THREE.Matrix4().multiplyMatrices(this.rootInv, o.matrixWorld)));
    this.kinDelta = new Map();
    this.expDelta = new Map();
    this.touched = new Set();

    if (entry.parts !== false && this.cfg.parts) this.setupParts();
    if (this.cfg.kinematics) this.cfg.kinematics.setup(this.api());
    if (this.cfg.explode) this.setupExplode();
    if (this.cfg.edges) await this.buildEdges(true);
    if (this.cfg.kinematics) this.applyTravel(this.anim.travel);

    // Frame the camera
    this.updateBounds();
    this.frame(entry.orbit || this.cfg.orbit || { theta: 35, phi: 70 }, false);
    this.needsRender = true;
  }

  disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }

  updateBounds() {
    this.wrapper.updateMatrixWorld(true);
    const box = new THREE.Box3();
    this.meshes.forEach((m) => box.expandByObject(m));
    (this.ghostMeshes || []).forEach((m) => box.expandByObject(m));
    this.bounds = box;
    this.sphere = box.getBoundingSphere(new THREE.Sphere());
  }

  findAll(name) {
    const out = [];
    this.root.traverse((o) => { if (o.userData && o.userData.name === name) out.push(o); });
    return out;
  }

  // Top-most nodes whose CAD name starts with one of the prefixes
  findByPrefix(prefixes) {
    const match = (o) => o && o.userData && typeof o.userData.name === 'string' && prefixes.some((p) => o.userData.name.startsWith(p));
    const out = [];
    this.root.traverse((o) => {
      if (!match(o)) return;
      let a = o.parent;
      while (a && a !== this.root) { if (match(a)) return; a = a.parent; }
      out.push(o);
    });
    return out;
  }

  api() {
    return {
      THREE,
      find: (n) => this.findAll(n)[0] || null,
      findAll: (n) => this.findAll(n),
      findPrefix: (p) => this.findByPrefix([p]),
      setKin: (node, m) => { this.kinDelta.set(node, m); this.touched.add(node); },
      viewer: this,
    };
  }

  // Compose explode (translation) and kinematic deltas, both expressed in the model's root space.
  commitTransforms() {
    const affected = this.touched;
    this.rootInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const depth = (o) => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };
    const list = [...affected].sort((a, b) => depth(a) - depth(b));
    const W = new THREE.Matrix4(), P = new THREE.Matrix4(), E = new THREE.Matrix4(), K = new THREE.Matrix4();
    for (const node of list) {
      // explode: own + ancestors (translations add up)
      const t = new THREE.Vector3();
      let a = node;
      while (a && a !== this.root) { const d = this.expDelta.get(a); if (d) t.add(d); a = a.parent; }
      E.makeTranslation(t.x, t.y, t.z);
      // kinematics: own, otherwise the nearest ancestor's
      a = node; let k = null;
      while (a && a !== this.root && !k) { k = this.kinDelta.get(a) || null; a = a.parent; }
      if (k) K.copy(k); else K.identity();
      W.multiplyMatrices(E, K).multiply(this.rest.get(node));
      // parent's current transform in root space
      P.multiplyMatrices(this.rootInv, node.parent.matrixWorld).invert();
      W.premultiply(P);
      W.decompose(node.position, node.quaternion, node.scale);
      node.updateMatrixWorld(true);
    }
    this.needsRender = true;
    if (this.balloonsOn) this.updateBalloons();
  }

  // ---------- parts / selection ----------
  setupParts() {
    this.parts.clear();
    for (const def of this.cfg.parts) {
      let nodes = [];
      (def.nodes || []).forEach((n) => nodes.push(...this.findAll(n)));
      if (def.prefixes) nodes.push(...this.findByPrefix(def.prefixes));
      nodes = [...new Set(nodes)];
      const meshes = [];
      nodes.forEach((n) => n.traverse((o) => { if (o.isMesh) { meshes.push(o); this.meshPart.set(o, def.id); } }));
      this.parts.set(def.id, { def, nodes, meshes });
    }
  }

  findPickNode(mesh, id) {
    const part = this.parts.get(id);
    if (!part || !part.def.pickSingle) return null;
    let o = mesh;
    while (o && !part.nodes.includes(o)) o = o.parent;
    return o || null;
  }

  tintMeshes(meshes, color, strength) {
    meshes.forEach((m) => {
      (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
        if (!mat.emissive) return;
        if (color) { mat.emissive.copy(color).multiplyScalar(strength); }
        else if (mat.userData.baseEmissive) mat.emissive.copy(mat.userData.baseEmissive);
      });
      m.children.forEach((c) => { if (c.isLineSegments) c.material = color ? this.edgeMatSel : this.edgeMat; });
    });
    this.needsRender = true;
  }

  meshesFor(sel) {
    if (!sel) return [];
    if (sel.node) { const out = []; sel.node.traverse((o) => { if (o.isMesh) out.push(o); }); return out; }
    const p = this.parts.get(sel.id);
    return p ? p.meshes : [];
  }

  setHover(id, e, mesh) {
    const same = this.hovered && id === this.hovered.id;
    if (!same) {
      if (this.hovered && (!this.selected || this.hovered.id !== this.selected.id)) {
        this.tintMeshes(this.meshesFor(this.hovered), null);
        if (this.selected) this.tintMeshes(this.meshesFor(this.selected), SELECT_COLOR, 0.55);
      }
      this.hovered = id ? { id } : null;
      if (this.hovered && (!this.selected || id !== this.selected.id)) this.tintMeshes(this.meshesFor(this.hovered), HOVER_COLOR, 0.35);
    }
    if (!this.tip) return;
    if (id && e) {
      const part = this.parts.get(id);
      const node = this.findPickNode(mesh, id);
      this.tip.textContent = (part.def.n ? part.def.n + '  ' : '') + (node && part.def.nodeLabel ? part.def.nodeLabel(node.userData.name) : part.def.name);
      const rect = this.stage.getBoundingClientRect();
      this.tip.style.transform = `translate(${e.clientX - rect.left + 14}px, ${e.clientY - rect.top + 16}px)`;
      this.tip.hidden = false;
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.tip.hidden = true;
      this.renderer.domElement.style.cursor = '';
    }
  }

  select(id, node = null, fromCanvas = false) {
    if (this.selected) this.tintMeshes(this.meshesFor(this.selected), null);
    this.selected = id ? { id, node } : null;
    if (this.selected) this.tintMeshes(this.meshesFor(this.selected), SELECT_COLOR, 0.55);
    document.querySelectorAll('[data-select-part]').forEach((b) => {
      b.setAttribute('aria-pressed', String(!!id && b.dataset.selectPart === id));
    });
    this.renderCard(node);
    this.el.dispatchEvent(new CustomEvent('viewer:select', { bubbles: true, detail: { id } }));
    this.needsRender = true;
    if (fromCanvas) this.hideHint();
  }

  renderCard(node) {
    if (!this.card) return;
    if (!this.selected) { this.card.hidden = true; return; }
    const { def } = this.parts.get(this.selected.id);
    const spec = node && def.nodeLabel ? def.nodeLabel(node.userData.name) : def.spec;
    this.card.innerHTML = `
      <div class="vp-card-head">${def.n ? `<span class="balloon-num" aria-hidden="true">${def.n}</span>` : `<span class="balloon-num is-plain" aria-hidden="true">${icon('part')}</span>`}
        <div><p class="vp-card-title">${escapeHtml(def.name)}</p>${spec ? `<p class="vp-card-spec">${escapeHtml(spec)}</p>` : ''}</div>
        <button type="button" class="vp-card-close" aria-label="Clear selection">${icon('close')}</button></div>
      ${def.why ? `<p class="vp-card-why">${escapeHtml(def.why)}</p>` : ''}`;
    this.card.hidden = false;
    this.card.querySelector('.vp-card-close').addEventListener('click', () => this.select(null));
  }

  // ---------- edges ----------
  async buildEdges(on) {
    this.edgeMat = this.edgeMat || new THREE.LineBasicMaterial({ color: EDGE_COLOR });
    this.edgeMatSel = this.edgeMatSel || new THREE.LineBasicMaterial({ color: 0x0b4ea2 });
    if (!this.edgesBuilt) {
      const cache = new Map();
      let budget = performance.now();
      for (const m of this.meshes) {
        let eg = cache.get(m.geometry.uuid);
        if (!eg) { eg = new THREE.EdgesGeometry(m.geometry, this.cfg.edgeAngle || 35); cache.set(m.geometry.uuid, eg); }
        const line = new THREE.LineSegments(eg, this.edgeMat);
        line.raycast = () => {};
        line.userData.isEdge = true;
        m.add(line);
        if (performance.now() - budget > 30) { await new Promise((r) => setTimeout(r, 0)); budget = performance.now(); }
      }
      this.edgesBuilt = true;
    }
    this.meshes.forEach((m) => m.children.forEach((c) => { if (c.isLineSegments) c.visible = on; }));
    this.needsRender = true;
  }

  // ---------- explode ----------
  setupExplode() {
    this.explodeGroups = [];
    for (const g of this.cfg.explode) {
      const nodes = [];
      (g.nodes || []).forEach((n) => nodes.push(...this.findAll(n)));
      if (g.prefixes) nodes.push(...this.findByPrefix(g.prefixes));
      const v = new THREE.Vector3(...g.offset).multiplyScalar(this.cfg.unitScale || 1);
      nodes.forEach((n) => this.explodeGroups.push({ node: n, v }));
    }
  }

  setExplode(k) {
    this.anim.explode = k;
    this.explodeGroups.forEach(({ node, v }) => {
      if (k <= 0) this.expDelta.delete(node);
      else { this.expDelta.set(node, v.clone().multiplyScalar(k)); this.touched.add(node); }
    });
    this.commitTransforms();
  }

  toggleExplode(on) {
    const btn = this.hud.querySelector('[data-act="explode"]');
    btn.setAttribute('aria-pressed', String(on));
    this.exploded = on;
    if (on && this.anim.travel > 0) this.animateTravel(0, 500);
    const from = this.anim.explode, to = on ? 1 : 0;
    this.tween(REDUCED_MOTION ? 1 : 900, (t) => this.setExplode(from + (to - from) * easeInOut(t)), () => {
      if (on) this.fitToContent(true);
    });
    if (this.motion) this.motion.root.classList.toggle('is-disabled', on);
  }

  fitToContent(animate) {
    this.updateBounds();
    const ctl = this.controls;
    const dir = this.camera.position.clone().sub(ctl.target).normalize();
    const dist = this.fitDistance(dir);
    const cur = this.camera.position.distanceTo(ctl.target);
    if (dist > cur * 1.02) this.tweenCamera(this.bounds.getCenter(new THREE.Vector3()), dir.multiplyScalar(dist), animate ? 700 : 0);
  }

  // ---------- kinematics / motion study ----------
  applyTravel(travel) {
    this.anim.travel = travel;
    if (this.cfg.kinematics) {
      this.cfg.kinematics.update(travel, this.api());
      this.commitTransforms();
    }
    if (this.motion) this.updateMotionUi();
  }

  animateTravel(to, ms = 900, done) {
    const from = this.anim.travel;
    if (Math.abs(to - from) < 0.01) { this.applyTravel(to); if (done) done(); return; }
    this.tween(REDUCED_MOTION ? 1 : ms, (t) => this.applyTravel(from + (to - from) * easeInOut(t)), done, 'travel');
  }

  buildMotion() {
    const m = this.cfg.motion;
    const max = m.max;
    const ticks = m.positions.map((p) => `
      <button type="button" class="mt-stop" data-pos="${p.n}" style="left:${(p.travel / max) * 100}%">
        <span class="mt-stop-n">${p.n}</span><span class="mt-stop-label">${escapeHtml(p.label)}</span></button>`).join('');
    const html = `
      <div class="motion" role="group" aria-label="Pedal travel">
        <div class="mt-row">
          <button type="button" class="mt-play" aria-label="Play pedal stroke">${icon('play')}<span>Play</span></button>
          <div class="mt-track">
            <input type="range" class="mt-range" min="0" max="${max}" step="0.1" value="0" aria-label="Pedal travel in degrees">
            <div class="mt-stops">${ticks}</div>
          </div>
          <p class="mt-read"><span class="mt-travel">0.0°</span> <span class="mt-read-label">of travel</span></p>
        </div>
        <div class="mt-status">
          <p class="mt-state" aria-live="polite"></p>
          <dl class="mt-gauges">
            <div><dt>Pedal angle</dt><dd class="mt-angle"></dd></div>
            <div><dt>Master cylinders</dt><dd><span class="mt-gauge" title="Share of the 1.1 in master cylinder stroke"><span></span></span></dd></div>
            <div><dt>Shutdown circuit</dt><dd class="mt-bots"></dd></div>
          </dl>
        </div>
      </div>`;
    this.el.insertAdjacentHTML('beforeend', html);
    const root = this.el.querySelector('.motion');
    this.motion = {
      root,
      range: root.querySelector('.mt-range'),
      play: root.querySelector('.mt-play'),
      travel: root.querySelector('.mt-travel'),
      angle: root.querySelector('.mt-angle'),
      gauge: root.querySelector('.mt-gauge span'),
      bots: root.querySelector('.mt-bots'),
      state: root.querySelector('.mt-state'),
      stops: [...root.querySelectorAll('.mt-stop')],
    };
    const mo = this.motion;
    mo.range.addEventListener('input', () => {
      this.stopPlay();
      if (this.exploded) this.toggleExplode(false);
      this.cancelTween('travel');
      this.applyTravel(parseFloat(mo.range.value));
    });
    // Keyboard: arrows move 1° (Shift: 5°), Page Up/Down jump between the numbered positions
    mo.range.addEventListener('keydown', (e) => {
      const stops = this.cfg.motion.positions.map((p) => p.travel);
      const t = this.anim.travel;
      let to = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = t + (e.shiftKey ? 5 : 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = t - (e.shiftKey ? 5 : 1);
      else if (e.key === 'PageUp') to = stops.find((s) => s > t + 0.05) ?? m.max;
      else if (e.key === 'PageDown') to = [...stops].reverse().find((s) => s < t - 0.05) ?? 0;
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = m.max;
      if (to === null) return;
      e.preventDefault();
      this.stopPlay();
      if (this.exploded) this.toggleExplode(false);
      this.cancelTween('travel');
      this.applyTravel(clamp(Math.round(to * 10) / 10, 0, m.max));
    });
    mo.stops.forEach((b) => b.addEventListener('click', () => this.gotoPosition(parseInt(b.dataset.pos, 10))));
    mo.play.addEventListener('click', () => (this.playing ? this.stopPlay() : this.play()));
    this.updateMotionUi();
  }

  gotoPosition(n, scroll = false) {
    const p = this.cfg.motion.positions.find((x) => x.n === n);
    if (!p) return;
    this.stopPlay();
    if (this.exploded) this.toggleExplode(false);
    if (scroll) this.scrollIntoViewIfNeeded();
    this.animateTravel(p.travel, 700 + Math.abs(p.travel - this.anim.travel) * 25);
  }

  play() {
    if (this.exploded) this.toggleExplode(false);
    this.playing = true;
    this.motion.play.setAttribute('aria-label', 'Pause pedal stroke');
    this.motion.play.innerHTML = `${icon('pause')}<span>Pause</span>`;
    const stops = this.cfg.motion.positions.map((p) => p.travel);
    const seq = [...stops.slice(1), 0];
    let i = seq.findIndex((s) => s > this.anim.travel + 0.05);
    if (i < 0) i = seq.length - 1;
    const step = () => {
      if (!this.playing) return;
      const to = seq[i];
      const ms = Math.max(500, Math.abs(to - this.anim.travel) * (to === 0 ? 45 : 70));
      this.animateTravel(to, ms, () => {
        if (!this.playing) return;
        if (to === 0) { this.stopPlay(); return; }
        i++;
        this.playTimer = setTimeout(step, 650);
      });
    };
    step();
  }

  stopPlay() {
    if (!this.motion) return;
    this.playing = false;
    clearTimeout(this.playTimer);
    this.motion.play.setAttribute('aria-label', 'Play pedal stroke');
    this.motion.play.innerHTML = `${icon('play')}<span>Play</span>`;
  }

  updateMotionUi() {
    const mo = this.motion, m = this.cfg.motion, t = this.anim.travel;
    if (document.activeElement !== mo.range || !mo.range.matches(':active')) mo.range.value = t.toFixed(1);
    mo.range.style.setProperty('--fill', `${(t / m.max) * 100}%`);
    mo.travel.textContent = `${t.toFixed(1)}°`;
    const info = m.describe(t);
    mo.angle.textContent = info.angle;
    mo.gauge.style.width = `${clamp(info.stroke, 0, 1) * 100}%`;
    mo.bots.textContent = info.bots ? 'Open (tripped)' : 'Closed';
    mo.bots.classList.toggle('is-open', !!info.bots);
    if (mo.lastState !== info.state) { mo.state.innerHTML = info.state; mo.lastState = info.state; }
    mo.range.setAttribute('aria-valuetext', `${t.toFixed(1)} degrees. ${info.short}`);
    mo.stops.forEach((b) => {
      const p = m.positions.find((x) => x.n === parseInt(b.dataset.pos, 10));
      b.classList.toggle('is-reached', t >= p.travel - 0.05);
      b.classList.toggle('is-current', Math.abs(t - p.travel) < 0.06);
    });
  }

  // ---------- balloons ----------
  setupBalloons() {
    if (this.balloonEls) return;
    this.balloonEls = [];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'vp-leaders');
    this.balloonLayer.append(svg);
    this.leaderSvg = svg;
    for (const b of this.cfg.balloons) {
      const part = this.parts.get(b.part);
      if (!part) continue;
      const host = this.findAll(b.node)[0] || part.nodes[0];
      const anchor = new THREE.Object3D();
      // anchor given in the model's root space (metres) → convert to the host's local space
      const p = new THREE.Vector3(...b.at).multiplyScalar(this.cfg.unitScale || 1);
      const hostRest = this.rest.get(host);
      anchor.position.copy(p.applyMatrix4(new THREE.Matrix4().copy(hostRest).invert()));
      host.add(anchor);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'balloon';
      btn.textContent = part.def.n;
      btn.setAttribute('aria-label', `${part.def.n}: ${part.def.name}`);
      btn.addEventListener('click', () => this.select(b.part));
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svg.append(line);
      this.balloonLayer.append(btn);
      this.balloonEls.push({ anchor, btn, line, dir: b.dir || null });
    }
  }

  toggleBalloons(on) {
    this.balloonsOn = on;
    this.hud.querySelector('[data-act="labels"]').setAttribute('aria-pressed', String(on));
    if (on) this.setupBalloons();
    this.balloonLayer.classList.toggle('is-on', on);
    if (on) this.updateBalloons();
  }

  updateBalloons() {
    if (!this.balloonEls) return;
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    const center = this.sphere.center.clone().project(this.camera);
    const cx = (center.x * 0.5 + 0.5) * w, cy = (-center.y * 0.5 + 0.5) * h;
    const v = new THREE.Vector3();
    const reach = Math.max(46, Math.min(w, h) * 0.12);
    for (const b of this.balloonEls) {
      b.anchor.getWorldPosition(v);
      v.project(this.camera);
      const ax = (v.x * 0.5 + 0.5) * w, ay = (-v.y * 0.5 + 0.5) * h;
      let dx = ax - cx, dy = ay - cy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const bx = clamp(ax + dx * reach, 18, w - 18), by = clamp(ay + dy * reach, 18, h - 18);
      b.btn.style.transform = `translate(${bx - 14}px, ${by - 14}px)`;
      b.line.setAttribute('x1', ax); b.line.setAttribute('y1', ay);
      b.line.setAttribute('x2', bx); b.line.setAttribute('y2', by);
    }
  }

  // ---------- camera ----------
  // Distance at which the model's bounding box fits the view from a given direction
  fitDistance(dir) {
    const cam = this.camera;
    const tanV = Math.tan(deg(cam.fov) / 2), tanH = tanV * cam.aspect;
    const fwd = dir.clone().normalize().negate();               // camera looks along -dir
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const c = this.bounds.getCenter(new THREE.Vector3());
    const b = this.bounds;
    let d = 0;
    const margin = this.ambient ? (this.cfg.ambientScale || 0.6) : (this.cfg.fitMargin || 0.98);
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(c);
      const x = Math.abs(p.dot(right)) * margin, y = Math.abs(p.dot(up)) * margin, z = p.dot(fwd);
      d = Math.max(d, -z + x / tanH, -z + y / tanV);
    }
    return Math.max(d, this.sphere.radius * 0.5);
  }

  frame(orbit, animate) {
    const dir = orbitToOffset(orbit.theta, orbit.phi, 1);
    const offset = dir.clone().multiplyScalar(this.fitDistance(dir));
    const target = this.bounds.getCenter(new THREE.Vector3());
    if (this.ambient && this.cfg.ambientOffset) target.add(new THREE.Vector3(...this.cfg.ambientOffset).multiplyScalar(this.sphere.radius));
    if (this.controls) {
      this.controls.minDistance = this.sphere.radius * 0.35;
      this.controls.maxDistance = this.sphere.radius * 8;
    }
    this.camera.near = this.sphere.radius / 100;
    this.camera.far = this.sphere.radius * 60;
    this.camera.updateProjectionMatrix();
    this.tweenCamera(target, offset, animate ? 650 : 0);
  }

  tweenCamera(target, offset, ms) {
    const ctl = this.controls;
    const fromT = (ctl ? ctl.target : this.target).clone();
    const fromO = this.camera.position.clone().sub(fromT);
    const toLen = offset.length(), fromLen = fromO.length() || toLen;
    const fromDir = fromO.clone().normalize(), toDir = offset.clone().normalize();
    const apply = (t) => {
      const e = easeInOut(t);
      const tg = fromT.clone().lerp(target, e);
      let dir = fromDir.clone().lerp(toDir, e);
      if (dir.lengthSq() < 1e-6) dir = toDir.clone();
      dir.normalize().multiplyScalar(fromLen + (toLen - fromLen) * e);
      if (ctl) ctl.target.copy(tg); else this.target.copy(tg);
      this.camera.position.copy(tg).add(dir);
      this.camera.lookAt(tg);
      if (ctl) ctl.update();
      this.needsRender = true;
    };
    this.cancelCameraTween();
    if (!ms || REDUCED_MOTION) { apply(1); return; }
    this.camTween = this.tween(ms, apply, null, 'camera');
  }

  cancelCameraTween() { this.cancelTween('camera'); }

  resetView() {
    if (this.controls) this.controls.autoRotate = false;
    if (this.exploded) this.toggleExplode(false);
    this.select(null);
    const entry = this.cfg.models[this.modelIndex];
    this.updateBounds();
    this.frame(entry.orbit || this.cfg.orbit, true);
  }

  // ---------- HUD ----------
  bindHud() {
    const hud = this.hud;
    hud.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !this.wrapper) return;
      const act = b.dataset.act;
      if (act === 'reset') this.resetView();
      else if (act === 'views') this.toggleMenu(b);
      else if (act === 'edges') { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); this.buildEdges(on); }
      else if (act === 'explode') this.toggleExplode(b.getAttribute('aria-pressed') !== 'true');
      else if (act === 'labels') this.toggleBalloons(b.getAttribute('aria-pressed') !== 'true');
      else if (act === 'expand') this.toggleExpand(b.getAttribute('aria-pressed') !== 'true');
      else if (b.dataset.view !== undefined) {
        const v = this.cfg.views[parseInt(b.dataset.view, 10)];
        this.closeMenu();
        if (this.controls) this.controls.autoRotate = false;
        this.frame(v, true);
      } else if (b.dataset.model !== undefined) {
        const i = parseInt(b.dataset.model, 10);
        if (i === this.modelIndex) return;
        hud.querySelectorAll('[data-model]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        this.el.classList.add('is-loading');
        if (this.loadBar) this.loadBar.style.width = '0%';
        this.loadModel(i).then(() => { this.el.classList.remove('is-loading'); this.kick(); })
          .catch(() => { this.el.classList.remove('is-loading'); this.flashHint('That model could not be loaded.'); });
      }
    });
    hud.addEventListener('keydown', (e) => {
      const list = hud.querySelector('.vp-menu-list');
      if (!list || list.hidden) return;
      const items = [...list.querySelectorAll('[role="menuitem"]')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.closeMenu(true); }
      else if (e.key === 'Tab') this.closeMenu();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.vp-menu')) this.closeMenu(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.expanded && !document.querySelector('.lightbox.open')) this.toggleExpand(false);
    });
  }

  toggleMenu(btn) {
    const list = btn.parentElement.querySelector('.vp-menu-list');
    const open = list.hidden;
    list.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) list.querySelector('[role="menuitem"]').focus();
  }

  closeMenu(focusButton) {
    const list = this.hud && this.hud.querySelector('.vp-menu-list');
    if (!list || list.hidden) return;
    list.hidden = true;
    const btn = this.hud.querySelector('[data-act="views"]');
    btn.setAttribute('aria-expanded', 'false');
    if (focusButton) btn.focus();
  }

  toggleExpand(on) {
    this.expanded = on;
    const btn = this.hud.querySelector('[data-act="expand"]');
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('span').textContent = on ? 'Exit full screen' : 'Full screen';
    btn.querySelector('use').setAttribute('href', on ? '#i-collapse' : '#i-expand');
    btn.title = on ? 'Exit full screen' : 'Full screen';
    this.el.classList.toggle('is-expanded', on);
    document.body.classList.toggle('has-expanded-viewer', on);
    this.renderer.domElement.style.touchAction = on ? 'none' : 'pan-y';
    if (this.controls) { this.controls.enableZoom = on; this.engaged = on; }
    requestAnimationFrame(() => { this.resize(); this.needsRender = true; });
  }

  scrollIntoViewIfNeeded() {
    const r = this.el.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--titlebar-h')) || 0;
    if (r.top < top || r.bottom > window.innerHeight) {
      this.el.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
    }
  }

  // ---------- hints ----------
  showHint() {
    const msg = FINE_POINTER
      ? (this.parts.size ? 'Drag to rotate. Click a part to see what it does.' : 'Drag to rotate. Right-drag to pan.')
      : (this.parts.size ? 'Swipe sideways to rotate. Tap a part to see what it does.' : 'Swipe sideways to rotate. Pinch to zoom.');
    this.flashHint(msg, 6000);
  }

  flashHint(msg, ms = 2600) {
    if (!this.hint) return;
    this.hint.textContent = msg;
    this.hint.classList.add('is-on');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hideHint(), ms);
  }

  hideHint() { if (this.hint) this.hint.classList.remove('is-on'); }

  // ---------- loop ----------
  tween(ms, fn, done, tag) {
    if (tag) this.cancelTween(tag);
    const tw = { start: performance.now(), ms: Math.max(1, ms), fn, done, tag };
    this.tweens.push(tw);
    this.kick();
    return tw;
  }

  cancelTween(tag) { this.tweens = this.tweens.filter((t) => t.tag !== tag); }

  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h || !this.renderer) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.sphere && this.ambient) this.frame(this.cfg.orbit, false);
  }

  kick() {
    if (this.raf || !this.renderer) return;
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  tick(now) {
    this.raf = null;
    if (!this.visible || document.hidden) return;
    let active = false;
    if (this.tweens.length) {
      const list = this.tweens.slice();
      for (const tw of list) {
        const t = Math.min(1, (now - tw.start) / tw.ms);
        tw.fn(t);
        if (t >= 1) {
          this.tweens = this.tweens.filter((x) => x !== tw);
          if (tw.done) tw.done();
        }
      }
      active = true;
    }
    const dtSec = this.lastTick ? Math.min(0.1, (now - this.lastTick) / 1000) : 1 / 60;
    if (this.controls) {
      if (this.controls.update(dtSec)) this.needsRender = true;
      if (this.controls.autoRotate || this.controls.enableDamping) active = true;
    } else if (this.ambientPivot && this.wrapper && !REDUCED_MOTION) {
      this.ambientPivot.rotation.y += Math.min(dtSec, 0.05) * deg(this.cfg.ambientSpeed || 7);
      this.needsRender = true;
      active = true;
    }
    this.lastTick = now;
    if (this.needsRender && this.wrapper) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
      this.updateTriad();
      if (this.balloonsOn) this.updateBalloons();
    }
    if (active || this.needsRender) this.kick();
  }

  updateTriad() {
    if (!this.triad) return;
    const q = this.camera.quaternion.clone().invert();
    const axes = [['x', new THREE.Vector3(1, 0, 0)], ['y', new THREE.Vector3(0, 1, 0)], ['z', new THREE.Vector3(0, 0, 1)]];
    if (this.ambientPivot) axes.forEach(([, v]) => v.applyQuaternion(this.ambientPivot.quaternion));
    const items = axes.map(([k, v]) => { const s = v.clone().applyQuaternion(q); return { k, x: s.x * 24, y: -s.y * 24, z: s.z }; });
    items.sort((a, b) => a.z - b.z);
    items.forEach((it) => {
      const g = this.triad.querySelector('.ax-' + it.k);
      const line = g.querySelector('line'), text = g.querySelector('text');
      line.setAttribute('x2', it.x.toFixed(2)); line.setAttribute('y2', it.y.toFixed(2));
      text.setAttribute('x', (it.x * 1.34).toFixed(2)); text.setAttribute('y', (it.y * 1.34 + 3.5).toFixed(2));
      this.triad.append(g);
    });
  }
}

// Boot every viewport on the page
const boot = () => {
  document.querySelectorAll('[data-viewer]').forEach(async (el) => {
    if (el.dataset.viewerBooted) return;
    el.dataset.viewerBooted = '1';
    if (el.dataset.mode === 'ambient') {
      const wide = window.matchMedia('(min-width: 900px)').matches;
      const saveData = navigator.connection && navigator.connection.saveData;
      if (!wide || saveData) return;
    }
    try {
      const mod = await import(`./models/${el.dataset.viewer}.js`);
      const v = new Viewer(el, mod.default);
      el.viewer = v;
      await v.init();
    } catch (err) {
      console.error(err);
      el.classList.add('is-failed');
    }
  });
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// Buttons elsewhere on the page that drive the viewer (feature tree, tables)
document.addEventListener('click', (e) => {
  const sel = e.target.closest('[data-select-part]');
  const pos = e.target.closest('[data-goto-position]');
  if (!sel && !pos) return;
  const el = document.querySelector('[data-viewer]:not([data-mode="ambient"])');
  const v = el && el.viewer;
  if (!v || !v.wrapper) return;
  e.preventDefault();
  if (sel) {
    const id = sel.dataset.selectPart;
    const same = v.selected && v.selected.id === id && !v.selected.node;
    v.scrollIntoViewIfNeeded();
    v.select(same ? null : id);
    if (v.controls) v.controls.autoRotate = false;
  } else {
    v.gotoPosition(parseInt(pos.dataset.gotoPosition, 10), true);
  }
});
