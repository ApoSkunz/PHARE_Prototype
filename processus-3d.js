import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';

/* Vue spatiale dérivée exclusivement de PHARE_DATA. */
const D = window.PHARE_DATA;
const host = document.getElementById('scene3d');
const button2d = document.getElementById('view-2d');
const button3d = document.getElementById('view-3d');
const buttonReset = document.getElementById('view-reset');
const tooltip = document.getElementById('scene3d-tooltip');
const canvas2d = document.getElementById('canvas');
const inspector = document.getElementById('scene3d-inspector');
const inspectorClose = document.getElementById('scene3d-close');
const inspectorKind = document.getElementById('scene3d-kind');
const inspectorTitle = document.getElementById('scene3d-title');
const inspectorSub = document.getElementById('scene3d-sub');
const inspectorLinks = document.getElementById('scene3d-links');
const inspectorConnections = document.getElementById('scene3d-connection-list');
const inspectorExplode = document.getElementById('scene3d-explode');

if (!D || !host || !button2d || !button3d || !canvas2d) throw new Error('Vue processus 3D : éléments introuvables.');

if (!window.WebGLRenderingContext) {
  button3d.disabled = true;
  button3d.title = 'WebGL est indisponible sur ce navigateur.';
} else {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f7f9fd');
  scene.fog = new THREE.Fog('#f7f9fd', 22, 54);

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
  const defaultCamera = new THREE.Vector3(0, 1.5, 22);
  camera.position.copy(defaultCamera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Scène 3D du processus. Échap rétablit la vue globale.');

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 10;
  controls.maxDistance = 37;
  controls.minPolarAngle = .05;
  controls.maxPolarAngle = Math.PI - .05;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight('#b8d5ff', '#192234', 1.9));
  const key = new THREE.DirectionalLight('#f2f7ff', 3.8);
  key.position.set(-8, 17, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  scene.add(key);
  const rim = new THREE.PointLight('#508dff', 14, 26, 2);
  rim.position.set(10, 7, -8);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 27),
    new THREE.MeshStandardMaterial({ color: '#15243a', roughness: 0.77, metalness: 0.23 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -7;
  floor.receiveShadow = true;
  floor.visible = false;
  scene.add(floor);
  const grid = new THREE.GridHelper(40, 40, '#29425f', '#1c3049');
  grid.position.y = -6.988;
  grid.material.transparent = true;
  grid.material.opacity = 0.47;
  grid.visible = false;
  scene.add(grid);

  const palette = {
    human: '#fff4e6', system: '#f3f0ff', guard: '#fff0f0', external: '#e6fcf5',
    data: '#e7f5ff', transverse: '#f1f3f5', container: '#edf2f7'
  };
  const accents = {
    human: '#d9480f', system: '#5f3dc4', guard: '#c92a2a', external: '#0b7285',
    data: '#1864ab', transverse: '#495057', container: '#8f9bb0'
  };
  const nodes = new Map();
  const pipes = new Map();
  const rayTargets = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(2, 2);
  const clock = new THREE.Clock();
  let active = window.PHARE_PROCESS_STATE || { activeNodes: {}, activeEdges: [], idle: true };
  let hovered = null;
  let selectedId = null;
  let explodedId = null;
  let virtualParts = [];
  let is3d = false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const decompositions = {
    orch: [
      { label: 'Machine à états', detail: 'enchaîne les étapes', color: '#f3f0ff', text: '#5f3dc4' },
      { label: 'Gestionnaire de budgets', detail: 'coûts et plafonds', color: '#fff4e6', text: '#a85100' },
      { label: 'Rejeu contrôlé', detail: 'trace et reprise', color: '#e6fcf5', text: '#087484' },
      { label: 'Journal de décisions', detail: 'preuves versionnées', color: '#e7f5ff', text: '#1864ab' }
    ]
  };

  function parentContainerFor(n) {
    if (n.kind === 'container') return null;
    return D.nodes.find((candidate) => candidate.kind === 'container' && n.x + n.w / 2 > candidate.x && n.x + n.w / 2 < candidate.x + candidate.w && n.y + n.h / 2 > candidate.y && n.y + n.h / 2 < candidate.y + candidate.h);
  }

  function worldFor(n, parent = parentContainerFor(n)) {
    const depth = n.kind === 'container' ? -.1 : (parent ? .04 : 0);
    const vertical = (345 - (n.y + n.h / 2)) / 50 - (parent ? .5 : 0);
    return new THREE.Vector3((n.x + n.w / 2 - 685) / 74, vertical, depth);
  }

  function dimensions(n, parent = parentContainerFor(n)) {
    const nominalWidth = Math.max(1.28, n.w / 74);
    // Les cartes internes conservent un retrait régulier dans leur cadre de groupe.
    const availableWidth = parent ? Math.max(1.1, parent.w / 74 - .62) : nominalWidth;
    return { x: Math.min(nominalWidth, availableWidth), z: Math.max(.72, n.h / 50) };
  }

  function roundedCardGeometry(width, height, depth, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    const shape = new THREE.Shape();
    shape.moveTo(r, 0);
    shape.lineTo(width - r, 0);
    shape.quadraticCurveTo(width, 0, width, r);
    shape.lineTo(width, height - r);
    shape.quadraticCurveTo(width, height, width - r, height);
    shape.lineTo(r, height);
    shape.quadraticCurveTo(0, height, 0, height - r);
    shape.lineTo(0, r);
    shape.quadraticCurveTo(0, 0, r, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .035, bevelSize: .045, bevelSegments: 3, curveSegments: 8 });
    geometry.translate(-width / 2, -height / 2, -depth / 2);
    return geometry;
  }

  function labelSprite(text, color, width, height) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1800;
    canvas.height = 720;
    const maxWidth = 1700;
    const words = text.split(' ');
    let fontSize = 240;
    let lines = [];
    while (fontSize >= 30) {
      ctx.font = '700 ' + fontSize + 'px system-ui, sans-serif';
      lines = [];
      let line = '';
      words.forEach((word) => {
        const candidate = line ? line + ' ' + word : word;
        if (ctx.measureText(candidate).width > maxWidth && line) { lines.push(line); line = word; } else line = candidate;
      });
      if (line) lines.push(line);
      if (lines.length <= 3 && lines.length * (fontSize * 1.08) <= 610) break;
      fontSize -= 8;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.font = '700 ' + fontSize + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineHeight = fontSize * 1.12;
    const start = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
    lines.forEach((part, index) => ctx.fillText(part, canvas.width / 2, start + index * lineHeight));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide }));
    panel.renderOrder = 7;
    return panel;
  }

  function addNode(n) {
    const parent = parentContainerFor(n);
    const pos = worldFor(n, parent);
    const size = dimensions(n, parent);
    const color = palette[n.kind] || palette.system;
    const accent = accents[n.kind] || accents.system;
    const group = new THREE.Group();
    const isContainer = n.kind === 'container';
    // Les cadres de groupe gardent leur bord supérieur (et donc leur titre),
    // mais n'ajoutent plus une grande marge vide sous leur dernier élément.
    // La garde d'entrée conserve toutefois assez de hauteur pour englober
    // toutes ses règles, y compris la dernière.
    const containerExtra = n.id === 'g_in' ? 1.1 : .6;
    const containerLift = n.id === 'g_in' ? .05 : .3;
    if (isContainer) pos.y += containerLift;
    if (n.id === 'orch') pos.y += .42;
    if (n.id === 'pl' || n.id === 'go') pos.y -= .28;
    group.position.copy(pos);
    const height = isContainer ? size.z + containerExtra : Math.max(.64, Math.min(1.1, n.h / 58));
    const geometry = roundedCardGeometry(size.x, height, isContainer ? .12 : .32, isContainer ? .14 : .11);
    const material = new THREE.MeshStandardMaterial({
      color, roughness: isContainer ? .32 : .4, metalness: isContainer ? .08 : .38,
      transparent: true, opacity: isContainer ? .14 : 1,
      emissive: new THREE.Color(color), emissiveIntensity: isContainer ? .04 : .14
    });
    const body = new THREE.Mesh(geometry, material);
    body.position.y = 0;
    body.castShadow = !isContainer;
    body.receiveShadow = true;
    body.userData.node = n;
    group.add(body);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: isContainer ? .6 : .58 }));
    edge.position.copy(body.position);
    group.add(edge);
    const label = labelSprite(n.label, isContainer ? '#364861' : accent, isContainer ? Math.max(1.1, size.x - .48) : size.x * .98, isContainer ? .98 : Math.max(.6, height * .94));
    label.position.set(0, isContainer ? height / 2 - .55 : 0, isContainer ? .1 : .24);
    group.add(label);
    rayTargets.push(body);
    scene.add(group);
    nodes.set(n.id, { group, body, material, edge, label, origin: pos.clone(), width: size.x, height, baseHeight: height, isContainer });
  }

  D.nodes.forEach(addNode);

  let attachmentSlots = new Map();

  function faceFor(id, toward) {
    const item = nodes.get(id);
    const anchor = item.group.position.clone();
    const inverseRotation = item.group.quaternion.clone().invert();
    const localDirection = toward.clone().sub(anchor).applyQuaternion(inverseRotation);
    return Math.abs(localDirection.x) >= Math.abs(localDirection.y)
      ? (localDirection.x >= 0 ? 'right' : 'left')
      : (localDirection.y >= 0 ? 'top' : 'bottom');
  }

  function prepareAttachmentSlots() {
    const grouped = new Map();
    D.edges.forEach((edgeData) => {
      if (!nodes.has(edgeData.from) || !nodes.has(edgeData.to)) return;
      const from = nodes.get(edgeData.from).group.position;
      const to = nodes.get(edgeData.to).group.position;
      [[edgeData.from, to, 'from'], [edgeData.to, from, 'to']].forEach(([id, toward, endpoint]) => {
        const side = faceFor(id, toward);
        const item = nodes.get(id);
        const localToward = toward.clone().sub(item.group.position).applyQuaternion(item.group.quaternion.clone().invert());
        // Sur une face verticale on suit la hauteur de l'autre carte ;
        // sur une face horizontale, sa position gauche/droite.
        const order = side === 'left' || side === 'right' ? localToward.y : localToward.x;
        const key = `${id}:${side}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push({ edgeId: edgeData.id, endpoint, id, side, order });
      });
    });
    attachmentSlots = new Map();
    grouped.forEach((entries) => {
      entries.sort((a, b) => a.order - b.order || a.edgeId.localeCompare(b.edgeId));
      entries.forEach((entry, index) => {
        attachmentSlots.set(`${entry.edgeId}:${entry.endpoint}`, {
          side: entry.side,
          ratio: (index + 1) / (entries.length + 1)
        });
      });
    });
  }

  function edgeAnchor(id, toward, edgeId, endpoint) {
    const item = nodes.get(id);
    const anchor = item.group.position.clone();
    const slot = attachmentSlots.get(`${edgeId}:${endpoint}`);
    const side = slot ? slot.side : faceFor(id, toward);
    const available = (side === 'left' || side === 'right' ? item.height : item.width) / 2 - .18;
    const offset = slot ? -available + (2 * available * slot.ratio) : 0;
    const localAnchor = side === 'left' ? new THREE.Vector3(-item.width / 2, offset, .28)
      : side === 'right' ? new THREE.Vector3(item.width / 2, offset, .28)
        : side === 'top' ? new THREE.Vector3(offset, item.height / 2, .28)
          : new THREE.Vector3(offset, -item.height / 2, .28);
    return localAnchor.applyQuaternion(item.group.quaternion).add(anchor);
  }
  function tubeCurve(edgeData) {
    const from = nodes.get(edgeData.from).group.position;
    const to = nodes.get(edgeData.to).group.position;
    const a = edgeAnchor(edgeData.from, to, edgeData.id, 'from');
    const b = edgeAnchor(edgeData.to, from, edgeData.id, 'to');
    const mid = a.clone().lerp(b, .5);
    mid.z = Math.max(a.z, b.z) + .22;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }

  function addPipe(edgeData) {
    if (!nodes.has(edgeData.from) || !nodes.has(edgeData.to)) return;
    const curve = tubeCurve(edgeData);
    const material = edgeData.dashed ? new THREE.LineDashedMaterial({ color: '#9db6d6', dashSize: .12, gapSize: .09, transparent: true, opacity: .36, depthTest: false, depthWrite: false }) : new THREE.LineBasicMaterial({ color: '#9db6d6', transparent: true, opacity: .36, depthTest: false, depthWrite: false });
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(18));
    const tube = new THREE.Line(geometry, material);
    if (edgeData.dashed) tube.computeLineDistances();
    const orbMaterial = new THREE.MeshStandardMaterial({ color: '#fff3b0', emissive: '#f59f00', emissiveIntensity: 2.8, transparent: true, opacity: 1, depthTest: false, depthWrite: false });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(.095, 12, 12), orbMaterial);
    const arrowMaterial = new THREE.MeshStandardMaterial({ color: '#6f8db7', emissive: '#31527f', emissiveIntensity: .4, transparent: true, opacity: .7, depthTest: false, depthWrite: false });
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.09, .27, 10), arrowMaterial);
    tube.renderOrder = 5;
    orb.renderOrder = 6;
    arrow.renderOrder = 6;
    orb.visible = false;
    arrow.visible = true;
    scene.add(tube, orb, arrow);
    const item = { curve, tube, material, orb, orbMaterial, arrow, arrowMaterial, edgeData, offset: pipes.size * .137 };
    placeArrow(item);
    pipes.set(edgeData.id, item);
  }

  function placeArrow(item) {
    const progress = .94;
    item.arrow.position.copy(item.curve.getPointAt(progress));
    const tangent = item.curve.getTangentAt(progress).normalize();
    item.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  }

  prepareAttachmentSlots();
  D.edges.forEach(addPipe);

  function syncState(next) {
    active = next || active;
    const activeNodeIds = active.activeNodes || {};
    nodes.forEach((item, id) => {
      const on = !active.idle && !!activeNodeIds[id];
      item.material.emissiveIntensity = on ? .48 : (item.isContainer ? .04 : .02);
      item.material.opacity = item.isContainer ? (on ? .31 : .16) : (!active.idle && !on ? .38 : 1);
      item.edge.material.opacity = on ? 1 : (item.isContainer ? .55 : .4);
      item.label.material.opacity = !active.idle && !on ? .43 : 1;
    });
    const activeEdges = active.activeEdges || [];
    pipes.forEach((item, id) => {
      const on = !active.idle && activeEdges.includes(id);
      const visible = nodes.get(item.edgeData.from).group.visible && nodes.get(item.edgeData.to).group.visible;
      item.material.color.set(on ? '#f6a61a' : '#9db6d6');
      item.material.opacity = on ? 1 : .36;
      item.tube.visible = visible;
      item.orb.visible = on && visible;
      item.arrow.visible = visible;
      item.arrowMaterial.color.set(on ? '#f6a61a' : '#6f8db7');
      item.arrowMaterial.emissive.set(on ? '#a85e00' : '#31527f');
      item.arrowMaterial.opacity = on ? 1 : .7;
    });
    paintSelection();
  }
  syncState(active);
  window.addEventListener('phare:process-step', (event) => syncState(event.detail));

  function resize() {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  new ResizeObserver(resize).observe(host);
  resize();

  function setMode(want3d) {
    is3d = want3d;
    host.hidden = !want3d;
    canvas2d.hidden = want3d;
    button2d.classList.toggle('on', !want3d);
    button3d.classList.toggle('on', want3d);
    buttonReset.hidden = !want3d;
    button2d.setAttribute('aria-pressed', String(!want3d));
    button3d.setAttribute('aria-pressed', String(want3d));
    if (want3d) { resize(); renderer.domElement.focus({ preventScroll: true }); }
  }
  button2d.addEventListener('click', () => setMode(false));
  button3d.addEventListener('click', () => setMode(true));
  function resetView() {
    clearSelection();
    controls.target.set(0, 0, 0);
    camera.position.copy(defaultCamera);
    controls.update();
  }
  buttonReset.addEventListener('click', resetView);

  function typeName(kind) {
    return ({ human: 'Intervention humaine', system: 'Système PHARE', guard: 'Contrôle', external: 'Dépendance externe', data: 'Donnée / preuve', transverse: 'Service transverse', container: 'Périmètre technique' })[kind] || kind;
  }
  function setConnections(node, incoming, outgoing) {
    inspectorConnections.textContent = '';
    const renderLink = (edgeData, direction) => {
      const otherId = direction === '←' ? edgeData.from : edgeData.to;
      const other = D.nodes.find((candidate) => candidate.id === otherId);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.node = otherId;
      button.textContent = direction + ' ' + (edgeData.label || 'liaison') + ' · ' + (other ? other.label : otherId);
      inspectorConnections.appendChild(button);
    };
    incoming.forEach((edgeData) => renderLink(edgeData, '←'));
    outgoing.forEach((edgeData) => renderLink(edgeData, '→'));
  }
  inspectorConnections.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-node]');
    if (!target) return;
    const node = D.nodes.find((candidate) => candidate.id === target.dataset.node);
    if (node) selectNode(node);
  });
  function paintSelection() {
    if (!selectedId) return;
    const scope = new Set([selectedId]);
    const selectedNode = D.nodes.find((node) => node.id === selectedId);
    if (selectedNode && selectedNode.kind === 'container') childrenOf(selectedNode).forEach((child) => scope.add(child.id));
    const connected = new Set(scope);
    const linkedEdges = new Set();
    D.edges.forEach((edgeData) => {
      if (scope.has(edgeData.from) || scope.has(edgeData.to)) {
        linkedEdges.add(edgeData.id);
        connected.add(edgeData.from);
        connected.add(edgeData.to);
      }
    });
    nodes.forEach((item, id) => {
      const related = connected.has(id);
      const hidden = !!explodedId && !related;
      item.material.opacity = hidden ? 0 : (item.isContainer ? (related ? .28 : .018) : (related ? 1 : .045));
      item.edge.material.opacity = hidden ? 0 : (related ? 1 : .045);
      item.label.material.opacity = hidden ? 0 : (related ? 1 : .07);
      item.material.emissiveIntensity = id === selectedId ? .85 : (related ? .25 : .01);
    });
    pipes.forEach((item, id) => {
      const related = linkedEdges.has(id);
      const visible = nodes.get(item.edgeData.from).group.visible && nodes.get(item.edgeData.to).group.visible;
      item.tube.visible = related && visible;
      item.orb.visible = related && visible && !active.idle && (active.activeEdges || []).includes(id);
      item.arrow.visible = related && visible;
      if (related) {
        item.material.color.set((active.activeEdges || []).includes(id) ? '#f6a61a' : '#69aaff');
        item.material.opacity = 1;
        item.arrowMaterial.color.set((active.activeEdges || []).includes(id) ? '#f6a61a' : '#69aaff');
        item.arrowMaterial.opacity = 1;
      }
    });
  }
  function clearSelection() {
    if (!selectedId) return;
    if (explodedId) resetExploded();
    selectedId = null;
    inspector.hidden = true;
    pipes.forEach((item) => { item.tube.visible = true; });
    syncState(active);
  }
  function childrenOf(container) {
    return D.nodes.filter((node) => {
      if (node.id === container.id || node.kind === 'container') return false;
      const cx = node.x + node.w / 2;
      const cy = node.y + node.h / 2;
      return cx > container.x && cx < container.x + container.w && cy > container.y && cy < container.y + container.h;
    });
  }
  function refreshPipes() {
    prepareAttachmentSlots();
    pipes.forEach((item) => {
      item.curve = tubeCurve(item.edgeData);
      const oldGeometry = item.tube.geometry;
      item.tube.geometry = new THREE.BufferGeometry().setFromPoints(item.curve.getPoints(18));
      if (item.edgeData.dashed) item.tube.computeLineDistances();
      oldGeometry.dispose();
      placeArrow(item);
    });
  }
  function disposeVirtualParts() {
    virtualParts.forEach((part) => {
      scene.remove(part);
      part.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material && child.material.map) child.material.map.dispose();
        if (child.material) child.material.dispose();
      });
    });
    virtualParts = [];
  }
  function explodeOrchestrator(node) {
    const parts = decompositions[node.id] || [];
    const center = nodes.get(node.id).group.position;
    parts.forEach((part, index) => {
      const group = new THREE.Group();
      group.position.copy(center).add(new THREE.Vector3(3.05, ((parts.length - 1) / 2 - index) * .98, .8));
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, .66, .3), new THREE.MeshStandardMaterial({ color: part.color, roughness: .34, metalness: .3, emissive: part.color, emissiveIntensity: .14 }));
      body.castShadow = true;
      group.add(body);
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: part.text, transparent: true, opacity: .8 }));
      outline.position.copy(body.position);
      group.add(outline);
      const label = labelSprite(part.label, part.text, 1.85, .55);
      label.position.set(0, 0, .18);
      group.add(label);
      const spokeCurve = new THREE.LineCurve3(center.clone().sub(group.position), new THREE.Vector3(0, 0, .14));
      const spoke = new THREE.Line(new THREE.BufferGeometry().setFromPoints(spokeCurve.getPoints(2)), new THREE.LineBasicMaterial({ color: part.text, transparent: true, opacity: .75, depthTest: false, depthWrite: false }));
      spoke.renderOrder = 5;
      group.add(spoke);
      scene.add(group);
      virtualParts.push(group);
    });
    const original = nodes.get(node.id);
    original.material.opacity = .18;
    original.edge.material.opacity = .25;
    original.label.material.opacity = .3;
  }
  function resetExploded() {
    nodes.forEach((item) => item.group.position.copy(item.origin));
    disposeVirtualParts();
    explodedId = null;
    refreshPipes();
  }
  function toggleExplode() {
    const selected = D.nodes.find((node) => node.id === selectedId);
    if (!selected) return;
    if (explodedId === selected.id) {
      resetExploded();
      inspectorExplode.textContent = 'Décomposer ce périmètre';
      paintSelection();
      return;
    }
    resetExploded();
    if (decompositions[selected.id]) {
      explodeOrchestrator(selected);
      explodedId = selected.id;
      inspectorExplode.textContent = 'Refermer la vue éclatée';
      return;
    }
    const children = childrenOf(selected);
    children.forEach((child, index) => {
      const item = nodes.get(child.id);
      const parent = nodes.get(selected.id).group.position;
      const direction = parent.x < 0 ? 1 : -1;
      item.group.position.copy(parent).add(new THREE.Vector3(direction * 2.65, ((children.length - 1) / 2 - index) * 1.02, .82));
    });
    explodedId = selected.id;
    refreshPipes();
    inspectorExplode.textContent = 'Refermer la vue éclatée';
    paintSelection();
  }
  inspectorExplode.addEventListener('click', toggleExplode);
  function selectNode(node) {
    if (explodedId && explodedId !== node.id) resetExploded();
    selectedId = node.id;
    const incoming = D.edges.filter((edgeData) => edgeData.to === node.id);
    const outgoing = D.edges.filter((edgeData) => edgeData.from === node.id);
    inspectorKind.textContent = typeName(node.kind);
    inspectorTitle.textContent = node.label;
    inspectorSub.textContent = node.sub ? node.sub.replace(/\n/g, ' · ') : 'Aucune précision supplémentaire.';
    inspectorLinks.textContent = (incoming.length + outgoing.length) + ' liaison' + (incoming.length + outgoing.length > 1 ? 's' : '') + ' : ' + incoming.length + ' entrante' + (incoming.length > 1 ? 's' : '') + ', ' + outgoing.length + ' sortante' + (outgoing.length > 1 ? 's' : '') + '.';
    setConnections(node, incoming, outgoing);
    const canExplode = (node.kind === 'container' && childrenOf(node).length > 0) || !!decompositions[node.id];
    inspectorExplode.hidden = !canExplode;
    inspectorExplode.textContent = explodedId === node.id ? 'Refermer la vue éclatée' : 'Décomposer ce périmètre';
    inspector.hidden = false;
    paintSelection();
  }
  inspectorClose.addEventListener('click', clearSelection);

  function showTooltip(node, event) {
    tooltip.textContent = node.label + (node.sub ? ' — ' + node.sub.replace(/\n/g, ' · ') : '');
    tooltip.style.left = event.offsetX + 'px';
    tooltip.style.top = event.offsetY + 'px';
    tooltip.classList.add('show');
  }
  function clearHover() {
    if (hovered) {
      const item = nodes.get(hovered.id);
      if (item) item.group.scale.setScalar(1);
    }
    hovered = null;
    tooltip.classList.remove('show');
    renderer.domElement.style.cursor = 'grab';
  }
  renderer.domElement.addEventListener('pointermove', (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(rayTargets, false)[0];
    const node = hit && hit.object.userData.node;
    if (!node) { clearHover(); return; }
    if (!hovered || hovered.id !== node.id) {
      clearHover();
      hovered = node;
      const item = nodes.get(node.id);
      item.group.scale.setScalar(1.055);
      renderer.domElement.style.cursor = 'pointer';
    }
  });
  renderer.domElement.addEventListener('pointerleave', clearHover);
  renderer.domElement.addEventListener('click', () => {
    if (!hovered) return;
    selectNode(hovered);
  });
  renderer.domElement.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Home') {
      event.preventDefault();
      resetView();
    } else if (event.key === 'Enter' && hovered) {
      event.preventDefault();
      selectNode(hovered);
    }
  });

  renderer.domElement.style.cursor = 'grab';
  function render() {
    requestAnimationFrame(render);
    const elapsed = clock.getElapsedTime();
    pipes.forEach((item) => {
      if (item.orb.visible) {
        const progress = reduceMotion ? .48 : (elapsed * .19 + item.offset) % 1;
        item.orb.position.copy(item.curve.getPointAt(progress));
      }
    });
    controls.update();
    if (is3d) renderer.render(scene, camera);
  }
  render();
}
