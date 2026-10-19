/* Rendu et animation du schéma PHARE. Aucune dépendance. */
(function () {
  'use strict';
  var D = window.PHARE_DATA;
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('canvas');
  var nodesById = {};
  D.nodes.forEach(function (n) { nodesById[n.id] = n; });

  var scenarioKey = 'creation';
  /* Scénario de cette vue -> scénario équivalent du simulateur (table fixe : l'adresse n'est jamais construite à partir d'une valeur saisie) */
  var SIM_PRESET = { creation: 'creation', feature: 'feature', campagne: 'campagne' };
  var stepIndex = 0;
  var playing = false;
  var speed = 1;
  var stepStart = 0;
  var dots = [];
  var STEP_MS = 7000;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  function center(n) { return { x: n.x + n.w / 2, y: n.y + n.h / 2 }; }

  function anchor(n, px, py) {
    var c = center(n);
    var dx = px - c.x;
    var dy = py - c.y;
    if (dx === 0 && dy === 0) return c;
    var sx = (n.w / 2) / Math.max(Math.abs(dx), 1e-9);
    var sy = (n.h / 2) / Math.max(Math.abs(dy), 1e-9);
    var s = Math.min(sx, sy);
    return { x: c.x + dx * s, y: c.y + dy * s };
  }

  function geometry(e) {
    var a = nodesById[e.from];
    var b = nodesById[e.to];
    var ca = center(a);
    var cb = center(b);
    var p1 = anchor(a, cb.x, cb.y);
    var p2 = anchor(b, ca.x, ca.y);
    var mx = (p1.x + p2.x) / 2;
    var my = (p1.y + p2.y) / 2;
    var dx = p2.x - p1.x;
    var dy = p2.y - p1.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var cx = mx - (dy / len) * len * 0.08;
    var cy = my + (dx / len) * len * 0.08;
    return {
      d: 'M' + p1.x + ' ' + p1.y + ' Q' + cx + ' ' + cy + ' ' + p2.x + ' ' + p2.y,
      lx: 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x,
      ly: 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y,
    };
  }

  /* --- Construction du SVG --- */
  var defs = el('defs', {}, svg);
  var marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0 L10 5 L0 10 z', fill: 'context-stroke' }, marker);

  var gContainers = el('g', {}, svg);
  var gEdges = el('g', {}, svg);
  var gNodes = el('g', {}, svg);
  var gLabels = el('g', {}, svg);
  var gDots = el('g', {}, svg);

  var nodeEls = {};
  D.nodes.forEach(function (n) {
    var parent = n.kind === 'container' ? gContainers : gNodes;
    var g = el('g', { class: 'node k-' + n.kind, 'data-id': n.id, transform: 'translate(' + n.x + ',' + n.y + ')' }, parent);
    el('rect', { width: n.w, height: n.h }, g);
    var t = el('text', { x: 10, y: 18 }, g);
    t.textContent = n.label;
    t.setAttribute('font-weight', '600');
    if (n.sub) {
      n.sub.split('\n').forEach(function (line, i) {
        var s = el('text', { x: 10, y: 33 + i * 14, class: 'sub' }, g);
        s.textContent = line;
      });
    }
    var title = el('title', {}, g);
    title.textContent = n.label + (n.sub ? ' : ' + n.sub.split('\n').join(' ') : '');
    nodeEls[n.id] = g;
  });

  var edgeEls = {};
  var labelEls = {};
  D.edges.forEach(function (e) {
    var a = nodesById[e.from];
    var b = nodesById[e.to];
    var geo = geometry(e);
    var cls = 'edge f-' + a.kind + ' f-' + b.kind + (e.dashed ? ' dashed' : '');
    var p = el('path', { class: cls, d: geo.d, 'data-id': e.id, 'marker-end': 'url(#arrow)' }, gEdges);
    edgeEls[e.id] = p;
    if (e.label) {
      var t = el('text', { class: 'edge-label', x: geo.lx, y: geo.ly - 4, 'text-anchor': 'middle', 'data-id': e.id }, gLabels);
      t.textContent = e.label;
      labelEls[e.id] = t;
    }
  });

  /* --- Interface --- */
  var $ = function (id) { return document.getElementById(id); };
  var stateStrip = $('states');
  var panel = {
    title: $('step-title'), who: $('step-who'), text: $('step-text'),
    deps: $('step-deps'), ctrl: $('step-ctrl'), count: $('step-count'), list: $('step-list'),
  };

  function steps() { return D.scenarios[scenarioKey].steps; }

  function renderStates(current) {
    stateStrip.textContent = '';
    D.states.forEach(function (s, i) {
      var d = document.createElement('span');
      d.className = 'state' + (i < current ? ' past' : '') + (i === current ? ' current' : '');
      d.textContent = s;
      stateStrip.appendChild(d);
    });
  }

  function fillList(ul, items) {
    ul.textContent = '';
    items.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
  }

  function renderList() {
    panel.list.textContent = '';
    steps().forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = (i + 1) + '. ' + s.title;
      if (i === stepIndex) b.className = 'on';
      b.addEventListener('click', function () { go(i); });
      panel.list.appendChild(b);
    });
  }

  function buildDots(step) {
    gDots.textContent = '';
    dots = [];
    step.edges.forEach(function (id, i) {
      var path = edgeEls[id];
      if (!path) return;
      var c = el('circle', { class: 'dot', r: 5 }, gDots);
      dots.push({ path: path, len: path.getTotalLength(), circle: c, offset: (i * 0.23) % 1 });
    });
  }

  function apply() {
    var list = steps();
    stepIndex = Math.max(0, Math.min(list.length - 1, stepIndex));
    var step = list[stepIndex];
    svg.classList.add('has-active');
    var activeNodes = {};
    step.nodes.forEach(function (id) { activeNodes[id] = true; });
    D.edges.forEach(function (e) {
      if (step.edges.indexOf(e.id) !== -1) { activeNodes[e.from] = true; activeNodes[e.to] = true; }
    });
    Object.keys(nodeEls).forEach(function (id) { nodeEls[id].classList.toggle('active', !!activeNodes[id]); });
    Object.keys(edgeEls).forEach(function (id) { edgeEls[id].classList.toggle('active', step.edges.indexOf(id) !== -1); });
    Object.keys(labelEls).forEach(function (id) { labelEls[id].classList.toggle('active', step.edges.indexOf(id) !== -1); });
    renderStates(step.state);
    panel.title.textContent = step.title;
    panel.count.textContent = 'Étape ' + (stepIndex + 1) + ' sur ' + list.length + ' · ' + D.scenarios[scenarioKey].name;
    var toSim = document.getElementById('to-sim');
    var simPreset = Object.prototype.hasOwnProperty.call(SIM_PRESET, scenarioKey) ? SIM_PRESET[scenarioKey] : null;
    if (toSim && simPreset) toSim.href = 'simulateur.html#s=' + simPreset;
    var toUsine = document.getElementById('to-usine');
    if (toUsine) toUsine.href = 'usine.html#t=' + [2, 12, 22, 32, 35, 50, 66, 80, 88][step.state];
    panel.who.textContent = '';
    var kind = document.createElement('span');
    kind.className = 'badge ' + (step.human ? 'human' : 'auto');
    kind.textContent = step.human ? 'Intervention humaine' : 'Automatique';
    panel.who.appendChild(kind);
    step.who.forEach(function (w) {
      var s = document.createElement('span');
      s.className = 'badge';
      s.textContent = w;
      panel.who.appendChild(s);
    });
    panel.text.textContent = step.text;
    fillList(panel.deps, step.deps);
    fillList(panel.ctrl, step.ctrl);
    renderList();
    buildDots(step);
    stepStart = performance.now();
    $('prev').disabled = stepIndex === 0;
    $('next').disabled = stepIndex === list.length - 1;
  }

  function go(i) { stepIndex = i; apply(); }

  function setPlaying(p) {
    playing = p;
    $('play').textContent = p ? 'Pause' : 'Lecture';
    stepStart = performance.now();
  }

  function frame(now) {
    dots.forEach(function (d) {
      var t = (((now * speed) / 1800) + d.offset) % 1;
      var pt = d.path.getPointAtLength(t * d.len);
      d.circle.setAttribute('cx', pt.x);
      d.circle.setAttribute('cy', pt.y);
    });
    if (playing && now - stepStart > STEP_MS / speed) {
      if (stepIndex < steps().length - 1) { go(stepIndex + 1); } else { setPlaying(false); }
    }
    requestAnimationFrame(frame);
  }

  $('prev').addEventListener('click', function () { go(stepIndex - 1); });
  $('next').addEventListener('click', function () { go(stepIndex + 1); });
  $('play').addEventListener('click', function () {
    if (!playing && stepIndex === steps().length - 1) { stepIndex = 0; apply(); }
    setPlaying(!playing);
  });
  $('scenario').addEventListener('change', function (e) {
    scenarioKey = e.target.value;
    stepIndex = 0;
    setPlaying(false);
    apply();
  });
  $('speed').addEventListener('change', function (e) { speed = parseFloat(e.target.value) || 1; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-layer]'), function (cb) {
    cb.addEventListener('change', function () { svg.classList.toggle('hide-' + cb.getAttribute('data-layer'), !cb.checked); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && /^(SELECT|INPUT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') go(stepIndex + 1);
    else if (e.key === 'ArrowLeft') go(stepIndex - 1);
    else if (e.key === ' ') { e.preventDefault(); $('play').click(); }
  });

  Object.keys(D.scenarios).forEach(function (k) {
    var o = document.createElement('option');
    o.value = k;
    o.textContent = D.scenarios[k].name;
    $('scenario').appendChild(o);
  });

  (function fromHash() {
    var m = /^#([a-z]+)\/(\d+)$/.exec(window.location.hash || '');
    if (m && D.scenarios[m[1]]) {
      scenarioKey = m[1];
      $('scenario').value = m[1];
      stepIndex = Math.max(0, parseInt(m[2], 10) - 1);
    }
  })();

  apply();
  requestAnimationFrame(frame);
})();
