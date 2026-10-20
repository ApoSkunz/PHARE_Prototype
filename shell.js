/* Éléments communs aux trois vues : barre de navigation et lecteur (précédent, lecture, suivant, curseur, temps, vitesses ×1 ×2 ×4).
   Une seule source : les trois pages affichent exactement la même barre et le même lecteur. Aucune dépendance. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  var VIEWS = [
    { href: 'index.html', title: 'Chaîne de production', sub: 'visite guidée', about: 'Visite guidée animée, du besoin à la livraison.',
      why: "Pour comprendre en deux minutes le trajet complet d'une demande dans PHARE, comme sur une chaîne d'usine.",
      see: ["8 stations : réception, contrôle d'entrée, bureau d'études, feu vert, atelier robotisé, contrôle de sortie, quai GitLab, livraison.",
        "Des humains aux points de décision, des agents IA enfermés dans une cellule isolée, un relecteur indépendant.",
        "Une demande de fusion livrée avec son dossier de preuves, relue par un humain."],
      how: "Lancez la visite et laissez défiler : cinq scénarios s'enchaînent (cas nominal, ticket piégé, contrôle de sortie en échec, projet confidentiel, agent bloqué). Cliquez sur une étape en haut pour y sauter.",
      who: 'Tout public, démonstration en salon.' },
    { href: 'simulateur.html', title: 'Simulateur', sub: 'jouer des scénarios et des pannes', about: 'Un tableau de bord où l\'on joue, règle et provoque des pannes.',
      why: 'Pour manipuler le fonctionnement de PHARE : lancer des scénarios, régler les paramètres, provoquer des pannes.',
      see: ["L'orchestrateur déterministe au centre, huit modules autour.",
        "16 scénarios prêts à jouer : création, feature, campagne, injection, secret, budget, projet confidentiel, arrêt d'urgence…",
        "Les décisions humaines, l'équipe plateforme, le journal d'audit et le bouton d'arrêt d'urgence."],
      how: "Choisissez un scénario en bas à droite, ajustez les paramètres dans l'onglet « Paramètres entrés », puis lancez la simulation. Cliquez sur un module pour le détailler.",
      who: 'Ingénieurs, DSI, architectes.' },
    { href: 'processus.html', title: 'Vue processus', sub: 'acteurs, dépendances, contrôles', about: 'Le détail technique de chaque étape.',
      why: 'Pour voir, étape par étape, qui intervient, de quoi dépend chaque étape et ce qui la contrôle.',
      see: ['Le schéma des acteurs, des systèmes, des gardes et des dépendances externes.',
        'Trois scénarios : création, feature sur application existante, campagne.',
        'Pour chaque étape : les dépendances techniques et les contrôles.'],
      how: "Lancez le processus et avancez étape par étape (flèches, curseur ou pastilles du haut). Le panneau de droite détaille l'étape en cours.",
      who: 'DSI, architectes, équipes plateforme.' },
  ];
  var SPEEDS = [1, 2, 4];
  var ICON = {
    prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
    next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    play: 'M8 5v14l11-7z',
    arrow: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    replay: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  };
  var STATE = {
    playing: { icon: 'pause', label: 'Pause' },
    paused: { icon: 'play', label: 'Lecture' },
    ended: { icon: 'replay', label: 'Rejouer' },
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function icon(name) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', ICON[name]);
    s.appendChild(p);
    return s;
  }
  function mmss(s) { s = Math.max(0, Math.floor(s)); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }

  /* ---------- Barre de navigation : la marque PHARE en tête, puis les trois vues ---------- */
  function buildHeader() {
    var host = document.getElementById('site-header');
    if (!host) return;
    var file = window.location.pathname.split('/').pop() || 'index.html';
    host.className = 'shell';
    host.setAttribute('role', 'banner');

    var brand = el('a', 'shell-brand');
    brand.href = 'index.html';
    brand.setAttribute('aria-label', 'PHARE, accueil');
    var logo = el('img', 'shell-logo-img');
    logo.src = 'phare_icon.svg';
    logo.alt = '';
    brand.appendChild(logo);
    var text = el('span', 'shell-brandtext');
    text.appendChild(el('span', 'shell-logo', 'PHARE'));
    var acro = el('span', 'shell-acro');
    [['P', 'lateforme '], ['H', 'ybride '], ['A', 'gentique de '], ['R', 'éalisation '], ['E', 'ncadrée']].forEach(function (w) {
      acro.appendChild(el('b', '', w[0]));
      acro.appendChild(document.createTextNode(w[1]));
    });
    text.appendChild(acro);
    brand.appendChild(text);
    host.appendChild(brand);

    var nav = el('nav', 'shell-nav');
    nav.setAttribute('aria-label', 'Vues du prototype');
    VIEWS.forEach(function (v) {
      var a = el('a');
      a.href = v.href;
      a.appendChild(el('b', '', v.title));
      a.appendChild(el('span', '', v.sub));
      if (v.href === file) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    host.appendChild(nav);
    host.appendChild(el('span', 'shell-hint', 'Les trois vues décrivent le même PHARE'));
  }

  /* ---------- Lecteur ---------- */
  var listeners = [];
  var playBtn = null, clockEl = null, lastState = '', lastClock = '', speedBtns = [];
  var speed = 1;
  var ctaEl = null, onbEl = null, onbClosed = false, lastCur = 0, ctaBlocked = false;
  var SEEN = 'phare-accueil-vu';
  var scenSel = null, scenPick = null, scenValue = '';

  function button(id, label, name, extra) {
    var b = el('button', 'pbtn' + (extra ? ' ' + extra : ''));
    b.type = 'button';
    b.id = id;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.appendChild(icon(name));
    return b;
  }

  function buildPlayer() {
    var slot = document.getElementById('player');
    if (!slot) return;
    slot.classList.add('player');
    slot.setAttribute('role', 'group');
    slot.setAttribute('aria-label', 'Lecteur de la démonstration');

    var frag = document.createDocumentFragment();
    frag.appendChild(button('prev', 'Étape précédente', 'prev'));
    playBtn = button('play', 'Pause', 'pause', 'main');
    frag.appendChild(playBtn);
    frag.appendChild(button('next', 'Étape suivante', 'next'));

    var scrub = el('input', 'pscrub');
    scrub.type = 'range';
    scrub.id = 'scrub';
    scrub.min = '0';
    scrub.max = '1000';
    scrub.value = '0';
    scrub.setAttribute('aria-label', 'Position dans le scénario');
    frag.appendChild(scrub);

    clockEl = el('span', 'pclock', '00:00 / 00:00');
    clockEl.id = 'clock';
    frag.appendChild(clockEl);

    var grp = el('span', 'pspeed');
    grp.setAttribute('role', 'group');
    grp.setAttribute('aria-label', 'Vitesse de lecture');
    SPEEDS.forEach(function (v) {
      var b = el('button', v === speed ? 'on' : '', '×' + v);
      b.type = 'button';
      b.setAttribute('data-speed', String(v));
      b.setAttribute('aria-pressed', v === speed ? 'true' : 'false');
      b.addEventListener('click', function () { api.setSpeed(v); });
      speedBtns.push(b);
      grp.appendChild(b);
    });
    frag.appendChild(grp);
    slot.insertBefore(frag, slot.firstChild);

    /* Zone de commandes à droite : scénario (toujours en tête), option propre à la vue (posée par la page), plein écran (toujours en fin) */
    var extras = slot.querySelector('.player-extras');
    if (!extras) { extras = el('div', 'player-extras'); slot.appendChild(extras); }
    var lab = el('label', 'pscen', 'Scénario ');
    scenSel = el('select');
    scenSel.id = 'scenario';
    scenSel.setAttribute('aria-label', 'Scénario');
    lab.appendChild(scenSel);
    extras.appendChild(lab);   /* après l'option propre à la vue, avant le plein écran : le sélecteur est au même endroit partout */
    scenSel.addEventListener('change', function () { if (scenPick) scenPick(scenSel.value); });

    if (document.fullscreenEnabled) {
      var full = el('button', 'pfull', 'Plein écran');
      full.type = 'button';
      full.id = 'full';
      full.addEventListener('click', function () {
        if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
      });
      extras.appendChild(full);
    }
  }

  /* Fenêtre d'accueil (modale), à la première arrivée : le but du prototype, puis une carte par vue à cliquer pour comprendre
     (la chaîne de production est présélectionnée), puis un bouton pour rejoindre l'application. La page derrière est floutée. */
  function closeOnboarding() {
    onbClosed = true;
    if (onbEl && !onbEl.hidden) onbEl.hidden = true;
  }

  function buildOnboarding() {
    /* Première arrivée seulement : le stockage navigateur est exclu dans ce prototype, on retient l'accueil déjà vu dans le nom de l'onglet
       (window.name survit à la navigation d'une vue à l'autre dans le même onglet, et disparaît avec lui). On n'écrase jamais un nom posé ailleurs. */
    if (window.name === SEEN) return;
    if (window.name === '') window.name = SEEN;
    var file = window.location.pathname.split('/').pop() || 'index.html';
    var screen = el('div', 'onb-screen');
    onbEl = screen;
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-label', 'Bienvenue sur le prototype PHARE');

    var modal = el('div', 'onb-modal');
    var body = el('div', 'onb-body');
    var inner = el('div', 'onb-inner');
    inner.appendChild(el('p', 'onb-kicker', 'Prototype de démonstration'));
    inner.appendChild(el('h2', 'onb-title', 'Bienvenue : comprendre PHARE en quelques minutes'));
    inner.appendChild(el('p', 'onb-why', "PHARE est une plateforme à l'étude : des agents IA fabriquent du logiciel sous contrôle, avec des humains aux points de décision. Ce prototype 2D n'exécute rien : il illustre le fonctionnement avec des valeurs fictives, pour en discuter. La conception documentée fait foi."));
    inner.appendChild(el('p', 'onb-ask', 'Trois vues décrivent le même PHARE. Cliquez sur chacune pour comprendre à quoi elle sert.'));

    var tabs = el('div', 'onb-tabs');
    tabs.setAttribute('role', 'tablist');
    var panel = el('div', 'onb-panel');
    panel.setAttribute('role', 'tabpanel');
    var seen = {};
    var count = el('span', 'onb-count');
    var tabEls = [];

    function showPanel(v, tab) {
      panel.textContent = '';
      panel.className = 'onb-panel on';
      panel.appendChild(el('h3', '', v.title));
      panel.appendChild(el('p', 'onb-lead', v.why));
      var cols = el('div', 'onb-cols');
      var c1 = el('div');
      c1.appendChild(el('h4', '', 'Ce que vous y verrez'));
      var ul = el('ul');
      v.see.forEach(function (t) { ul.appendChild(el('li', '', t)); });
      c1.appendChild(ul);
      var c2 = el('div');
      c2.appendChild(el('h4', '', 'Comment l\'utiliser'));
      c2.appendChild(el('p', '', v.how));
      c2.appendChild(el('h4', '', 'Pour qui'));
      c2.appendChild(el('p', '', v.who));
      cols.appendChild(c1);
      cols.appendChild(c2);
      panel.appendChild(cols);
      if (v.href !== file) {
        var go = el('a', 'onb-open', 'Ouvrir directement cette vue');
        go.href = v.href;
        panel.appendChild(go);
      }
      tabEls.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); t.classList.toggle('sel', t === tab); });
      seen[v.href] = true;
      tab.classList.add('seen');
      count.textContent = 'Vues découvertes : ' + Object.keys(seen).length + ' sur ' + VIEWS.length;
    }

    VIEWS.forEach(function (v) {
      var t = el('button', 'onb-tab');
      t.type = 'button';
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', 'false');
      t.appendChild(el('b', '', v.title));
      t.appendChild(el('span', '', v.about));
      if (v.href === file) t.appendChild(el('em', '', 'Vous êtes ici'));
      t.addEventListener('click', function () { showPanel(v, t); });
      tabEls.push(t);
      tabs.appendChild(t);
    });
    inner.appendChild(tabs);
    inner.appendChild(panel);
    showPanel(VIEWS[0], tabEls[0]);   /* la chaîne de production est présélectionnée : son texte est déjà affiché */
    body.appendChild(inner);
    modal.appendChild(body);

    var foot = el('div', 'onb-foot');
    foot.appendChild(count);
    var go2 = el('button', 'onb-go');
    go2.type = 'button';
    go2.appendChild(document.createTextNode("Rejoindre l'application"));
    go2.appendChild(icon('arrow'));
    go2.addEventListener('click', function () { closeOnboarding(); var c = document.getElementById('cta'); if (c) c.focus(); });
    foot.appendChild(go2);
    modal.appendChild(foot);
    screen.appendChild(modal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && onbEl && !onbEl.hidden) closeOnboarding(); });
    document.body.appendChild(screen);
    go2.focus();
  }

  /* Bouton de lancement : visible tant que la lecture est en pause au tout début, centré sur la scène (host) */
  function refreshCta() {
    if (!ctaEl) return;
    var show = lastState === 'paused' && lastCur < 0.05 && !ctaBlocked;
    if (ctaEl.hidden === show) ctaEl.hidden = !show;
  }

  var api = {
    /* host : la scène ; label : texte du bouton de lancement ; l'écran d'accueil (première arrivée) se pose aussi ici */
    cta: function (host, label) {
      host.classList.add('cta-host');
      var veil = el('div', 'cta-veil');
      var b = el('button', 'cta-btn');
      b.type = 'button';
      b.id = 'cta';
      b.appendChild(icon('play'));
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', function () { document.getElementById('play').click(); });
      veil.appendChild(b);
      host.appendChild(veil);
      ctaEl = veil;
      refreshCta();
      buildOnboarding();
    },
    blockCta: function (on) { ctaBlocked = !!on; refreshCta(); },
    /* 'playing' | 'paused' | 'ended' : l'icône du bouton central suit l'état de la lecture */
    setState: function (s) {
      if (!playBtn || !STATE[s] || s === lastState) return;
      lastState = s;
      if (s === 'playing') closeOnboarding();
      refreshCta();
      var d = STATE[s];
      playBtn.textContent = '';
      playBtn.appendChild(icon(d.icon));
      playBtn.title = d.label;
      playBtn.setAttribute('aria-label', d.label);
    },
    /* Temps écoulé et durée totale, en secondes */
    setClock: function (cur, total) {
      lastCur = cur;
      refreshCta();
      if (!clockEl) return;
      var t = mmss(cur) + ' / ' + mmss(total);
      if (t !== lastClock) { lastClock = t; clockEl.textContent = t; }
    },
    setSpeed: function (v) {
      if (SPEEDS.indexOf(v) < 0) return;
      speed = v;
      speedBtns.forEach(function (b) {
        var on = parseFloat(b.getAttribute('data-speed')) === v;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      listeners.forEach(function (fn) { fn(v); });
    },
    onSpeed: function (fn) { listeners.push(fn); },
    /* Choix du scénario : list = [{ value, label }], pick(value) est appelé quand l'utilisateur en choisit un */
    scenarios: function (list, pick) {
      if (!scenSel) return;
      scenPick = pick;
      scenSel.textContent = '';
      list.forEach(function (o) {
        var opt = el('option', '', o.label);
        opt.value = o.value;
        scenSel.appendChild(opt);
      });
      scenSel.value = scenValue;
    },
    setScenario: function (v) { scenValue = v; if (scenSel) scenSel.value = v; },
    speed: function () { return speed; },
    fmt: mmss,
  };
  /* Bandeau des étapes du cycle de vie : boutons cliquables, même composant sur les trois vues.
     pick(i) saute à l'étape i ; paint(cur, avail, none) colore : passées avant cur, courante = cur (sauf none),
     avail[i] faux = étape absente de ce scénario (bouton grisé). */
  api.phases = function (host, names, pick) {
    var els = names.map(function (n, i) {
      var b = el('button', 'state', n);
      b.type = 'button';
      b.addEventListener('click', function () { pick(i); });
      host.appendChild(b);
      return b;
    });
    return {
      paint: function (cur, avail, none) {
        els.forEach(function (b, i) {
          var cls = 'state' + (i < cur ? ' past' : '') + (i === cur && !none ? ' current' : '');
          if (b.className !== cls) b.className = cls;
          var off = !!avail && !avail[i];
          if (b.disabled !== off) b.disabled = off;
          if (i === cur && !none) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        });
      },
    };
  };
  window.PharePlayer = api;

  buildHeader();
  buildPlayer();
})();
