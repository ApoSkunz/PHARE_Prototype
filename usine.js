/* Vue « chaîne de production » (page d'accueil) : visite guidée animée de PHARE, enchaîne automatiquement les scénarios en boucle, interruptible.
   Toute la scène est une fonction du temps t : lecture, pause, curseur et boucle sont déterministes.
   Les personnes travaillent sur des postes suspendus au-dessus du tapis : rien ne se chevauche avec le colis. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var W = 6760, H = 620, T = 92, BELT = 470, DECK = 338;
  var COL = { human: '#d9480f', system: '#5f3dc4', guard: '#c92a2a', ext: '#0b7285', ok: '#2b8a3e', ink: '#1a1f2b', accent: '#f59f00', mute: '#445066', blue: '#1c7ed6', red2: '#d9480f' };

  var svg = document.getElementById('scene');
  var viewport = document.getElementById('viewport');

  function S(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function seg(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }
  function show(e, on) { e.setAttribute('opacity', on ? 1 : 0); }
  function within(t, a, b) { return t >= a && t < b; }

  /* ---------- Décor ---------- */
  var defs = S('defs', {}, svg);
  var beltPat = S('pattern', { id: 'belt', width: 48, height: 30, patternUnits: 'userSpaceOnUse' }, defs);
  S('rect', { width: 48, height: 30, fill: '#4a5163' }, beltPat);
  S('rect', { width: 24, height: 30, fill: '#5d667b' }, beltPat);
  var grid = S('pattern', { id: 'grid', width: 60, height: 60, patternUnits: 'userSpaceOnUse' }, defs);
  S('path', { d: 'M60 0H0V60', fill: 'none', stroke: '#d9dfec', 'stroke-width': 1 }, grid);

  S('rect', { x: 0, y: 0, width: W, height: H, fill: '#f1f4fa' }, svg);
  S('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#grid)' }, svg);
  S('rect', { x: 0, y: BELT + 30, width: W, height: H - BELT - 30, fill: '#cfd6e4' }, svg);

  var stations = [
    { x: 60, w: 700, c: COL.human, t: '1 · Réception', s: 'Les besoins arrivent' },
    { x: 800, w: 760, c: COL.guard, t: '2 · Contrôle d\'entrée', s: 'Vérifier, trier, classer' },
    { x: 1600, w: 760, c: COL.system, t: '3 · Bureau d\'études', s: 'L\'usine planifie seule' },
    { x: 2400, w: 600, c: COL.human, t: '4 · Feu vert', s: 'Un humain signe le GO' },
    { x: 3040, w: 1180, c: COL.system, t: '5 · Atelier robotisé', s: 'Des robots IA, en cellule isolée' },
    { x: 4260, w: 780, c: COL.guard, t: '6 · Contrôle de sortie', s: 'Tests, sécurité, preuves' },
    { x: 5080, w: 860, c: COL.ext, t: '7 · Quai GitLab', s: 'Vérification et relecture humaine' },
    { x: 5980, w: 700, c: COL.ok, t: '8 · Livraison', s: 'GitLab déploie, PHARE observe' },
  ];
  stations.forEach(function (st) {
    S('rect', { x: st.x + 20, y: 24, width: st.w - 40, height: 88, rx: 14, fill: '#fff', stroke: st.c, 'stroke-width': 5 }, svg);
    S('text', { x: st.x + 42, y: 66, class: 'sign-title' }, svg, st.t);
    S('text', { x: st.x + 42, y: 98, class: 'sign-sub' }, svg, st.s);
    S('rect', { x: st.x, y: 136, width: 14, height: BELT - 136, fill: st.c, opacity: 0.45 }, svg);
    S('rect', { x: st.x + st.w - 14, y: 136, width: 14, height: BELT - 136, fill: st.c, opacity: 0.45 }, svg);
    S('rect', { x: st.x, y: 130, width: st.w, height: 12, rx: 6, fill: st.c, opacity: 0.55 }, svg);
  });
  S('rect', { x: 0, y: BELT, width: W, height: 30, fill: 'url(#belt)' }, svg);

  /* Sortie de chaque étape (entrée → sortie, comme un schéma de processus). La carte se coche quand l'étape est franchie. */
  var outputs = [
    ['Dossier', 'tickets et maquettes', 0, 9], ['Rapport de contrôle', 'dossier complet, sain, classé', 9, 19], ['Plan chiffré', 'plan, tests prévus, coût', 19, 30],
    ['GO signé', 'dossier figé et signé', 30, 38], ['Code et tests', 'tests gelés, code produit', 38, 62], ['Dossier de preuves', 'tout ce qui a été vérifié', 62, 74],
    ['Demande de fusion', 'relue et approuvée', 74, 86], ['Application livrée', 'déployée par GitLab', 86, 93],
  ];
  var outCards = outputs.map(function (o, i) {
    var st = stations[i], g = S('g', {}, svg);
    var r = S('rect', { x: st.x + 20, y: 556, width: st.w - 40, height: 54, rx: 10, fill: '#fff', stroke: st.c, 'stroke-width': 2 }, g);
    S('text', { x: st.x + 36, y: 574, class: 'tiny', style: 'letter-spacing:.08em;font-weight:700' }, g, 'SORTIE');
    var t = S('text', { x: st.x + 36, y: 600, class: 'plabel' }, g, o[0]);
    S('text', { x: st.x + st.w - 36, y: 600, 'text-anchor': 'end', class: 'tiny' }, g, o[1]);
    var mark = S('text', { x: st.x + st.w - 36, y: 576, 'text-anchor': 'end', style: 'font-size:20px;font-weight:800', fill: COL.ok }, g, '');
    return { r: r, mark: mark, t0: o[2], t1: o[3], g: g };
  });

  /* ---------- Éléments réutilisables ---------- */
  /* Poste suspendu : la personne est sur une plate-forme, le colis passe dessous. */
  /* Passerelle de supervision : chariot sur rail, suspentes en acier, plateforme avec garde-corps. Le colis passe dessous. */
  function deck(g, cx) {
    S('rect', { x: cx - 78, y: 136, width: 156, height: 10, rx: 3, fill: '#495057' }, g);
    S('rect', { x: cx - 62, y: 146, width: 7, height: DECK - 146, fill: '#8b94a8' }, g);
    S('rect', { x: cx + 55, y: 146, width: 7, height: DECK - 146, fill: '#8b94a8' }, g);
    S('rect', { x: cx - 74, y: DECK, width: 148, height: 12, rx: 3, fill: '#5c667b' }, g);
    S('rect', { x: cx - 74, y: DECK, width: 148, height: 3, rx: 1.5, fill: '#aab2c5' }, g);
    S('rect', { x: cx - 72, y: DECK - 34, width: 4, height: 34, fill: '#8b94a8' }, g);
    S('rect', { x: cx + 68, y: DECK - 34, width: 4, height: 34, fill: '#8b94a8' }, g);
    S('line', { x1: cx - 72, y1: DECK - 33, x2: cx + 72, y2: DECK - 33, stroke: '#8b94a8', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    S('line', { x1: cx - 72, y1: DECK - 17, x2: cx + 72, y2: DECK - 17, stroke: '#aab2c5', 'stroke-width': 2.5 }, g);
  }
  function worker(cx, label, color) {
    var g = S('g', {}, svg);
    deck(g, cx);
    var p = S('g', { transform: 'translate(' + cx + ',' + DECK + ')' }, g);
    S('line', { x1: -9, y1: -16, x2: -11, y2: 0, stroke: '#343a40', 'stroke-width': 7, 'stroke-linecap': 'round' }, p);
    S('line', { x1: 9, y1: -16, x2: 11, y2: 0, stroke: '#343a40', 'stroke-width': 7, 'stroke-linecap': 'round' }, p);
    S('rect', { x: -22, y: -72, width: 44, height: 58, rx: 12, fill: color }, p);
    S('circle', { cx: 0, cy: -92, r: 18, fill: '#ffd8a8', stroke: color, 'stroke-width': 4 }, p);
    var arm = S('line', { x1: 20, y1: -62, x2: 42, y2: -44, stroke: color, 'stroke-width': 8, 'stroke-linecap': 'round' }, p);
    var aura = S('circle', { cx: 0, cy: -52, r: 66, fill: 'none', stroke: color, 'stroke-width': 5, opacity: 0 }, p);
    var tw = label.length * 9.4 + 22;
    S('rect', { x: cx - tw / 2, y: DECK - 150, width: tw, height: 28, rx: 14, fill: '#fff', stroke: color, 'stroke-width': 2 }, g);
    S('text', { x: cx, y: DECK - 130, 'text-anchor': 'middle', class: 'plabel' }, g, label);
    return { g: g, arm: arm, aura: aura };
  }
  /* Poste d'agent : module industriel sobre, glyphe du rôle, voyant d'état. Les deux bras d'outil animés restent armL / armR. */
  function agentBody(g, color, kind) {
    S('rect', { x: -52, y: -18, width: 104, height: 18, rx: 5, fill: '#343a40' }, g);
    S('rect', { x: -44, y: -118, width: 88, height: 102, rx: 10, fill: '#1f2430', stroke: color, 'stroke-width': 5 }, g);
    S('rect', { x: -44, y: -118, width: 88, height: 24, rx: 10, fill: color }, g);
    S('circle', { cx: 28, cy: -106, r: 5, fill: '#69db7c' }, g);
    S('rect', { x: -34, y: -109, width: 30, height: 6, rx: 3, fill: 'rgba(255,255,255,.75)' }, g);
    var w = { stroke: '#fff', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (kind === 'test') S('path', Object.assign({ d: 'M-20 -56 l14 16 l28 -34' }, w), g);
    else if (kind === 'code') S('text', { x: 0, y: -44, 'text-anchor': 'middle', fill: '#fff', style: 'font-size:30px;font-weight:800;font-family:Consolas,monospace' }, g, '</>');
    else if (kind === 'review') { S('circle', Object.assign({ cx: -4, cy: -62, r: 15 }, w), g); S('line', Object.assign({ x1: 8, y1: -50, x2: 24, y2: -32 }, w), g); }
    else { [-70, -56, -42].forEach(function (yy, i) { S('line', Object.assign({ x1: -24, y1: yy, x2: 24 - i * 8, y2: yy }, w), g); }); }
    var armL = S('line', { x1: -44, y1: -70, x2: -66, y2: -52, stroke: color, 'stroke-width': 9, 'stroke-linecap': 'round' }, g);
    var armR = S('line', { x1: 44, y1: -70, x2: 66, y2: -52, stroke: color, 'stroke-width': 9, 'stroke-linecap': 'round' }, g);
    return { armL: armL, armR: armR };
  }
  function robot(x, label, color, kind) {
    var g = S('g', { transform: 'translate(' + x + ',' + (BELT - 4) + ')' }, svg);
    var a = agentBody(g, color, kind);
    var tw = label.length * 9.4 + 22;
    S('rect', { x: -tw / 2, y: 56, width: tw, height: 28, rx: 14, fill: '#fff', stroke: color, 'stroke-width': 2 }, g);
    S('text', { x: 0, y: 76, 'text-anchor': 'middle', class: 'plabel' }, g, label);
    return { g: g, armL: a.armL, armR: a.armR };
  }
  function light(x, y, label) {
    var g = S('g', {}, svg);
    var c = S('circle', { cx: x, cy: y, r: 14, fill: '#adb5bd', stroke: '#495057', 'stroke-width': 3 }, g);
    S('text', { x: x, y: y + 36, 'text-anchor': 'middle', class: 'tiny' }, g, label);
    return c;
  }
  function cloud(x, y, name, sub, stroke) {
    var g = S('g', {}, svg);
    g.r = S('rect', { x: x - 104, y: y - 30, width: 208, height: 60, rx: 12, fill: '#fff', stroke: stroke || COL.ext, 'stroke-width': 4 }, g);
    g.n = S('text', { x: x, y: y - 6, 'text-anchor': 'middle', class: 'plabel' }, g, name);
    g.u = S('text', { x: x, y: y + 16, 'text-anchor': 'middle', class: 'tiny' }, g, sub);
    return g;
  }
  function link(x1, y1, x2, y2) {
    return S('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: COL.ext, 'stroke-width': 4, 'stroke-dasharray': '6 8', 'stroke-linecap': 'round', opacity: 0 }, svg);
  }
  function gate(x0, x1, y) {
    S('rect', { x: x0, y: y, width: x1 - x0, height: 14, rx: 7, fill: COL.guard }, svg);
    S('rect', { x: x0, y: y, width: 14, height: BELT - y, fill: COL.guard }, svg);
    S('rect', { x: x1 - 14, y: y, width: 14, height: BELT - y, fill: COL.guard }, svg);
  }

  /* ---------- 1. Réception : x 60 à 760 ---------- */
  var po = worker(190, 'Product Owner', COL.human);
  var ux = worker(560, 'Designer', COL.human);
  var crateT = S('g', {}, svg);
  S('rect', { x: -52, y: -52, width: 104, height: 52, rx: 8, fill: '#fff4e6', stroke: COL.human, 'stroke-width': 4 }, crateT);
  S('text', { x: 0, y: -20, 'text-anchor': 'middle', class: 'plabel' }, crateT, 'Tickets');
  var crateM = S('g', {}, svg);
  S('rect', { x: -52, y: -52, width: 104, height: 52, rx: 8, fill: '#e6fcf5', stroke: COL.ext, 'stroke-width': 4 }, crateM);
  S('text', { x: 0, y: -20, 'text-anchor': 'middle', class: 'plabel' }, crateM, 'Maquettes');
  S('text', { x: 410, y: 170, 'text-anchor': 'middle', class: 'small' }, svg, 'Seuls des humains décident quoi fabriquer');

  /* ---------- 2. Contrôle d'entrée : x 800 à 1560 ---------- */
  gate(900, 1460, 168);
  var entryLights = [
    light(980, 214, 'Complet'), light(1080, 214, 'Sain'), light(1180, 214, 'Données'), light(1280, 214, 'Niveau'), light(1380, 214, 'Droits'),
  ];
  S('text', { x: 1180, y: 292, 'text-anchor': 'middle', class: 'tiny' }, svg, 'Un dossier refusé revient avec son motif');
  S('text', { x: 1180, y: 316, 'text-anchor': 'middle', class: 'note', fill: COL.guard }, svg, 'Ni incomplet ni piégé ne passe');

  /* ---------- 3. Bureau d'études : x 1600 à 2360 ---------- */
  /* Robot planificateur : poste suspendu comme les humains, le colis passe dessous. */
  var planner = (function (cx, label, color) {
    var g = S('g', {}, svg);
    deck(g, cx);
    var p = S('g', { transform: 'translate(' + cx + ',' + (DECK - 2) + ') scale(0.62)' }, g);
    var pa = agentBody(p, color, 'plan');
    var armL = pa.armL, armR = pa.armR;
    var tw = label.length * 9.4 + 22;
    S('rect', { x: cx - tw / 2, y: DECK - 150, width: tw, height: 28, rx: 14, fill: '#fff', stroke: color, 'stroke-width': 2 }, g);
    S('text', { x: cx, y: DECK - 130, 'text-anchor': 'middle', class: 'plabel' }, g, label);
    return { armL: armL, armR: armR };
  })(1720, 'Le planificateur IA', COL.system);
  var plan = S('g', {}, svg);
  var planRect = S('rect', { x: 1860, y: 188, width: 0, height: 120, rx: 6, fill: '#e7f5ff', stroke: COL.ext, 'stroke-width': 4 }, plan);
  var planLines = [0, 1, 2].map(function (i) { return S('line', { x1: 1876, y1: 214 + i * 28, x2: 1876, y2: 214 + i * 28, stroke: COL.ext, 'stroke-width': 4, 'stroke-linecap': 'round' }, plan); });
  var planLabel = S('text', { x: 1950, y: 176, 'text-anchor': 'middle', class: 'plabel' }, svg, 'Plan');
  var testsDoc = S('g', {}, svg);
  var testsRect = S('rect', { x: 2120, y: 188, width: 0, height: 120, rx: 6, fill: '#fff9db', stroke: COL.accent, 'stroke-width': 4 }, testsDoc);
  var testsLines = [0, 1, 2].map(function (i) { return S('path', { d: 'M2136 ' + (214 + i * 28) + ' l8 9 l16 -18', fill: 'none', stroke: COL.ok, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, testsDoc); });
  var testsLabel = S('text', { x: 2205, y: 176, 'text-anchor': 'middle', class: 'plabel' }, svg, 'Tests prévus');
  var budgetTag = S('g', {}, svg);
  S('rect', { x: 2040, y: 262, width: 120, height: 30, rx: 15, fill: '#fff', stroke: COL.mute, 'stroke-width': 3 }, budgetTag);
  S('text', { x: 2100, y: 283, 'text-anchor': 'middle', class: 'tiny' }, budgetTag, 'Budget estimé');
  S('text', { x: 2040, y: 330, 'text-anchor': 'middle', class: 'tiny' }, svg, '');

  /* ---------- 4. Feu vert : x 2400 à 3000 ---------- */
  var chef = worker(2520, 'Chef de projet', COL.human);
  S('rect', { x: 2610, y: DECK - 50, width: 100, height: 50, rx: 8, fill: '#495057' }, svg);
  var goBtn = S('g', {}, svg);
  S('circle', { cx: 2660, cy: DECK - 62, r: 30, fill: COL.ok, stroke: '#fff', 'stroke-width': 3 }, goBtn);
  S('text', { x: 2660, y: DECK - 53, 'text-anchor': 'middle', fill: '#fff', style: 'font-size:24px;font-weight:800' }, goBtn, 'GO');
  var goLabel = S('text', { x: 2660, y: DECK - 110, 'text-anchor': 'middle', class: 'note', fill: COL.ok }, svg, 'GO signé');
  var seal = S('g', {}, svg);
  S('circle', { cx: 2860, cy: 250, r: 40, fill: '#fff', stroke: COL.system, 'stroke-width': 6 }, seal);
  S('path', { d: 'M2842 250 l14 14 l26 -30', fill: 'none', stroke: COL.system, 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, seal);
  S('text', { x: 2860, y: 316, 'text-anchor': 'middle', class: 'plabel' }, seal, 'Dossier figé et signé');
  var keyTag = S('g', {}, svg);
  S('rect', { x: 2760, y: 332, width: 200, height: 28, rx: 14, fill: '#fff', stroke: COL.mute, 'stroke-width': 3 }, keyTag);
  S('text', { x: 2860, y: 352, 'text-anchor': 'middle', class: 'tiny' }, keyTag, 'clé temporaire plafonnée');

  /* ---------- 5. Atelier robotisé : x 3040 à 4220 ---------- */
  /* Les agents travaillent dans la cellule ; les modèles d'IA restent dehors, joints par une passerelle surveillée (pas d'internet libre). */
  S('rect', { x: 3070, y: 244, width: 1120, height: 246, rx: 18, fill: 'rgba(95,61,196,.06)', stroke: COL.system, 'stroke-width': 4, 'stroke-dasharray': '14 10' }, svg);
  var cellLabel = S('text', { x: 3600, y: 270, 'text-anchor': 'middle', class: 'note', fill: COL.system }, svg, 'Cellule isolée');
  S('text', { x: 3092, y: 180, class: 'tiny' }, svg, 'Modèles d\'IA : dehors');
  var exLabel = S('text', { x: 3092, y: 198, class: 'tiny' }, svg, 'exemples seulement');
  var books = ['OIDC · SAML · LDAPS', 'Règles IA', 'Design system', 'Java · Angular'].map(function (name, i) {
    var g = S('g', { transform: 'translate(3190,' + (388 - 34 * i) + ')' }, svg);
    S('rect', { x: -90, y: -15, width: 180, height: 30, rx: 6, fill: '#fff', stroke: COL.ext, 'stroke-width': 3 }, g);
    S('text', { x: 0, y: 5, 'text-anchor': 'middle', style: 'font-size:14.5px;font-weight:700', fill: COL.ink }, g, name);
    return g;
  });
  S('text', { x: 3190, y: 262, 'text-anchor': 'middle', class: 'tiny' }, svg, 'règles communes');
  var rT = robot(3420, 'Le testeur', COL.blue, 'test');
  var rC = robot(3780, 'Le constructeur', COL.system, 'code');
  var rR = robot(4090, 'Le relecteur', COL.red2, 'review');
  var cloudA = cloud(3420, 186, 'Claude', 'modèle cloud (exemple)');
  var cloudB = cloud(3780, 186, 'Kimi', 'modèle interne (exemple)', COL.system);
  var cloudA2 = cloud(4090, 186, 'Codex', 'autre que le constructeur');
  var linkA = link(3420, 222, 3420, 290);
  var linkB = link(3780, 222, 3780, 290);
  var linkA2 = link(4090, 222, 4090, 290);
  [3420, 3780, 4090].forEach(function (gx) {
    S('rect', { x: gx - 46, y: 233, width: 92, height: 22, rx: 11, fill: '#fff', stroke: COL.guard, 'stroke-width': 3 }, svg);
    S('text', { x: gx, y: 249, 'text-anchor': 'middle', class: 'tiny' }, svg, 'passerelle');
  });
  var parTag = S('g', {}, svg);
  S('rect', { x: 3535, y: 170, width: 130, height: 32, rx: 16, fill: COL.accent }, parTag);
  S('text', { x: 3600, y: 192, 'text-anchor': 'middle', style: 'font-size:18px;font-weight:800', fill: COL.ink }, parTag, 'en parallèle');
  var frozen = S('g', {}, svg);
  S('rect', { x: 3490, y: 332, width: 36, height: 28, rx: 6, fill: COL.accent, stroke: COL.ink, 'stroke-width': 3 }, frozen);
  S('path', { d: 'M3498 332 v-10 a10 10 0 0 1 20 0 v10', fill: 'none', stroke: COL.ink, 'stroke-width': 4 }, frozen);
  S('text', { x: 3508, y: 378, 'text-anchor': 'middle', class: 'tiny' }, frozen, 'tests gelés');
  var build = S('g', {}, svg);
  S('rect', { x: 3900, y: BELT - 14, width: 130, height: 14, rx: 4, fill: '#868e96' }, build);
  var bBack = S('rect', { x: 3910, y: BELT - 94, width: 110, height: 80, rx: 6, fill: '#dbe4ff', stroke: COL.system, 'stroke-width': 4 }, build);
  var bFront = S('rect', { x: 3924, y: BELT - 160, width: 82, height: 66, rx: 6, fill: '#fff', stroke: COL.system, 'stroke-width': 4 }, build);
  var bTop = S('rect', { x: 3940, y: BELT - 180, width: 50, height: 20, rx: 6, fill: COL.accent }, build);
  var buildPct = S('text', { x: 3965, y: BELT - 190, 'text-anchor': 'middle', class: 'note', fill: COL.system }, build, '');
  var budget = S('g', {}, svg);
  S('text', { x: 3150, y: 418, 'text-anchor': 'middle', class: 'tiny' }, budget, 'Budget de fabrication');
  S('rect', { x: 3090, y: 426, width: 120, height: 14, rx: 7, fill: '#e9ecef', stroke: COL.mute, 'stroke-width': 2 }, budget);
  var budgetFill = S('rect', { x: 3090, y: 426, width: 0, height: 14, rx: 7, fill: COL.ok }, budget);

  /* ---------- 6. Contrôle de sortie : x 4260 à 5040 ---------- */
  gate(4340, 4800, 168);
  var exitLights = [light(4420, 214, 'Tests'), light(4530, 214, 'Banc d\'essai'), light(4640, 214, 'Sécurité'), light(4750, 214, 'Secrets')];
  var autoFix = S('g', {}, svg);
  S('rect', { x: 4495, y: 284, width: 290, height: 34, rx: 17, fill: '#fff', stroke: COL.accent, 'stroke-width': 4 }, autoFix);
  S('text', { x: 4640, y: 307, 'text-anchor': 'middle', class: 'plabel' }, autoFix, 'Autocorrection bornée : 1 essai');
  var proofs = S('g', {}, svg);
  S('text', { x: 4930, y: 300, 'text-anchor': 'middle', class: 'plabel' }, proofs, 'Dossier de preuves');
  var sheets = [0, 1, 2].map(function (i) {
    return S('rect', { x: 4880 + i * 10, y: 316 + i * 10, width: 80, height: 100, rx: 6, fill: '#e7f5ff', stroke: '#1864ab', 'stroke-width': 3, opacity: 0 }, proofs);
  });

  /* ---------- 7. Quai GitLab : x 5080 à 5940 ---------- */
  S('rect', { x: 5130, y: 176, width: 210, height: 100, rx: 12, fill: '#fff', stroke: COL.ext, 'stroke-width': 5 }, svg);
  S('text', { x: 5235, y: 220, 'text-anchor': 'middle', style: 'font-size:30px;font-weight:800', fill: COL.ext }, svg, 'GitLab');
  S('text', { x: 5235, y: 252, 'text-anchor': 'middle', class: 'small' }, svg, 'revue et déploiement');
  var mrTag = S('g', {}, svg);
  S('rect', { x: 5140, y: 290, width: 190, height: 30, rx: 15, fill: COL.ext }, mrTag);
  S('text', { x: 5235, y: 311, 'text-anchor': 'middle', style: 'font-size:17px;font-weight:800', fill: '#fff' }, mrTag, 'Demande de fusion');
  var ci = S('g', { transform: 'translate(5440,262)' }, svg);
  S('circle', { cx: 0, cy: 0, r: 38, fill: 'none', stroke: COL.ext, 'stroke-width': 8, 'stroke-dasharray': '110 50', 'stroke-linecap': 'round' }, ci);
  var ciOk = S('path', { d: 'M-16 2 l12 14 l24 -28', fill: 'none', stroke: COL.ok, 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, svg);
  ciOk.setAttribute('transform', 'translate(5440,262)');
  S('text', { x: 5440, y: 326, 'text-anchor': 'middle', class: 'plabel' }, svg, 'Contrôles CI');
  var ing = worker(5740, 'Ingénieur logiciel', COL.human);
  var stamp = S('g', {}, svg);
  S('rect', { x: 5560, y: 214, width: 180, height: 54, rx: 8, fill: '#fff', stroke: COL.ok, 'stroke-width': 7 }, stamp);
  var stampText = S('text', { x: 5650, y: 252, 'text-anchor': 'middle', style: 'font-size:26px;font-weight:800', fill: COL.ok }, stamp, 'APPROUVÉ');
  S('text', { x: 5350, y: 172, class: 'small' }, svg, 'L\'IA ne peut jamais approuver seule');

  /* ---------- 8. Livraison : x 5980 à 6680 ---------- */
  var truck = S('g', {}, svg);
  S('rect', { x: -120, y: -100, width: 190, height: 100, rx: 10, fill: '#fff', stroke: COL.ok, 'stroke-width': 5 }, truck);
  S('rect', { x: 70, y: -66, width: 56, height: 66, rx: 10, fill: COL.ok }, truck);
  S('circle', { cx: -70, cy: 6, r: 18, fill: '#343a40' }, truck);
  S('circle', { cx: 20, cy: 6, r: 18, fill: '#343a40' }, truck);
  S('circle', { cx: 100, cy: 6, r: 18, fill: '#343a40' }, truck);
  var delivered = S('text', { x: 6330, y: 270, 'text-anchor': 'middle', style: 'font-size:48px;font-weight:800', fill: COL.ok }, svg, 'Livré');
  var deliveredSub = S('text', { x: 6330, y: 312, 'text-anchor': 'middle', class: 'note', fill: COL.ink }, svg, 'Rien ne part sans un humain');
  S('text', { x: 6330, y: 190, 'text-anchor': 'middle', class: 'small' }, svg, 'Fusion et déploiement : règles GitLab');

  /* ---------- Colis (dossier, puis application) ---------- */
  var item = S('g', {}, svg);
  var dossier = S('g', {}, item);
  S('rect', { x: -56, y: -84, width: 112, height: 84, rx: 10, fill: '#fff', stroke: COL.human, 'stroke-width': 5 }, dossier);
  S('line', { x1: -36, y1: -62, x2: 36, y2: -62, stroke: COL.human, 'stroke-width': 5, 'stroke-linecap': 'round' }, dossier);
  S('line', { x1: -36, y1: -44, x2: 20, y2: -44, stroke: COL.human, 'stroke-width': 5, 'stroke-linecap': 'round' }, dossier);
  S('line', { x1: -36, y1: -26, x2: 36, y2: -26, stroke: COL.ext, 'stroke-width': 5, 'stroke-linecap': 'round' }, dossier);
  var sealOk = S('circle', { cx: 44, cy: -78, r: 16, fill: COL.ok, stroke: '#fff', 'stroke-width': 3 }, dossier);
  var chip = S('g', {}, dossier);
  S('rect', { x: -56, y: -112, width: 104, height: 26, rx: 13, fill: COL.system }, chip);
  var chipText = S('text', { x: -4, y: -93, 'text-anchor': 'middle', fill: '#fff', style: 'font-size:16px;font-weight:800' }, chip, 'Niveau C1');
  var app = S('g', {}, item);
  S('rect', { x: -66, y: -110, width: 132, height: 110, rx: 12, fill: '#fff', stroke: COL.system, 'stroke-width': 6 }, app);
  S('rect', { x: -66, y: -110, width: 132, height: 24, rx: 12, fill: COL.system }, app);
  S('rect', { x: -50, y: -74, width: 40, height: 30, rx: 5, fill: '#dbe4ff' }, app);
  S('rect', { x: -2, y: -74, width: 52, height: 14, rx: 5, fill: '#dbe4ff' }, app);
  S('rect', { x: -2, y: -54, width: 52, height: 14, rx: 5, fill: '#dbe4ff' }, app);
  S('rect', { x: -50, y: -32, width: 100, height: 14, rx: 5, fill: COL.accent }, app);
  var proofFolder = S('g', {}, item);
  S('rect', { x: 40, y: -30, width: 56, height: 40, rx: 6, fill: '#e7f5ff', stroke: '#1864ab', 'stroke-width': 4 }, proofFolder);
  S('text', { x: 68, y: -4, 'text-anchor': 'middle', style: 'font-size:14px;font-weight:700', fill: '#1864ab' }, proofFolder, 'preuves');

  /* ---------- Cycle de vie, légendes ---------- */
  var lifecycle = [
    ['Besoin', 0, 9], ['Contrôle d\'entrée', 9, 19], ['Plan', 19, 30], ['Prêt à lancer', 30, 34], ['Lancé', 34, 38],
    ['Fabrication', 38, 62], ['Contrôle de sortie', 62, 74], ['Relecture humaine', 74, 86], ['Livré', 86, 93],
  ];
  var statesEl = document.getElementById('states');
  var phases = PharePlayer.phases(statesEl, lifecycle.map(function (s) { return s[0]; }), function (i) {
    var tv = phaseStart(state.variant, i);
    if (tv !== null) seek(tv);
  });
  var humanEvents = [3, 32, 83];
  var checkEvents = [10.5, 12, 13.5, 15, 16.5, 63.5, 64.5, 65.5, 70, 80];

  var captions = [
    { t: 0, title: 'Un besoin arrive', sub: 'Du code livré avec ses preuves, relu par un humain. Ici un Product Owner choisit les tickets, un designer dépose les maquettes : des humains décident quoi fabriquer.', mod: 'portail' },
    { t: 7, title: 'Le dossier est figé', sub: 'On fige exactement ce qui sera fabriqué : plus rien ne change en cours de route.', mod: 'portail' },
    { t: 9, title: 'Contrôle d\'entrée', sub: 'Complet ? Piégé ? Données sensibles ? Quel niveau de confidentialité (C0 à C3) ? Quels droits ? Tout est vérifié avant de produire.', mod: 'entree' },
    { t: 19, title: 'L\'usine établit seule le plan et les tests prévus', sub: 'Un robot planificateur rédige le plan, décrit les tests avant le code et estime le coût. Aucune validation humaine à cette étape.', mod: 'plan' },
    { t: 30, title: 'Le chef de projet signe le GO', sub: 'Seul acte humain de la planification : il lit le plan chiffré et signe. Le feu vert est lié à la version exacte du dossier.', mod: 'plan' },
    { t: 34, title: 'Dossier figé, clé plafonnée', sub: 'La fabrication part d\'une version figée, avec une clé temporaire dont la dépense est plafonnée.', mod: 'plan' },
    { t: 38, title: 'Des agents IA construisent, en cellule isolée', sub: 'Un testeur, un constructeur, un relecteur travaillent dans une cellule fermée, guidés par des règles communes (connexion, design, langage du projet).', mod: 'sandbox' },
    { t: 41, title: 'Un seul passage vers le modèle d\'IA', sub: 'La cellule n\'a pas d\'internet libre : l\'agent joint son modèle par une passerelle surveillée, qui refuse aussi la recherche web menée par le fournisseur. Pour un projet très confidentiel, seuls les modèles internes sont permis.', mod: 'router' },
    { t: 45, title: 'Deux modèles, deux tâches, en parallèle', sub: 'Le testeur et le constructeur n\'utilisent pas le même modèle (ici Claude et Kimi, à titre d\'exemple) : ils travaillent en même temps.', mod: 'router' },
    { t: 56, title: 'Un relecteur indépendant', sub: 'La relecture est confiée à un autre modèle (ici Codex) que celui qui a écrit le code. Elle reste consultative.', mod: 'sandbox' },
    { t: 62, title: 'Contrôle de sortie', sub: 'Tests, banc d\'essai (on introduit des défauts pour vérifier que les tests les attrapent), sécurité, secrets : des vérificateurs indépendants des agents contrôlent le résultat.', mod: 'sortie' },
    { t: 66.5, title: 'Un défaut ? Une autocorrection bornée', sub: 'Un secret est détecté : un seul essai de correction, puis le contrôle repasse. Au-delà, l\'équipe plateforme est appelée.', mod: 'sortie' },
    { t: 70, title: 'Le dossier de preuves', sub: 'Tout ce qui a été vérifié est assemblé pour que l\'ingénieur puisse juger vite et bien.', mod: 'sortie' },
    { t: 74, title: 'Direction GitLab', sub: 'La demande de fusion (Merge Request) est ouverte, la chaîne automatique de GitLab tourne.', mod: 'forge' },
    { t: 80, title: 'Un ingénieur relit et approuve', sub: 'L\'IA n\'approuve jamais seule. Deux ingénieurs distincts si le projet est sensible.', mod: 'forge' },
    { t: 86, title: 'Livré', sub: 'La fusion et le déploiement relèvent de GitLab. Rien ne part sans un humain.', mod: 'prod' },
  ];


  /* ---------- Scénarios de la visite : même usine, autres issues ---------- */
  var statesAbort = document.createElement('span');
  statesAbort.className = 'state';
  statesAbort.textContent = 'Abandonné';
  statesAbort.hidden = true;
  statesEl.appendChild(statesAbort);

  var refuseStamp = S('g', {}, svg);
  S('rect', { x: 1020, y: 296, width: 320, height: 50, rx: 8, fill: '#fff', stroke: COL.guard, 'stroke-width': 6 }, refuseStamp);
  S('text', { x: 1180, y: 331, 'text-anchor': 'middle', style: 'font-size:24px;font-weight:800', fill: COL.guard }, refuseStamp, 'REFUSÉ : consigne cachée');
  var koStamp = S('g', {}, svg);
  S('rect', { x: 4500, y: 340, width: 290, height: 54, rx: 8, fill: '#fff', stroke: COL.guard, 'stroke-width': 6 }, koStamp);
  S('text', { x: 4645, y: 376, 'text-anchor': 'middle', style: 'font-size:22px;font-weight:800', fill: COL.guard }, koStamp, 'ARRÊTÉ : tests faibles');
  var stuckTag = S('g', {}, svg);
  S('rect', { x: 3670, y: 268, width: 220, height: 30, rx: 15, fill: COL.guard }, stuckTag);
  S('text', { x: 3780, y: 289, 'text-anchor': 'middle', style: 'font-size:16px;font-weight:800', fill: '#fff' }, stuckTag, 'Boucle : même échec ×6');
  var stuckLed = S('circle', { cx: 3808, cy: 360, r: 5.5, fill: COL.guard }, svg);
  var packet = S('g', {}, svg);
  S('rect', { x: -14, y: -10, width: 28, height: 20, rx: 3, fill: '#fff4e6', stroke: COL.human, 'stroke-width': 3 }, packet);
  S('line', { x1: -8, y1: -3, x2: 8, y2: -3, stroke: COL.human, 'stroke-width': 3 }, packet);
  S('line', { x1: -8, y1: 3, x2: 4, y2: 3, stroke: COL.human, 'stroke-width': 3 }, packet);
  /* Le mécanicien de l'usine : équipe plateforme, casque et clé */
  var mech = S('g', { transform: 'translate(3878,' + (BELT - 4) + ')' }, svg);
  S('line', { x1: -9, y1: -16, x2: -11, y2: 0, stroke: '#343a40', 'stroke-width': 7, 'stroke-linecap': 'round' }, mech);
  S('line', { x1: 9, y1: -16, x2: 11, y2: 0, stroke: '#343a40', 'stroke-width': 7, 'stroke-linecap': 'round' }, mech);
  S('rect', { x: -22, y: -72, width: 44, height: 58, rx: 12, fill: COL.blue }, mech);
  S('circle', { cx: 0, cy: -92, r: 18, fill: '#ffd8a8', stroke: COL.blue, 'stroke-width': 4 }, mech);
  S('path', { d: 'M-21 -94 a21 21 0 0 1 42 0 z', fill: COL.accent, stroke: '#1f2430', 'stroke-width': 2 }, mech);
  var mechArm = S('line', { x1: 20, y1: -60, x2: 44, y2: -76, stroke: COL.blue, 'stroke-width': 9, 'stroke-linecap': 'round' }, mech);
  S('path', { d: 'M44 -76 l12 -12 m-4 -4 a8 8 0 1 1 8 8', fill: 'none', stroke: '#495057', 'stroke-width': 5, 'stroke-linecap': 'round' }, mech);
  S('rect', { x: -78, y: -150, width: 156, height: 28, rx: 14, fill: '#fff', stroke: COL.blue, 'stroke-width': 2 }, mech);
  S('text', { x: 0, y: -130, 'text-anchor': 'middle', class: 'plabel' }, mech, 'Équipe plateforme');

  function cut(list, tMax) { return list.filter(function (c) { return c.t <= tMax; }); }
  function shifted(list, tMin, d) { return list.filter(function (c) { return c.t > tMin; }).map(function (c) { return { t: c.t + d, title: c.title, sub: c.sub, mod: c.mod }; }); }
  function patch(list, p) { return list.map(function (c) { return p[c.t] ? { t: c.t, title: p[c.t][0], sub: p[c.t][1], mod: c.mod } : c; }); }
  function plain(c) { return { t: c[0], title: c[1], sub: c[2], mod: c[3] }; }

  var NOM_TXT = { a: ['Claude', 'modèle cloud (exemple)', COL.ext], b: ['Kimi', 'modèle interne (exemple)', COL.system], r: ['Codex', 'autre que le constructeur', COL.ext],
    ex: 'exemples seulement', cell: 'Cellule isolée', chip: 'Niveau C1', stamp: 'APPROUVÉ' };
  var C3_TXT = { a: ['Kimi', 'modèle interne (exemple)', COL.system], b: ['Mistral', 'modèle interne (exemple)', COL.system], r: ['Kimi', 'indépendance réduite', COL.system],
    ex: 'Claude, Codex : interdits', cell: 'Cellule renforcée (N3)', chip: 'Niveau C3', stamp: '2 × APPROUVÉ' };
  function applyTxt(x) {
    [[cloudA, x.a], [cloudB, x.b], [cloudA2, x.r]].forEach(function (p) {
      p[0].n.textContent = p[1][0]; p[0].u.textContent = p[1][1]; p[0].r.setAttribute('stroke', p[1][2]);
    });
    exLabel.textContent = x.ex; cellLabel.textContent = x.cell; chipText.textContent = x.chip; stampText.textContent = x.stamp;
  }
  function grey(l) { l.setAttribute('fill', '#adb5bd'); }
  function red(l) { l.setAttribute('fill', COL.guard); }
  var idMap = function (tv) { return tv; };

  var VARIANTS = {
    nominal: { name: 'Nominal : un projet de bout en bout', T: 92, map: idMap, caps: captions, overlay: function () {}, preset: null },
    piege: {
      name: 'Ticket piégé : refusé à l\'entrée', T: 30, preset: 'injection', abortAt: 14,
      map: function (tv) { return Math.min(tv, 12.4); },
      caps: cut(captions, 9).concat([
        plain([11.5, 'Consigne cachée détectée', 'Un ticket contient une instruction déguisée (« ignore tes règles… »). Un ticket dit quoi construire, jamais comment l\'agent se comporte : il est refusé.', 'entree']),
        plain([14, 'Le dossier revient avec son motif', 'Rien n\'est fabriqué. Le Product Owner reçoit le motif et corrige le ticket : l\'usine ne continue jamais dans le doute.', 'portail']),
        plain([22, 'Refus tracé', 'Le refus est consigné dans le journal d\'audit : qui, quand, pourquoi. Aucune ressource de fabrication n\'a été consommée.', 'portail'])]),
      checks: function (tv, n) { return tv >= 11.5 ? 1 : n; },
      overlay: function (tv, t) {
        if (tv >= 11.5) { red(entryLights[1]); grey(entryLights[2]); grey(entryLights[3]); grey(entryLights[4]); }
        show(refuseStamp, tv >= 12.5);
        var back = seg(tv, 14, 20), x0 = itemX(t);
        item.setAttribute('transform', 'translate(' + (x0 + (700 - x0) * back) + ',' + BELT + ') scale(1)');
        sealOk.setAttribute('fill', tv >= 11.5 ? COL.guard : COL.ok);
        if (tv >= 12.5) { outCards[1].mark.textContent = 'refusé'; outCards[1].mark.setAttribute('fill', COL.guard); outCards[1].r.setAttribute('fill', '#fff5f5'); }
        state.focusX = x0 + (700 - x0) * back;
      },
    },
    'sortie-ko': {
      name: 'Contrôle de sortie en échec', T: 84, preset: 'mutation', abortAt: 70,
      map: function (tv) { return Math.min(tv, 66); },
      caps: cut(captions, 62).concat([
        plain([64.5, 'Banc d\'essai : un défaut n\'est pas vu', 'On introduit un défaut exprès dans le code : les tests ne le détectent pas. Ces tests ne prouvent donc rien.', 'sortie']),
        plain([66, 'Autocorrection bornée : un seul essai', 'Les tests sont renforcés une fois, puis le contrôle repasse. Pas de boucle sans fin.', 'sortie']),
        plain([70, 'Toujours insuffisant : fabrication arrêtée', 'L\'équipe plateforme est appelée. Aucune demande de fusion n\'est ouverte : le code n\'est pas livré.', 'escalade']),
        plain([76, 'Rien n\'est livré, tout est expliqué', 'Dans le doute, on s\'arrête. Le dossier de preuves et le journal d\'audit disent pourquoi.', 'sortie'])]),
      checks: function (tv, n) { return tv >= 64.5 ? 6 : n; },
      overlay: function (tv) {
        if (tv >= 64.5) {
          if (tv >= 66 && tv < 70) exitLights[1].setAttribute('fill', COL.accent); else red(exitLights[1]);
          grey(exitLights[2]); grey(exitLights[3]);
        }
        show(autoFix, tv >= 66 && tv < 70);
        show(koStamp, tv >= 70);
        if (tv >= 70) { outCards[5].mark.textContent = 'arrêté'; outCards[5].mark.setAttribute('fill', COL.guard); outCards[5].r.setAttribute('fill', '#fff5f5'); }
      },
    },
    c3: {
      name: 'Projet confidentiel (C3)', T: 92, preset: 'c3',
      map: idMap,
      caps: patch(captions, {
        9: ['Contrôle d\'entrée : niveau C3', 'Projet très confidentiel : le niveau n\'est jamais abaissé automatiquement. Il décide des modèles permis, du blindage de la cellule et du nombre d\'approbateurs.'],
        38: ['Des agents IA construisent, en cellule renforcée', 'Isolation maximale (N3). Seuls des modèles internes, auto-hébergés, sont permis : les modèles cloud sont interdits pour ce niveau.'],
        41: ['Un seul passage, vers un modèle interne', 'La passerelle n\'a pas le droit de joindre un modèle cloud pour un projet C3 : la requête serait refusée, même si l\'agent la demandait.'],
        45: ['Deux modèles internes : indépendance réduite', 'Avec seulement des modèles internes, le relecteur est moins indépendant du constructeur. PHARE le consigne dans le dossier de preuves.'],
        80: ['Deux ingénieurs distincts approuvent', 'Niveau C3 : deux approbateurs, jamais la personne qui a lancé la fabrication. L\'IA n\'approuve jamais.'] }),
      overlay: function () {},
    },
    meca: {
      name: 'Agent bloqué : le mécanicien intervient', T: 106, preset: 'boucle',
      map: function (tv) { return tv < 50 ? tv : (tv < 64 ? 50 : tv - 14); },
      caps: cut(captions, 45).concat([
        plain([50, 'La boucle tourne en rond', 'Le constructeur répète le même échec : l\'orchestrateur le détecte et arrête la tâche. Un agent ne peut pas s\'auto-réparer sans limite.', 'sandbox']),
        plain([54, 'Escalade vers l\'équipe plateforme', 'Un paquet lisible part vers le mécanicien de l\'usine : état, essais, coût, dernière erreur.', 'escalade']),
        plain([58, 'Le mécanicien diagnostique et relance', 'Il relance la tâche dans le périmètre du plan figé (autre modèle autorisé, contexte reconstruit). Il ne peut ni élargir le périmètre ni approuver.', 'escalade']),
        plain([64, 'La fabrication reprend', 'Même plan, même budget plafonné, mêmes contrôles : l\'intervention est tracée dans le journal d\'audit.', 'escalade'])]
        ).concat(shifted(captions, 50, 14)),
      overlay: function (tv) {
        var stuck = tv >= 52 && tv < 64;
        show(stuckTag, stuck); show(stuckLed, stuck);
        show(mech, tv >= 56 && tv < 68);
        mechArm.setAttribute('y2', -76 + 8 * Math.sin(tv * 7));
        show(packet, tv >= 54 && tv < 58);
        var u = seg(tv, 54, 58);
        packet.setAttribute('transform', 'translate(' + (3780 + 98 * u) + ',' + (420 - 90 * Math.sin(u * Math.PI)) + ')');
        if (tv >= 50 && tv < 68) state.focusX = 3700;
      },
    },
  };

  VARIANTS.nominal.blurb = 'Un projet traverse toute la chaîne, du besoin à la livraison.';
  VARIANTS.piege.blurb = 'Une consigne cachée dans un ticket est détectée : rien n\'est fabriqué.';
  VARIANTS['sortie-ko'].blurb = 'Les tests sont trop faibles : la fabrication est arrêtée, rien n\'est livré.';
  VARIANTS.c3.blurb = 'Projet très confidentiel : modèles internes seuls, cellule renforcée, deux approbateurs.';
  VARIANTS.meca.blurb = 'Un agent tourne en rond : l\'équipe plateforme intervient, la fabrication reprend.';
  var ORDER = ['nominal', 'piege', 'sortie-ko', 'c3', 'meca'];

  /* ---------- Trajectoire du colis ---------- */
  var way = [[0, 360], [3.5, 360], [7, 700], [9, 930], [11, 1100], [18, 1500], [19, 1660], [30, 2420], [33, 2700], [37, 3060], [40, 3620], [61, 3640],
    [62, 4180], [66, 4440], [73, 4900], [76, 5250], [84, 5800], [86, 6050], [92, 6050]];
  function itemX(t) {
    for (var i = 1; i < way.length; i++) {
      if (t <= way[i][0]) {
        var a = way[i - 1], b = way[i];
        return a[1] + (b[1] - a[1]) * (t - a[0]) / Math.max(b[0] - a[0], 1e-6);
      }
    }
    return way[way.length - 1][1];
  }
  var beltTop = BELT;

  /* ---------- Rendu d'un instant ---------- */
  var state = { busy: false, variant: 'nominal', t: 0, playing: false, speed: 1, emergency: false, hold: 0, focusX: 0 };

  function render(tv) {
    var V = VARIANTS[state.variant], t = V.map(tv);
    var ix = itemX(t);
    var truckX = t < 80 ? 6900 : (t < 84 ? 6900 - 780 * seg(t, 80, 84) : (t < 88 ? 6120 : 6120 + 1100 * seg(t, 88, 92)));
    var inTruck = t >= 86;

    /* Réception */
    var drop = seg(t, 0.5, 3.5);
    show(crateT, t < 3.5);
    crateT.setAttribute('transform', 'translate(' + (190 + 135 * drop) + ',' + (DECK - 60 + (BELT - DECK + 60) * drop) + ')');
    show(crateM, t < 3.5);
    crateM.setAttribute('transform', 'translate(' + (560 - 125 * drop) + ',' + (DECK - 60 + (BELT - DECK + 60) * drop) + ')');
    po.arm.setAttribute('y2', -44 - 30 * Math.sin(seg(t, 0.5, 3) * Math.PI));
    ux.arm.setAttribute('y2', -44 - 30 * Math.sin(seg(t, 0.5, 3) * Math.PI));
    po.aura.setAttribute('opacity', within(t, 0.5, 8) ? 0.7 : 0);
    ux.aura.setAttribute('opacity', within(t, 0.5, 8) ? 0.7 : 0);

    /* Colis */
    var asDossier = t >= 3.5 && t < 40;
    var asApp = t >= 62 && t < 92;
    item.setAttribute('transform', 'translate(' + (inTruck ? truckX - 30 : ix) + ',' + (inTruck ? BELT - 30 : BELT) + ') scale(' + (inTruck ? 0.7 : 1) + ')');
    show(item, asDossier || asApp);
    show(dossier, asDossier);
    show(sealOk, t >= 5.5);
    show(chip, t >= 17);
    show(app, asApp);
    show(proofFolder, t >= 74);

    /* Contrôle d'entrée */
    entryLights.forEach(function (l, i) {
      l.setAttribute('fill', t >= checkEvents[i] ? COL.ok : (within(t, 9.5, 10.5 + i * 1.5) ? COL.accent : '#adb5bd'));
    });

    /* Bureau d'études */
    var unroll = seg(t, 19, 22);
    planRect.setAttribute('width', 180 * unroll);
    planLines.forEach(function (ln, i) { ln.setAttribute('x2', 1876 + (150 - i * 30) * seg(t, 19.5 + i * 0.6, 21.5 + i * 0.6)); });
    show(planLabel, t >= 19);
    var tUnroll = seg(t, 22, 25);
    testsRect.setAttribute('width', 170 * tUnroll);
    show(testsLabel, t >= 22);
    testsLines.forEach(function (c, i) { show(c, t >= 24.5 + i * 0.8); });
    show(budgetTag, t >= 23);
    var plans = within(t, 19, 28);
    planner.armL.setAttribute('y2', -52 + (plans ? 16 * Math.sin(t * 6) : 0));
    planner.armR.setAttribute('y2', -52 - (plans ? 16 * Math.sin(t * 6) : 0));

    /* Feu vert */
    goBtn.setAttribute('transform', 'translate(0,' + (within(t, 31, 33) ? 8 : 0) + ')');
    chef.arm.setAttribute('x2', within(t, 30, 33) ? 62 : 42);
    chef.arm.setAttribute('y2', within(t, 30, 33) ? -20 : -44);
    chef.aura.setAttribute('opacity', within(t, 30, 34) ? 0.7 : 0);
    show(goLabel, t >= 33);
    show(seal, t >= 34);
    show(keyTag, t >= 36);

    /* Atelier */
    var testing = within(t, 38, 56), building = within(t, 45, 58), reviewing = within(t, 56, 61);
    var work = within(t, 38, 61);
    var k = function (i) { return Math.sin(t * 6 + i * 1.7); };
    rT.armL.setAttribute('y2', -52 + (testing ? 16 * k(0) : 0)); rT.armR.setAttribute('y2', -52 - (testing ? 16 * k(0) : 0));
    rC.armL.setAttribute('y2', -52 + (building ? 16 * k(1) : 0)); rC.armR.setAttribute('y2', -52 - (building ? 16 * k(1) : 0));
    rR.armL.setAttribute('y2', -52 + (reviewing ? 16 * k(2) : 0)); rR.armR.setAttribute('y2', -52 - (reviewing ? 16 * k(2) : 0));
    var pb = seg(t, 45, 58);
    show(build, t >= 45 && t < 62);
    bBack.setAttribute('opacity', pb > 0.3 ? 1 : 0);
    bFront.setAttribute('opacity', pb > 0.6 ? 1 : 0);
    bTop.setAttribute('opacity', pb > 0.85 ? 1 : 0);
    buildPct.textContent = within(t, 45, 62) ? Math.round(Math.min(1, pb) * 100) + ' %' : '';
    cloudA.setAttribute('opacity', testing ? 1 : 0.3);
    cloudB.setAttribute('opacity', building ? 1 : 0.3);
    cloudA2.setAttribute('opacity', reviewing ? 1 : 0.3);
    linkA.setAttribute('opacity', testing && Math.floor(t * 3) % 2 === 0 ? 1 : (testing ? 0.5 : 0));
    linkB.setAttribute('opacity', building && Math.floor(t * 3) % 2 === 0 ? 1 : (building ? 0.5 : 0));
    linkA2.setAttribute('opacity', reviewing ? 1 : 0);
    show(parTag, within(t, 45, 56));
    show(frozen, t >= 44);
    books.forEach(function (g, i) {
      var pulse = building && Math.floor(t * 1.2) % 4 === i;
      g.setAttribute('opacity', work ? (pulse ? 1 : 0.55) : 0.3);
    });
    var bud = t < 38 ? 0.05 * seg(t, 34, 38) : (t < 62 ? 0.08 + 0.5 * seg(t, 38, 62) : 0.58 + 0.06 * seg(t, 62, 80));
    budgetFill.setAttribute('width', 120 * Math.min(1, bud));
    show(budget, t >= 34);

    /* Contrôle de sortie */
    exitLights.forEach(function (l, i) {
      var col = '#adb5bd';
      if (i < 3 && t >= checkEvents[5 + i]) col = COL.ok;
      if (i === 3) {
        if (t >= 70) col = COL.ok;
        else if (t >= 66.5) col = COL.guard;
        else if (within(t, 65.5, 66.5)) col = COL.accent;
      }
      if (i < 3 && col === '#adb5bd' && within(t, 62.5 + i, 63.5 + i)) col = COL.accent;
      l.setAttribute('fill', col);
    });
    show(autoFix, within(t, 66.5, 70));
    sheets.forEach(function (s, i) { show(s, t >= 70.5 + i * 1.5); });
    show(proofs, t >= 70.5);

    /* Quai */
    show(mrTag, t >= 75);
    ci.setAttribute('transform', 'translate(5440,262) rotate(' + (within(t, 76, 80) ? (t - 76) * 260 : 0) + ')');
    ci.setAttribute('opacity', t >= 75 && t < 80 ? 1 : (t >= 80 ? 0 : 0.35));
    show(ciOk, t >= 80);
    ing.arm.setAttribute('y2', within(t, 81, 84) ? -92 : -44);
    ing.aura.setAttribute('opacity', within(t, 80, 86) ? 0.7 : 0);
    show(stamp, t >= 83);

    /* Livraison */
    truck.setAttribute('transform', 'translate(' + truckX + ',' + (BELT - 4) + ')');
    show(delivered, t >= 88);
    show(deliveredSub, t >= 88);

    /* Sorties d'étape */
    /* Avant le lancement (en pause au tout début) : aucune étape n'est « en cours », rien n'est en orange */
    var idle = !state.playing && state.t < 0.05;
    outCards.forEach(function (c) {
      var done = t >= c.t1, cur = !idle && t >= c.t0 && t < c.t1;
      c.g.setAttribute('opacity', done || cur ? 1 : 0.45);
      c.r.setAttribute('fill', done ? '#ebfbee' : (cur ? '#fff9db' : '#fff'));
      c.mark.textContent = done ? '✓ produit' : (cur ? 'en cours' : '');
      c.mark.setAttribute('fill', done ? COL.ok : COL.accent);
    });

    /* Scénarios : textes propres au cas, puis éléments qui prennent le pas sur la visite nominale */
    state.focusX = inTruck ? truckX : ix;
    [stuckTag, stuckLed, mech, packet, refuseStamp, koStamp].forEach(function (e) { show(e, false); });
    applyTxt(state.variant === 'c3' ? C3_TXT : NOM_TXT);
    V.overlay(tv, t);

    /* Interface */
    var nCheck = checkEvents.filter(function (e) { return t >= e; }).length;
    document.getElementById('c-human').textContent = humanEvents.filter(function (e) { return t >= e; }).length;
    document.getElementById('c-check').textContent = V.checks ? V.checks(tv, nCheck) : nCheck;
    var cap = V.caps[0];
    V.caps.forEach(function (c) { if (tv >= c.t) cap = c; });
    document.getElementById('cap-title').textContent = cap.title;
    document.getElementById('cap-sub').textContent = cap.sub;
    var link = document.getElementById('cap-link');
    if (V.preset) { link.href = 'simulateur.html#s=' + V.preset; link.textContent = 'Rejouer ce cas dans le simulateur'; }
    else { link.href = 'simulateur.html#key=' + cap.mod; link.textContent = 'Voir ce composant dans le simulateur'; }
    var aborted = V.abortAt !== undefined && tv >= V.abortAt;
    var cur = 0;
    lifecycle.forEach(function (s, i) { if (t >= s[2]) cur = i + 1; });
    phases.paint(cur, phaseAvail(state.variant), aborted || idle);
    statesAbort.hidden = V.abortAt === undefined;
    statesAbort.className = 'state' + (aborted ? ' current' : '');
    document.getElementById('scrub').value = Math.round(tv * 10);
    PharePlayer.setClock(tv, T);
  }

  /* ---------- Taille et caméra ---------- */
  var scale = 1;
  function resize() {
    var h = viewport.clientHeight || 600;
    scale = h / H;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('height', h);
    svg.setAttribute('width', W * scale);
  }
  function follow(dt) {
    if (!state.playing) return;
    var target = state.focusX * scale - viewport.clientWidth * 0.42;
    target = Math.max(0, Math.min(W * scale - viewport.clientWidth, target));
    viewport.scrollLeft += (target - viewport.scrollLeft) * Math.min(1, dt * 4);
  }

  /* ---------- Lecture, pause, interruptions ---------- */
  var playBtn = document.getElementById('play');
  var banner = document.getElementById('banner');

  function setPlaying(p) {
    state.playing = p;
  }
  /* Fin de visite : la lecture s'arrête, rien ne repart seul ; le bouton central (« Rejouer ») ou la barre d'espace relance depuis le début. */
  function togglePlay() {
    if (state.emergency) { setEmergency(false); return; }
    if (!state.playing && state.t >= T) { state.t = 0; state.hold = 0; }
    setPlaying(!state.playing);
  }
  function interrupt() { if (state.playing) setPlaying(false); }
  function setEmergency(on) {
    state.emergency = on;
    banner.hidden = !on;
    viewport.classList.toggle('stopped', on);
    document.getElementById('stop').classList.toggle('latched', on);
    if (on) setPlaying(false); else setPlaying(true);
  }

  playBtn.addEventListener('click', function () { togglePlay(); });
  document.getElementById('stop').addEventListener('click', function () { setEmergency(!state.emergency); });
  PharePlayer.onSpeed(function (v) { state.speed = v; });
  var scrub = document.getElementById('scrub');
  /* Étapes cliquables : instant le plus tôt du scénario où l'étape est atteinte (null = absente de ce scénario) */
  var phaseMemo = {};
  function phaseStart(v, i) {
    var key = v + ':' + i;
    if (!(key in phaseMemo)) {
      var Vv = VARIANTS[v], r = null;
      for (var tv = 0; tv <= Vv.T + 1e-6; tv += 0.1) { if (Vv.map(tv) >= lifecycle[i][1] - 1e-6) { r = Math.round(tv * 10) / 10; break; } }
      phaseMemo[key] = r;
    }
    return phaseMemo[key];
  }
  function phaseAvail(v) { return lifecycle.map(function (s, i) { return phaseStart(v, i) !== null; }); }

  /* Chapitres = les légendes du scénario courant : précédent / suivant sautent d'un chapitre à l'autre, sans changer l'état de lecture. */
  function focusNow() {
    viewport.scrollLeft = Math.max(0, Math.min(W * scale - viewport.clientWidth, state.focusX * scale - viewport.clientWidth * 0.42));
  }
  function seek(t) {
    state.t = Math.max(0, Math.min(T, t)); state.hold = 0;
    render(state.t);
    focusNow();
  }
  function chapterStep(dir) {
    var caps = VARIANTS[state.variant].caps, t = state.t, i, cur = 0;
    for (i = 0; i < caps.length; i++) if (caps[i].t <= t) cur = i;
    if (dir > 0) seek(cur + 1 < caps.length ? caps[cur + 1].t : T);
    else seek(t - caps[cur].t > 1.5 || cur === 0 ? caps[cur].t : caps[cur - 1].t);
  }
  document.getElementById('prev').addEventListener('click', function () { chapterStep(-1); });
  document.getElementById('next').addEventListener('click', function () { chapterStep(1); });
  scrub.addEventListener('input', function () { seek(scrub.value / 10); });

  var drag = null;
  viewport.addEventListener('pointerdown', function (e) {
    interrupt();
    drag = { x: e.clientX, left: viewport.scrollLeft };
    viewport.classList.add('dragging');
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', function (e) { if (drag) viewport.scrollLeft = drag.left - (e.clientX - drag.x); });
  function endDrag() { drag = null; viewport.classList.remove('dragging'); }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('wheel', function (e) {
    interrupt();
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { viewport.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
  document.addEventListener('keydown', function (e) {
    if (/^(INPUT|SELECT|BUTTON)$/.test(e.target.tagName) && e.key === ' ') return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') chapterStep(1);
    else if (e.key === 'ArrowLeft') chapterStep(-1);
  });
  window.addEventListener('resize', resize);

  /* ---------- Boucle principale ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (state.playing && !state.busy) {
      if (state.t >= T) {
        /* Enchaînement automatique des scénarios : courte pause sur l'issue, puis le scénario suivant, en boucle. */
        state.hold += dt;
        if (state.hold > 2.5) { state.hold = 0; switchVariant(ORDER[(ORDER.indexOf(state.variant) + 1) % ORDER.length]); }
      } else {
        state.t = Math.min(T, state.t + dt * state.speed);
      }
    }
    render(state.t);
    PharePlayer.setState(state.playing ? 'playing' : (state.t >= T ? 'ended' : 'paused'));
    if (!state.busy) follow(dt);
    beltPat.setAttribute('patternTransform', 'translate(' + ((state.t * 54) % 48) + ',0)');
    requestAnimationFrame(frame);
  }

  function setVariant(v) {
    if (!VARIANTS[v]) v = 'nominal';
    state.variant = v;
    T = VARIANTS[v].T;
    document.getElementById('scrub').max = Math.round(T * 10);
    PharePlayer.setScenario(v);
  }
  /* Écran-titre entre deux scénarios : masque le rechargement de la scène et annonce le suivant. */
  var overlay = document.getElementById('transition');
  function switchVariant(v) {
    if (!VARIANTS[v] || state.busy) return;
    state.busy = true;
    document.getElementById('t-count').textContent = 'Scénario ' + (ORDER.indexOf(v) + 1) + ' sur ' + ORDER.length;
    document.getElementById('t-title').textContent = VARIANTS[v].name;
    document.getElementById('t-sub').textContent = VARIANTS[v].blurb;
    overlay.classList.add('on');
    setTimeout(function () {
      setVariant(v);
      state.t = 0; state.hold = 0;
      render(0);
      viewport.scrollLeft = 0;
    }, 450);
    setTimeout(function () { overlay.classList.remove('on'); state.busy = false; }, 1900);
  }
  /* Choisir un scénario le charge au début, en pause : l'utilisateur lance la lecture */
  PharePlayer.scenarios(ORDER.map(function (k) { return { value: k, label: VARIANTS[k].name }; }), function (v) {
    if (state.emergency) setEmergency(false);
    setPlaying(false);
    switchVariant(v);
  });
  PharePlayer.setScenario(state.variant);
  var mv = /[#&]v=([a-z0-9-]+)/.exec(window.location.hash || '');
  if (mv) setVariant(mv[1]);

  document.getElementById('scrub').max = Math.round(T * 10);
  PharePlayer.cta(document.getElementById('stagewrap'), 'Lancer la visite');   /* le lecteur démarre en pause : le bouton invite à démarrer */
  resize();
  var m = /[#&]t=(\d+(\.\d+)?)/.exec(window.location.hash || '');
  if (m) { state.t = Math.min(T, parseFloat(m[1])); state.playing = false; }
  render(state.t);
  if (m) {
    focusNow();
  }
  requestAnimationFrame(frame);
})();
