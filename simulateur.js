/* Simulateur PHARE : synoptique de l'usine (orchestrateur déterministe au centre, modules autour).
   Toute la scène est une fonction de l'état (entrées, étape, temps écoulé) : pause, pas à pas et saut sont exacts.
   Simulation illustrative : aucune valeur mesurée. Source de vérité : docs/conception/ et ADR. */
(function () {
  'use strict';
  window.addEventListener('error', function (e) { document.title = 'ERREUR : ' + e.message; });

  var NS = 'http://www.w3.org/2000/svg';
  var CX = 600, CY = 360, RX = 430, RY = 250;      /* anneau des modules */
  var TX = 270, TY = 170;                          /* tapis roulant (flux des dossiers) */
  var DR0 = 82, DR1 = 120;                         /* cadran de l'orchestrateur */
  var MW = 196, MH = 100;                          /* module */
  var COL = { human: '#ffa94d', system: '#9775fa', guard: '#ff6b6b', agent: '#4dabf7', ext: '#20c997', ok: '#51cf66', warn: '#fcc419', mute: '#93a1ba', line: '#2a3957', card: '#16213a', deep: '#0e1626', text: '#e6ecf7' };
  var STATES = ['Cadrage', 'Contrôle d\'entrée', 'Planification', 'Prêt à lancer', 'Lancé', 'Exécution', 'Contrôle de sortie', 'Revue dans GitLab', 'Fusionné (observé)'];
  var $ = function (id) { return document.getElementById(id); };
  var svg = $('map');

  function S(tag, a, parent, text) {
    var e = document.createElementNS(NS, tag);
    if (a) Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); });
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function H(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'text') e.textContent = props[k]; else if (k === 'class') e.className = props[k]; else e.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rad(d) { return d * Math.PI / 180; }
  function onRing(th) { return { x: CX + RX * Math.cos(rad(th)), y: CY + RY * Math.sin(rad(th)) }; }
  function onTrack(th) { return { x: CX + TX * Math.cos(rad(th)), y: CY + TY * Math.sin(rad(th)) }; }
  function mmss(s) { s = Math.max(0, Math.floor(s)); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); }
  function arc(r0, r1, a0, a1) {
    var p = function (r, a) { return (CX + r * Math.cos(rad(a))).toFixed(1) + ' ' + (CY + r * Math.sin(rad(a))).toFixed(1); };
    return 'M' + p(r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + p(r1, a1) + ' L' + p(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 0 0 ' + p(r0, a0) + ' Z';
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- Données de référence ---------- */
  var CLASSES = {
    C0: { iso: 'N2', appr: 1, models: ['A', 'B', 'I'], txt: 'C0 : tous les modèles, isolation N2, un approbateur.' },
    C1: { iso: 'N2', appr: 1, models: ['A', 'B', 'I'], txt: 'C1 : isolation N2, un approbateur (règles à fixer avec le RSSI).' },
    C2: { iso: 'N2', appr: 1, models: ['A', 'B', 'I'], txt: 'C2 : isolation N2, un approbateur (règles à fixer avec le RSSI).' },
    C3: { iso: 'N3', appr: 2, models: ['I'], txt: 'C3 : modèles internes seuls, isolation N3, deux approbateurs.' },
  };
  /* Noms d'exemple : PHARE est agnostique du modèle (invariant 11) ; ils se changent dans l'onglet Entrées. */
  var MODELS = { A: { n: 'Claude', s: 'cloud' }, B: { n: 'Codex', s: 'cloud' }, I: { n: 'Kimi', s: 'interne' } };
  var MODEL_CHOICES = { A: ['Claude', 'Gemini', 'Codex'], B: ['Claude', 'Gemini', 'Codex'], I: ['Kimi', 'Mistral'] };
  var STACKS = {
    'java-angular': { n: 'Java + Angular', note: 'gabarit du MVP', skills: ['Java', 'Angular'] },
    'python-react': { n: 'Python + React', note: 'illustratif, hors gabarit du MVP', skills: ['Python', 'React'] },
    'dotnet-angular': { n: '.NET + Angular', note: 'illustratif, hors gabarit du MVP', skills: ['.NET', 'Angular'] },
  };
  var CAPS = { serre: { n: 'serré', f: 0.55 }, normal: { n: 'normal', f: 1 }, large: { n: 'large', f: 1.8 } };
  var ROLES = {
    PO: { n: 'Product Owner', d: 'Choisit les tickets à embarquer. Ne valide ni le plan ni les tests par défaut.' },
    UX: { n: 'UX/UI designer', d: 'Dépose les maquettes (Figma ou document).' },
    CP: { n: 'Chef de projet', d: 'Lit le plan chiffré et signe le go : seul acte humain de la Planification. Jamais approbateur de la MR.' },
    ING: { n: 'Ingénieur logiciel', d: 'Relit et approuve la MR dans GitLab (deux approbateurs distincts en renforcé).' },
    RSSI: { n: 'RSSI ou adjoint', d: 'Règles de classe, arrêt d\'urgence, baisse de classe (l\'un des deux suffit).' },
    PLAT: { n: 'Ingénieur plateforme', d: 'Traite les escalades : reprendre, ajuster le budget dans sa délégation, abandonner.' },
  };
  var TRANS = [
    ['Cadrage', 'Contrôle d\'entrée', 'dossier déposé : tickets et maquettes', 'PO, UX'],
    ['Contrôle d\'entrée', 'Planification', 'complet ∧ sain ∧ RGPD conforme ∧ classe fixée ∧ modèle autorisé', 'contrôle d\'entrée'],
    ['Planification', 'Prêt à lancer', 'plan conforme aux règles de validité ∧ estimation produite', 'orchestrateur'],
    ['Prêt à lancer', 'Lancé', 'go signé ∧ dossier figé et signé ∧ cadre de revue vérifié', 'chef de projet'],
    ['Lancé', 'Exécution', 'cellule créée ∧ clé temporaire plafonnée', 'orchestrateur'],
    ['Exécution', 'Contrôle de sortie', 'livrable produit ∧ budget non dépassé', 'orchestrateur'],
    ['Contrôle de sortie', 'Revue dans GitLab', 'tous les gates verts (sinon autocorrection bornée, puis escalade)', 'contrôle de sortie'],
    ['Revue dans GitLab', 'Fusionné (observé)', 'approbation selon les règles GitLab', 'ingénieur logiciel, GitLab'],
  ];

  /* ---------- Modules ---------- */
  var MODS = [
    { id: 'portail', th: 180, type: 'human', title: 'Portail de dépôt', tag: 'tickets · maquettes', chk: ['Tickets', 'Maquet.', 'Projet', 'Droits'], roles: ['PO', 'UX'], icon: 'inbox' },
    { id: 'entree', th: 225, type: 'guard', title: 'Contrôle d\'entrée', tag: 'avant fabrication', chk: ['Complet', 'Injec.', 'RGPD', 'Niveau'], icon: 'shield' },
    { id: 'plan', th: 270, type: 'human', title: 'Planification', tag: 'plan auto · go humain', chk: ['Plan', 'Tests', 'Budget', 'GO'], roles: ['CP'], icon: 'plan' },
    { id: 'sandbox', th: 315, type: 'agent', title: 'Cellule isolée', tag: '3 agents IA', chk: ['Tests', 'Code', 'Revue', 'Corr.'], icon: 'cube' },
    { id: 'sortie', th: 0, type: 'guard', title: 'Contrôle de sortie', tag: 'indépendante des agents', chk: ['Tests', 'Banc', 'Sécu.', 'Secrets'], icon: 'gate' },
    { id: 'forge', th: 45, type: 'ext', title: 'Forge GitLab', tag: 'demande de fusion', chk: ['MR', 'CI', 'Revue', 'Appro.'], roles: ['ING'], icon: 'branch' },
    { id: 'prod', th: 90, type: 'ext', title: 'Fusion et prod', tag: 'géré par GitLab', chk: ['Fusion', 'Deploy'], icon: 'server' },
    { id: 'escalade', th: 135, type: 'human', title: 'Équipe plateforme', tag: 'escalade', chk: ['Diag.', 'Décision'], roles: ['PLAT'], icon: 'bell' },
  ];
  var MOD = {};
  MODS.forEach(function (m) { MOD[m.id] = m; m.p = onRing(m.th); });

  var ICONS = {
    inbox: ['M3 13 l3 -8 h12 l3 8 v6 h-18 z', 'M3 13 h5 l1 3 h6 l1 -3 h5'],
    shield: ['M12 3 l8 3 v6 c0 5 -4 8 -8 9 c-4 -1 -8 -4 -8 -9 v-6 z', 'M8 12 l3 3 l5 -6'],
    plan: ['M4 4 h16 v16 h-16 z', 'M4 9 h16', 'M10 9 v11'],
    cube: ['M12 3 l8 4 v10 l-8 4 l-8 -4 v-10 z', 'M12 12 l8 -5', 'M12 12 v9', 'M12 12 l-8 -5'],
    gate: ['M4 5 h16 v14 h-16 z', 'M8 12 l3 3 l5 -6'],
    branch: ['M7 5 v14', 'M17 9 c0 6 -10 2 -10 8'],
    server: ['M4 5 h16 v5 h-16 z', 'M4 14 h16 v5 h-16 z', 'M8 7.5 h.01', 'M8 16.5 h.01'],
    bell: ['M6 17 v-6 a6 6 0 0 1 12 0 v6 l2 2 h-16 z', 'M10 21 h4'],
  };

  /* ---------- Entrées par défaut et scénarios prêts à jouer ---------- */
  var FAULTS = ['injection', 'secret', 'mutation', 'modelKO', 'budget', 'loop', 'changes', 'kill'];
  var FAULT_TXT = {
    injection: ['Ticket piégé', 'une consigne cachée dans un ticket'],
    secret: ['Secret dans le diff', 'refusé en sortie, autocorrection bornée'],
    mutation: ['Tests insuffisants', 'seuil de mutation non atteint'],
    modelKO: ['Modèle indisponible', 'le modèle d\'implémentation tombe'],
    budget: ['Budget dépassé', 'boucle coûteuse de l\'implémenteur'],
    loop: ['Boucle d\'agent bloquée', 'le même échec revient, itération après itération'],
    changes: ['Changements demandés', 'l\'ingénieur demande des corrections en revue'],
    kill: ['Arrêt d\'urgence', 'le RSSI arrête la fabrication en cours'],
  };
  function defaults() {
    var f = {}; FAULTS.forEach(function (k) { f[k] = false; });
    return { mode: 'creation', cls: 'C1', stack: 'java-angular', tickets: 3, cap: 'normal', allow: { A: true, B: true, I: true }, policy: 'seul', esc: 'arret', faults: f };
  }
  var PRESETS = [
    { id: 'creation', name: 'Création d\'une application', short: 'Chemin nominal : du dépôt des tickets à la MR (jalon M1).', set: { mode: 'creation' } },
    { id: 'feature', name: 'Feature sur une application existante', short: 'Même chaîne, avec lecture bornée du dépôt (jalon M2).', set: { mode: 'feature' } },
    { id: 'campagne', name: 'Campagne sur 2 applications', short: 'Une évolution, deux applications : l\'application 2 échoue à la mutation (jalon M3).', set: { mode: 'campagne', faults: { mutation: true } } },
    { id: 'duo', name: 'Deux modèles en parallèle', short: 'Un premier modèle écrit les tests du lot suivant pendant qu\'un second implémente : deux tâches, deux éditeurs (ex. Claude et Codex).', set: { policy: 'duo', tickets: 4 } },
    { id: 'langage', name: 'Autre langage : Python + React', short: 'Même orchestration, autres skills de pile chargés par le service commun.', set: { stack: 'python-react' } },
    { id: 'injection', name: 'Ticket piégé (injection)', short: 'Refus au contrôle d\'entrée, retour au PO avec le motif.', set: { faults: { injection: true } } },
    { id: 'secret', name: 'Secret détecté en sortie', short: 'La contrôle de sortie refuse ; autocorrection bornée ; elle repasse.', set: { faults: { secret: true } } },
    { id: 'mutation', name: 'Tests insuffisants (mutation)', short: 'Refus répété : escalade, la fabrication est abandonnée.', set: { faults: { mutation: true } } },
    { id: 'modele', name: 'Modèle d\'IA indisponible', short: 'Le modèle tombe : bascule sur un autre, ou suspension si la classe n\'en autorise aucun.', set: { faults: { modelKO: true }, policy: 'seul' } },
    { id: 'c3', name: 'Projet confidentiel (C3)', short: 'Modèles internes seuls, isolation N3, deux approbateurs.', set: { cls: 'C3' } },
    { id: 'aucun', name: 'Aucun modèle autorisé', short: 'C3 mais seuls les modèles cloud sont cochés : refus au contrôle d\'entrée (dans le doute, on s\'arrête).', set: { cls: 'C3', allow: { A: true, B: true, I: false } } },
    { id: 'budget', name: 'Dépassement de budget', short: 'Le plafond est atteint : suspension, escalade, décision humaine.', set: { faults: { budget: true } } },
    { id: 'boucle', name: 'Agent bloqué : le mécanicien intervient', short: 'Même échec itération après itération : arrêt borné, escalade, diagnostic et relance par l\'équipe plateforme.', set: { faults: { loop: true }, esc: 'reprise' } },
    { id: 'budget-reprise', name: 'Budget relevé par l\'équipe plateforme', short: 'Le plafond est atteint : l\'ingénieur plateforme le relève dans sa délégation, la fabrication reprend.', set: { faults: { budget: true }, esc: 'reprise' } },
    { id: 'changes', name: 'Changements demandés en revue', short: 'L\'ingénieur demande des corrections : même fabrication, périmètre inchangé.', set: { faults: { changes: true } } },
    { id: 'kill', name: 'Arrêt d\'urgence en cours de fabrication', short: 'Le RSSI arrête la fabrication : abandon, cellule détruite, clé révoquée.', set: { faults: { kill: true } } },
  ];
  /* Démo automatique (stand) : 5 scénarios choisis pour montrer des facettes différentes ; les 16 restent jouables à la main. */
  var DEMO = ['duo', 'c3', 'injection', 'mutation', 'boucle'];
  var PRESET = {};
  PRESETS.forEach(function (p) { PRESET[p.id] = p; });

  function applyPreset(base, id) {
    var d = defaults(), p = clone(base), s = PRESET[id].set;
    p.mode = d.mode; p.policy = d.policy; p.esc = d.esc; p.allow = d.allow; p.faults = d.faults;
    Object.keys(s).forEach(function (k) {
      if (k === 'faults') Object.keys(s.faults).forEach(function (f) { p.faults[f] = s.faults[f]; });
      else if (k === 'allow') p.allow = clone(s.allow);
      else p[k] = s[k];
    });
    return p;
  }

  /* ---------- Construction des étapes d'une fabrication à partir des entrées ---------- */
  function effectiveModels(p) { return CLASSES[p.cls].models.filter(function (k) { return p.allow[k]; }); }

  function buildSteps(p) {
    var ci = CLASSES[p.cls], F = p.faults, n = p.tickets, capf = CAPS[p.cap].f;
    var allowed = effectiveModels(p), duo = p.policy === 'duo' && allowed.length >= 2;
    var camp = p.mode === 'campagne', feature = p.mode === 'feature';
    var stack = STACKS[p.stack];
    var out = [], cost = 0;
    function dur(b) { return +(b + 0.35 * n).toFixed(1); }
    function add(m, st, d, t, o) {
      o = o || {};
      o.m = m; o.st = st; o.d = d; o.t = t;
      if (o.c) cost += o.c;
      o.bud = clamp(cost / capf, 0, 1);
      o.chk = o.chk || ''; o.log = o.log || [];
      out.push(o);
      return o;
    }
    /* Escalade vers l'équipe plateforme. Retourne true si la fabrication s'arrête, false s'il reprend après intervention. */
    function escalate(reason, stl, stopLabel, resume) {
      var back = p.esc === 'reprise' && resume;
      add('escalade', 5, 5, 'Fabrication suspendue : paquet d\'escalade vers l\'équipe plateforme', {
        chk: back ? 'oo' : 'o-', pk: 'Paquet d\'escalade', stl: stl || 'Suspendu', stc: 'x',
        human: { role: 'PLAT', label: back ? resume.label : (stopLabel || 'Décide : relever le plafond ou arrêter') },
        end: back ? undefined : 'stop',
        log: [['ORCH', reason], ['ORCH', 'Paquet d\'escalade émis (état, essais, coûts, dernière erreur)']].concat(back
          ? [['HUMAIN', 'Ingénieur plateforme : diagnostic sur le paquet d\'escalade'], ['HUMAIN', 'Ingénieur plateforme : ' + resume.action]]
          : [['HUMAIN', 'Ingénieur plateforme : arrêt de la fabrication décidé'], ['SYSTÈME', 'Cellule détruite, clé temporaire révoquée']]),
      });
      if (!back) return true;
      if (resume.fix) resume.fix();
      add('sandbox', 5, dur(2), 'Reprise après intervention : ' + resume.title, {
        chk: 'oo--', pk: 'Code', c: 0.03, skills: true, use: [{ k: resume.model || mI, r: 'reprise' }], mod: resume.mod,
        log: [['ORCH', 'Fabrication reprise : même dossier figé, plan figé, périmètre inchangé']].concat(resume.log || []),
      });
      return false;
    }
    function over() {
      if (cost / capf < 0.999) return false;
      return escalate('Plafond de budget de la fabrication atteint', 'Suspendu : budget', 'Décide : relever le plafond ou arrêter', {
        label: 'Relève le plafond dans sa délégation', action: 'plafond relevé dans sa délégation, fabrication relancée', title: 'plafond relevé, consommation suivie',
        fix: function () { capf = cost * 1.6; }, log: [['SYSTÈME', 'Plafond de budget relevé, nouvelle clé temporaire plafonnée']],
      });
    }

    /* Portail */
    add('portail', 0, 4, n + (n > 1 ? ' tickets sélectionnés' : ' ticket sélectionné') + (camp ? ' pour 2 applications' : '') + ', maquettes déposées', {
      chk: 'oooo', pk: 'Tickets + maquettes', human: { role: 'PO', also: ['UX'], label: camp ? 'Lance la campagne depuis le backlog' : 'Sélectionne les tickets' },
      log: [['HUMAIN', 'PO : ' + n + ' ticket(s) sélectionné(s) dans le backlog'], ['HUMAIN', 'UX : maquettes déposées (Figma ou document)'], ['ORCH', 'Dossier enregistré, version figée']],
    });

    /* Préflight */
    if (F.injection) {
      add('entree', 1, 6, 'Consigne cachée détectée dans le ticket : refus', { chk: 'ox--', pk: 'Dossier', rej: true, stl: 'Refusé au contrôle d\'entrée', stc: 'x', c: 0.01, log: [['CONTRÔLE', 'Complétude : conforme'], ['CONTRÔLE', 'Injection : instruction cachée détectée dans un ticket'], ['CONTRÔLE', 'Refus par défaut : aucun agent n\'a été lancé'], ['ORCH', 'Dossier retourné avec le motif']] });
      add('portail', 0, 4, 'Retour au PO avec le motif : le dossier est à corriger', { chk: 'oooo', pk: 'Retour + motif', rej: true, stl: 'Dossier retourné', stc: 'x', human: { role: 'PO', label: 'Corrige le ticket' }, end: 'ko', log: [['HUMAIN', 'PO : motif lu, ticket à corriger']] });
      return out;
    }
    if (!allowed.length) {
      add('entree', 1, 6, 'Aucun modèle autorisé pour la classe ' + p.cls + ' : refus', { chk: 'ooox', pk: 'Dossier', rej: true, stl: 'Refusé : aucun modèle', stc: 'x', c: 0.01, log: [['CONTRÔLE', 'Classe retenue : ' + p.cls], ['CONTRÔLE', 'Routage : aucun modèle autorisé par la classe et par le projet'], ['CONTRÔLE', 'Refus par défaut : pas de modèle autorisé, pas de fabrication']] });
      add('portail', 0, 4, 'Retour au chef de projet : élargir les modèles ou changer de classe', { chk: 'oooo', pk: 'Retour + motif', rej: true, stl: 'Dossier retourné', stc: 'x', human: { role: 'CP', label: 'Revoit les modèles autorisés' }, end: 'ko', log: [['HUMAIN', 'Chef de projet : motif lu']] });
      return out;
    }
    add('entree', 1, 6, 'Complétude, injection, RGPD, classification, modèle autorisé', {
      chk: 'oooo', pk: 'Dossier', c: 0.02,
      log: [['CONTRÔLE', 'Complétude du dossier : conforme'], ['CONTRÔLE', 'Injection : aucun motif détecté (le contenu reste une donnée)'], ['CONTRÔLE', 'RGPD : contrôle déterministe sans réserve']].concat(
        feature ? [['CONTRÔLE', 'Éligibilité du dépôt : conforme']] : [], [['CONTRÔLE', 'Classe retenue : ' + p.cls + ' → isolation ' + ci.iso + ', modèles : ' + allowed.map(function (k) { return MODELS[k].n; }).join(', ')]]),
    });

    /* Planification et go */
    var mT = allowed[0], mI = duo ? allowed[1] : allowed[0], mR = allowed[0];
    add('plan', 2, dur(4), feature ? 'L\'usine établit seule le plan et les tests prévus, à partir du contexte borné du dépôt' : 'L\'usine établit seule le plan et les tests prévus (aucune validation humaine)', {
      chk: 'oo--', pk: 'Plan + tests prévus', c: 0.04 + 0.01 * n, use: [{ k: mT, r: 'plan' }],
      log: [['AGENT', 'Planificateur (' + MODELS[mT].n + ') : plan en ' + n + ' lot(s) et intentions de test'], ['ORCH', 'Règles de validité du plan : conformes (schéma, périmètre, outils, budget)'], ['ORCH', 'Estimation de coût enregistrée']],
    });
    add('plan', 3, 4, 'Le chef de projet lit le plan chiffré et signe le go : seul acte humain', {
      chk: 'oooo', human: { role: 'CP', label: 'Lit le plan chiffré et signe le go' },
      log: [['HUMAIN', 'Chef de projet : rapport de contrôle d\'entrée, plan et estimation lus, go signé'], ['ORCH', 'Dossier figé (immuable) et signé']],
    });
    add('sandbox', 4, 3, 'Fabrication lancée : cellule ' + ci.iso + ' créée, skills chargés (socle SAML / OIDC, IAG, design system, ' + stack.skills.join(', ') + ')', {
      chk: '----', pk: 'Dossier figé', c: 0.01, skills: true,
      log: [['ORCH', 'Fabrication lancée depuis le dossier figé'], ['SYSTÈME', 'Cellule ' + ci.iso + ' créé, clé virtuelle éphémère plafonnée'], ['SYSTÈME', 'Service commun de skills : socle SAML / OIDC, skills IAG, design system + pile ' + stack.n + ' (' + stack.note + ')']],
    });

    /* Exécution, sortie, revue pour une application */
    function pipeline(pre, app) {
      var first = app === 1;
      var fSecret = F.secret && first, fModelKO = F.modelKO && first, fKill = F.kill && first, fChanges = F.changes && first, fBudget = F.budget && first, fLoop = F.loop && first;
      var fMut = F.mutation && (camp ? app === 2 : first);
      var P = pre ? pre + ' : ' : '';
      var implModel = mI;

      add('sandbox', 5, dur(3), P + 'Auteur des tests : suite écrite puis gelée (' + MODELS[mT].n + ')', { chk: 'o---', pk: 'Tests gelés', c: 0.04 + 0.03 * n, use: [{ k: mT, r: 'tests' }], skills: true, log: [['AGENT', 'Auteur des tests (' + MODELS[mT].n + ') : suite écrite puis gelée']] });
      if (over()) return 'stop';
      if (fModelKO) {
        var fb = allowed.filter(function (k) { return k !== mI; })[0];
        if (fb) {
          add('sandbox', 5, dur(3), P + MODELS[mI].n + ' ne répond plus : bascule sur ' + MODELS[fb].n, { chk: 'oo--', pk: 'Code', c: 0.1 * n, mod: { down: [mI] }, use: [{ k: fb, r: 'code' }], skills: true, log: [['SYSTÈME', MODELS[mI].n + ' : indisponible (délai dépassé)'], ['ORCH', 'Routage : bascule sur ' + MODELS[fb].n + ', même contrat LlmProvider'], ['AGENT', 'Implémenteur : reprise avec ' + MODELS[fb].n]] });
          implModel = fb;
        } else {
          add('sandbox', 5, 4, P + MODELS[mI].n + ' ne répond plus, aucun repli autorisé pour la classe', { chk: 'o---', pk: 'Code', mod: { down: [mI] }, use: [{ k: mI, r: 'code' }], stl: 'Suspendu : modèle', stc: 'x', log: [['SYSTÈME', MODELS[mI].n + ' : indisponible'], ['CONTRÔLE', 'Aucun autre modèle autorisé pour la classe ' + p.cls + ' : pas de repli']] });
          if (escalate('Pas de modèle de repli autorisé (dans le doute, on s\'arrête)', 'Suspendu : modèle', 'Décide : attendre le modèle ou arrêter', {
            label: 'Attend le rétablissement du modèle', action: 'modèle rétabli, relance demandée', title: MODELS[mI].n + ' rétabli', model: mI, mod: { up: [mI] },
            log: [['SYSTÈME', MODELS[mI].n + ' : disponible de nouveau']],
          })) return 'stop';
        }
      } else if (duo && n >= 2) {
        add('sandbox', 5, dur(3), P + 'En parallèle : ' + MODELS[mT].n + ' écrit les tests du lot 2 pendant que ' + MODELS[mI].n + ' implémente le lot 1', {
          chk: 'oo--', pk: 'Tests ‖ code', c: 0.1 * n, par: true, use: [{ k: mT, r: 'tests lot 2' }, { k: mI, r: 'code lot 1' }], skills: true,
          log: [['ORCH', 'Deux tâches indépendantes, deux modèles en parallèle'], ['AGENT', MODELS[mT].n + ' : tests du lot 2'], ['AGENT', MODELS[mI].n + ' : implémentation du lot 1']],
        });
      } else {
        add('sandbox', 5, dur(4), P + 'Implémenteur : code produit sans pouvoir modifier les tests (' + MODELS[mI].n + ')', { chk: 'oo--', pk: 'Code', c: 0.1 * n, use: [{ k: mI, r: 'code' }], skills: true, log: [['AGENT', 'Implémenteur (' + MODELS[mI].n + ') : code produit, tests gelés verts']] });
      }
      if (fLoop) {
        var other = allowed.filter(function (k) { return k !== implModel; })[0];
        add('sandbox', 5, dur(3), P + 'Implémenteur : le même échec revient sur 6 itérations, la boucle est arrêtée', { chk: 'ox--', pk: 'Code', c: 0.12 * n, stl: 'Boucle détectée', stc: 'x', use: [{ k: implModel, r: 'code' }], skills: true,
          log: [['AGENT', 'Implémenteur : le même ensemble de tests échoue, itération après itération'], ['ORCH', 'Détecteur d\'échec identique : seuil atteint, arrêt borné, essais conservés']] });
        if (escalate('Boucle d\'agent bloquée : échec identique sur plusieurs itérations', 'Suspendu : boucle', 'Décide : abandonner la tâche', {
          label: other ? 'Relance avec un autre modèle autorisé' : 'Relance avec un contexte reconstruit',
          action: other ? 'relance avec ' + MODELS[other].n + ' et contexte allégé' : 'relance avec un contexte reconstruit',
          title: other ? 'tâche relancée sur ' + MODELS[other].n : 'tâche relancée, contexte reconstruit', model: other || implModel,
          log: [['AGENT', (other ? MODELS[other].n : MODELS[implModel].n) + ' : reprise de la tâche, tests gelés verts']],
        })) return 'stop';
        if (other) implModel = other;
      }
      if (fBudget) cost += capf * 1.2;
      if (over()) return 'stop';
      if (fKill) {
        add('sandbox', 5, 5, P + 'Le RSSI déclenche l\'arrêt d\'urgence pendant l\'exécution', { chk: 'oo--', pk: 'Code', stl: 'Abandonné : arrêt d\'urgence', stc: 'x', human: { role: 'RSSI', label: 'Déclenche l\'arrêt d\'urgence' }, end: 'stop', log: [['HUMAIN', 'RSSI : arrêt d\'urgence de la fabrication'], ['SYSTÈME', 'Fabrication gelée, cellule détruite, clé temporaire révoquée'], ['ORCH', 'État Abandonné (cause : arrêt d\'urgence)']] });
        return 'stop';
      }
      if (duo && n >= 2) {
        add('sandbox', 5, dur(2), P + 'En parallèle : ' + MODELS[implModel].n + ' implémente le lot 2 pendant que ' + MODELS[mR].n + ' relit le lot 1', {
          chk: 'ooo-', pk: 'Code ‖ revue', c: 0.08 * n, par: true, use: [{ k: implModel, r: 'code lot 2' }, { k: mR, r: 'relecture lot 1' }], skills: true,
          log: [['AGENT', MODELS[implModel].n + ' : implémentation du lot 2'], ['AGENT', MODELS[mR].n + ' : relecture du lot 1 (autre modèle que l\'implémenteur)']],
        });
      } else {
        add('sandbox', 5, dur(1.5), P + 'Relecteur : observations consignées (avis consultatif)', { chk: 'ooo-', pk: 'Code', c: 0.03 * n, use: [{ k: mR, r: 'revue' }], log: [['AGENT', 'Relecteur (' + MODELS[mR].n + ') : observations consignées'], implModel === mR ? ['ORCH', 'Indépendance réduite : un même modèle pour implémenter et relire'] : ['ORCH', 'Relecteur sur un autre modèle que l\'implémenteur']] });
      }
      if (over()) return 'stop';

      var okExit = ['CONTRÔLE', 'Tous les contrôles sont verts'];
      if (fSecret) {
        add('sortie', 6, 5, P + 'Un secret est présent dans le diff : refus', { chk: 'ooox', pk: 'Code + preuves', rej: true, stl: 'Refusé en sortie', stc: 'x', c: 0.02, log: [['CONTRÔLE', 'Tests gelés : verts'], ['CONTRÔLE', 'Secrets : clé en clair détectée dans le diff'], ['ORCH', 'Une autocorrection bornée est autorisée']] });
        add('sandbox', 5, dur(1.5), P + 'Autocorrection bornée : le secret est retiré (1 tentative)', { chk: 'oooo', pk: 'Code corrigé', c: 0.06, use: [{ k: implModel, r: 'correctif' }], log: [['AGENT', 'Implémenteur : secret retiré, configuration externalisée']] });
        add('sortie', 6, 6, P + 'Nouveau passage : tout est conforme', { chk: 'oooo', pk: 'Code + preuves', c: 0.02, log: [okExit, ['ORCH', 'Dossier de preuves assemblé']] });
      } else if (fMut) {
        add('sortie', 6, 6, P + 'Seuil de mutation non atteint : refus', { chk: 'oxoo', pk: 'Preuves', rej: true, stl: camp ? 'App ' + app + ' refusée' : 'Refusé en sortie', stc: 'x', c: 0.02, log: [['CONTRÔLE', 'Tests gelés : verts'], ['CONTRÔLE', 'Mutation : seuil non atteint (les tests ne détectent pas assez de défauts)']].concat(camp ? [['ORCH', 'Seuil d\'arrêt de campagne non atteint : une seule application en échec'], ['ORCH', 'Application ' + app + ' retournée avec le motif, les autres applications ne sont pas affectées']] : [['ORCH', 'Une autocorrection bornée est autorisée']]) });
        if (camp) return 'refused';
        add('sandbox', 5, dur(1.5), P + 'Autocorrection bornée : tests renforcés (1 tentative)', { chk: 'oooo', pk: 'Tests + code', c: 0.05, use: [{ k: mT, r: 'tests' }], log: [['AGENT', 'Auteur des tests : cas supplémentaires']] });
        add('sortie', 6, 5, P + 'Nouveau passage : le seuil de mutation reste non atteint', { chk: 'oxoo', pk: 'Preuves', rej: true, stl: 'Refusé en sortie', stc: 'x', c: 0.02, log: [['CONTRÔLE', 'Mutation : seuil toujours non atteint'], ['ORCH', 'Bornes d\'autocorrection épuisées : escalade']] });
        escalate('Échec répété de la contrôle de sortie : bornes épuisées', 'Suspendu : contrôle', 'Décide : abandonner ou rouvrir un cadrage (nouveau dossier figé, nouveau go)');
        return 'stop';
      } else {
        add('sortie', 6, 6, P + 'Tests gelés, mutation, SAST, secrets, politique de diff', { chk: 'oooo', pk: 'Code + preuves', c: 0.02, log: [['CONTRÔLE', 'Tests gelés : verts'], ['CONTRÔLE', 'Mutation : seuil atteint'], ['CONTRÔLE', 'SAST et secrets : aucun constat bloquant'], ['ORCH', 'Dossier de preuves assemblé']] });
      }

      add('forge', 7, 4, P + 'Merge Request créée avec son dossier de preuves, pipeline CI exécuté', { chk: 'oo--', pk: 'MR', c: 0.01, log: [['GITLAB', 'MR ouverte, dossier de preuves attaché'], ['GITLAB', 'Pipeline CI : vert']] });
      if (fChanges) {
        add('forge', 7, 5, P + 'L\'ingénieur demande des changements', { chk: 'ooo-', pk: 'MR (changements)', stl: 'Changements demandés', stc: 'x', human: { role: 'ING', label: 'Demande des changements' }, log: [['HUMAIN', 'Ingénieur logiciel : changements demandés'], ['ORCH', 'Périmètre inchangé : même fabrication, même dossier figé']] });
        add('sandbox', 5, dur(2), P + 'Correction dans le même fabrication (périmètre inchangé)', { chk: 'oooo', pk: 'Correctif', c: 0.06, use: [{ k: implModel, r: 'correctif' }], skills: true, log: [['AGENT', 'Implémenteur : correctif appliqué']] });
        add('sortie', 6, 5, P + 'Contrôle de sortie sur le correctif', { chk: 'oooo', pk: 'Correctif + preuves', c: 0.02, log: [okExit] });
        add('forge', 7, 3, P + 'MR mise à jour, CI verte', { chk: 'oo--', pk: 'MR', log: [['GITLAB', 'MR mise à jour, pipeline CI : vert']] });
      }
      add('forge', 7, 5, P + 'Revue humaine dans GitLab selon les règles d\'approbation', {
        chk: 'oooo', human: { role: 'ING', label: ci.appr > 1 ? 'Deux ingénieurs distincts approuvent' : 'L\'ingénieur relit et approuve' },
        log: [['HUMAIN', ci.appr > 1 ? 'Deux ingénieurs distincts : approbation (règle renforcée)' : 'Ingénieur logiciel : relu et approuvé'], ['ORCH', 'Contrôle a posteriori : le lanceur n\'est pas approbateur']],
      });
      add('prod', 8, 4, P + 'GitLab fusionne et déploie ; PHARE observe sans piloter', { chk: 'oo', pk: 'Application', log: [['GITLAB', 'Fusion et déploiement selon les règles de l\'entreprise'], ['ORCH', 'État Fusionné observé']] });
      return 'ok';
    }

    if (camp) {
      add('entree', 1, 3, 'Contrôle d\'entrée par application : droits et classe de chacune', { chk: 'oooo', pk: 'Dossier ×2', c: 0.01, log: [['CONTRÔLE', 'Application 1 : conforme'], ['CONTRÔLE', 'Application 2 : conforme'], ['ORCH', 'Une fabrication, un dossier figé et un go par application']] });
      var r1 = pipeline('Application 1', 1);
      if (r1 === 'stop') return out;
      var r2 = pipeline('Application 2', 2);
      out[out.length - 1].end = r2 === 'ok' ? 'ok' : (r2 === 'refused' ? 'part' : 'stop');
    } else {
      var r = pipeline('', 1);
      if (r === 'ok') out[out.length - 1].end = 'ok';
    }
    return out;
  }

  /* ---------- État ---------- */
  var st = { run: null, clock: 0, playing: true, speed: 1, stepmode: false, estop: null, params: defaults(), sel: 'creation', idle: 0, demoIdx: 0,
    ok: 0, ko: 0, hum: 0, gates: 0, logLines: [], logDirty: true, flash: '', replays: [], dirty: true, previewKey: '', preview: null };

  /* ---------- Scène : décor ---------- */
  var defs = S('defs', {}, svg);
  var pat = S('pattern', { id: 'grid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, defs);
  S('path', { d: 'M40 0 H0 V40', fill: 'none', stroke: '#16233e', 'stroke-width': 1 }, pat);
  S('rect', { x: 0, y: 0, width: 1200, height: 720, fill: 'url(#grid)' }, svg);
  S('ellipse', { cx: CX, cy: CY, rx: RX, ry: RY, fill: 'none', stroke: '#1b2a4a', 'stroke-width': 2, 'stroke-dasharray': '3 9' }, svg);
  S('ellipse', { cx: CX, cy: CY, rx: TX, ry: TY, fill: 'none', stroke: '#14213a', 'stroke-width': 22 }, svg);
  var belt = S('ellipse', { cx: CX, cy: CY, rx: TX, ry: TY, fill: 'none', stroke: '#3a5aa0', 'stroke-width': 3, 'stroke-dasharray': '2 20', 'stroke-linecap': 'round' }, svg);

  var spokes = {};
  MODS.forEach(function (m) {
    var a = Math.atan2(m.p.y - CY, m.p.x - CX);
    var x0 = CX + (DR1 + 4) * Math.cos(a), y0 = CY + (DR1 + 4) * Math.sin(a);
    spokes[m.id] = { line: S('line', { x1: x0, y1: y0, x2: m.p.x, y2: m.p.y, stroke: '#24365c', 'stroke-width': 2, 'stroke-dasharray': '4 7' }, svg), x0: x0, y0: y0, x1: m.p.x, y1: m.p.y,
      dot: S('circle', { r: 5, fill: COL.warn, opacity: 0 }, svg) };
  });

  var dial = { g: S('g', { class: 'hit', 'data-key': 'orchestre' }, svg), arcs: [] };
  S('circle', { cx: CX, cy: CY, r: DR1 + 10, fill: '#0c1424', stroke: '#1b2a4a', 'stroke-width': 2 }, dial.g);
  STATES.forEach(function (n, i) {
    var a0 = -90 + i * 40 + 1.5, a1 = -90 + (i + 1) * 40 - 1.5;
    dial.arcs.push(S('path', { d: arc(DR0, DR1, a0, a1), fill: '#1d2a47', stroke: '#0a101c', 'stroke-width': 1 }, dial.g));
  });
  S('text', { x: CX, y: CY - 24, 'text-anchor': 'middle', style: 'font-size:10px;font-weight:800;letter-spacing:.14em', fill: COL.mute }, dial.g, 'ORCHESTRATEUR');
  var dialState = S('text', { x: CX, y: CY + 2, 'text-anchor': 'middle', style: 'font-size:15px;font-weight:800', fill: COL.text }, dial.g, '');
  S('text', { x: CX, y: CY + 22, 'text-anchor': 'middle', style: 'font-size:10.5px', fill: COL.mute }, dial.g, 'workflow déterministe');
  var dialStep = S('text', { x: CX, y: CY + 38, 'text-anchor': 'middle', style: 'font-size:10.5px', fill: COL.mute }, dial.g, '');

  /* ---------- Pictogrammes humains ---------- */
  function glyph(parent, x, y, label) {
    var g = S('g', { transform: 'translate(' + x + ',' + y + ')' }, parent);
    var c = S('circle', { r: 17, fill: COL.deep, stroke: COL.human, 'stroke-width': 2.5 }, g);
    var body = S('g', { fill: COL.human }, g);
    S('circle', { cx: 0, cy: -6, r: 4.2 }, body);
    S('path', { d: 'M-8 3 a8 6 0 0 1 16 0 z' }, body);
    var t = S('text', { y: 14, 'text-anchor': 'middle', style: 'font-size:8px;font-weight:800', fill: COL.human }, g, label);
    return { g: g, c: c, body: body, t: t };
  }
  var glyphs = {};

  /* ---------- Modules ---------- */
  var mods = {};
  function drawIcon(parent, name, color) {
    var g = S('g', { transform: 'translate(-82,-34) scale(1.17)', fill: 'none', stroke: color, 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
    ICONS[name].forEach(function (d) { S('path', { d: d }, g); });
    if (name === 'branch') [[7, 5], [7, 19], [17, 8]].forEach(function (c) { S('circle', { cx: c[0], cy: c[1], r: 2.4, fill: '#16213a' }, g); });
  }
  MODS.forEach(function (m) {
    var color = COL[m.type] || COL.mute;
    var g = S('g', { class: 'hit', 'data-key': m.id, transform: 'translate(' + m.p.x + ',' + m.p.y + ')' }, svg);
    if (m.id === 'sandbox') S('rect', { x: -MW / 2 - 7, y: -MH / 2 - 7, width: MW + 14, height: MH + 14, rx: 16, fill: 'none', stroke: COL.agent, 'stroke-width': 1.8, 'stroke-dasharray': '7 6', opacity: 0.75 }, g);
    var frame = S('rect', { class: 'frame', x: -MW / 2, y: -MH / 2, width: MW, height: MH, rx: 12, fill: COL.card, stroke: COL.line, 'stroke-width': 2 }, g);
    S('circle', { cx: -68, cy: -20, r: 21, fill: COL.deep, stroke: color, 'stroke-width': 2 }, g);
    drawIcon(g, m.icon, color);
    S('text', { x: -40, y: -23, class: 'mod-title' }, g, m.title);
    var tag = S('text', { x: -40, y: -7, class: 'mod-tag' }, g, m.tag);
    var pills = m.chk.map(function (label, i) {
      var pg = S('g', { transform: 'translate(' + (-90 + i * 46) + ',10)' }, g);
      var r = S('rect', { x: 0, y: 0, width: 43, height: 19, rx: 5, fill: COL.deep, stroke: COL.line, 'stroke-width': 1.5 }, pg);
      var t = S('text', { x: 21.5, y: 13, 'text-anchor': 'middle', class: 'pill-t' }, pg, label);
      return { r: r, t: t };
    });
    S('rect', { x: -90, y: 37, width: 180, height: 4, rx: 2, fill: COL.deep }, g);
    var prog = S('rect', { x: -90, y: 37, width: 0, height: 4, rx: 2, fill: color }, g);
    var prog2 = S('rect', { x: -90, y: 42, width: 0, height: 3, rx: 1.5, fill: COL.warn, opacity: 0 }, g);
    var beam = m.type === 'guard' ? S('rect', { x: -MW / 2, y: -MH / 2 + 2, width: 4, height: MH - 4, fill: COL.guard, opacity: 0 }, g) : null;
    mods[m.id] = { g: g, frame: frame, pills: pills, prog: prog, prog2: prog2, beam: beam, tag: tag, color: color, def: m };
    (m.roles || []).forEach(function (role, k) {
      glyphs[m.id + ':' + role] = glyph(svg, m.p.x + MW / 2 - 18 - 40 * ((m.roles.length - 1) - k), m.p.y - MH / 2 - 22, role);
    });
  });

  /* ---------- Coins : budget, routeur, skills, salle de contrôle ---------- */
  var gauge = S('g', { class: 'hit', 'data-key': 'budget', transform: 'translate(110,116)' }, svg);
  S('path', { d: 'M-58 0 A58 58 0 0 1 58 0', fill: 'none', stroke: '#1d2a47', 'stroke-width': 14 }, gauge);
  S('path', { d: 'M-58 0 A58 58 0 0 1 20.5 -54.5', fill: 'none', stroke: '#2b8a3e', 'stroke-width': 14 }, gauge);
  S('path', { d: 'M20.5 -54.5 A58 58 0 0 1 46.9 -34.1', fill: 'none', stroke: '#e8a500', 'stroke-width': 14 }, gauge);
  S('path', { d: 'M46.9 -34.1 A58 58 0 0 1 58 0', fill: 'none', stroke: '#c92a2a', 'stroke-width': 14 }, gauge);
  var needle = S('line', { x1: 0, y1: 0, x2: -46, y2: 0, stroke: COL.text, 'stroke-width': 4, 'stroke-linecap': 'round' }, gauge);
  S('circle', { r: 7, fill: COL.text }, gauge);
  S('text', { y: 22, 'text-anchor': 'middle', style: 'font-size:13px;font-weight:800', fill: COL.text }, gauge, 'Budget de fabrication');
  var gaugeVal = S('text', { y: 38, 'text-anchor': 'middle', class: 'small-t' }, gauge, '');

  var router = S('g', { class: 'hit', 'data-key': 'router', transform: 'translate(930,40)' }, svg);
  S('text', { x: 125, y: 1, 'text-anchor': 'middle', style: 'font-size:13px;font-weight:800', fill: COL.text }, router, 'Modèles d\'IA (hors cellule)');
  S('text', { x: 125, y: 16, 'text-anchor': 'middle', class: 'small-t' }, router, 'passerelle surveillée · pas d\'internet libre');
  var rpills = {}, rlines = {};
  ['A', 'B', 'I'].forEach(function (k, i) {
    var pg = S('g', { transform: 'translate(' + (i * 85) + ',26)' }, router);
    var r = S('rect', { width: 80, height: 44, rx: 8, fill: COL.deep, stroke: COL.line, 'stroke-width': 2 }, pg);
    var t1 = S('text', { x: 40, y: 18, 'text-anchor': 'middle', style: 'font-size:12.5px;font-weight:800', fill: COL.text }, pg, MODELS[k].n);
    var t2 = S('text', { x: 40, y: 34, 'text-anchor': 'middle', class: 'small-t' }, pg, MODELS[k].s);
    var strike = S('line', { x1: 6, y1: 38, x2: 74, y2: 6, stroke: COL.guard, 'stroke-width': 1.8, opacity: 0 }, pg);
    rpills[k] = { r: r, t1: t1, t2: t2, strike: strike };
    rlines[k] = { line: S('line', { x1: 930 + i * 85 + 40, y1: 110, x2: MOD.sandbox.p.x - 45 + i * 45, y2: MOD.sandbox.p.y - MH / 2 - 8, stroke: COL.agent, 'stroke-width': 3, opacity: 0, 'stroke-dasharray': '5 5' }, svg),
      dot: S('circle', { r: 4.5, fill: COL.agent, opacity: 0 }, svg), i: i };
  });

  var skillsTile = S('g', { class: 'hit', 'data-key': 'skills', transform: 'translate(1024,128)' }, svg);
  S('rect', { width: 168, height: 166, rx: 12, fill: COL.card, stroke: COL.line, 'stroke-width': 2 }, skillsTile);
  S('text', { x: 84, y: 22, 'text-anchor': 'middle', style: 'font-size:12.5px;font-weight:800', fill: COL.text }, skillsTile, 'Règles communes (skills)');
  S('text', { x: 84, y: 38, 'text-anchor': 'middle', class: 'small-t' }, skillsTile, 'catalogue signé · versionné · revu');
  var skillsLabels = ['Connexion SSO', 'Règles IA', 'Design System', ''];
  var skillChips = [0, 1, 2, 3].map(function (i) {
    var cg = S('g', { transform: 'translate(14,' + (50 + i * 26) + ')' }, skillsTile);
    var r = S('rect', { width: 140, height: 21, rx: 6, fill: COL.deep, stroke: COL.line, 'stroke-width': 1.5 }, cg);
    var t = S('text', { x: 70, y: 15, 'text-anchor': 'middle', style: 'font-size:11.5px;font-weight:700', fill: COL.text }, cg, skillsLabels[i]);
    return { r: r, t: t };
  });
  var skillsFoot = S('text', { x: 84, y: 160, 'text-anchor': 'middle', class: 'small-t' }, skillsTile, '');

  var salle = S('g', { class: 'hit', 'data-key': 'estop', transform: 'translate(14,172)' }, svg);
  S('rect', { width: 176, height: 112, rx: 12, fill: COL.card, stroke: COL.line, 'stroke-width': 2 }, salle);
  S('text', { x: 88, y: 22, 'text-anchor': 'middle', style: 'font-size:13px;font-weight:800', fill: COL.text }, salle, 'Salle de contrôle');
  S('text', { x: 88, y: 38, 'text-anchor': 'middle', class: 'small-t' }, salle, 'RSSI · niveau · arrêt d\'urgence');
  var salleGlyph = glyph(salle, 44, 76, 'RSSI');
  var salleBtn = S('g', { 'data-action': 'estop', class: 'hit' }, salle);
  S('circle', { cx: 120, cy: 76, r: 25, fill: '#f2c200', stroke: '#161616', 'stroke-width': 3 }, salleBtn);
  var salleCap = S('circle', { cx: 120, cy: 74, r: 15, fill: '#d62828', stroke: '#7a1212', 'stroke-width': 2 }, salleBtn);

  var legend = S('g', { transform: 'translate(24,700)' }, svg);
  [['Humain', COL.human], ['Contrôle', COL.guard], ['Agent IA', COL.agent], ['Forge', COL.ext], ['Orchestration', COL.system]].forEach(function (l, i) {
    S('rect', { x: i * 108, y: -10, width: 12, height: 12, rx: 3, fill: l[1] }, legend);
    S('text', { x: i * 108 + 18, y: 0, class: 'small-t' }, legend, l[0]);
  });
  S('text', { x: 1186, y: 704, 'text-anchor': 'end', class: 'small-t' }, svg, 'Valeurs fictives : simulation illustrative, aucune mesure réelle');

  /* ---------- Colis ---------- */
  var packet = S('g', { opacity: 0 }, svg);
  var pRect = S('rect', { x: -60, y: -13, width: 120, height: 26, rx: 7, fill: '#0a101c', stroke: COL.warn, 'stroke-width': 2.5 }, packet);
  var pText = S('text', { y: 4, 'text-anchor': 'middle', style: 'font-size:11.5px;font-weight:800', fill: COL.text }, packet, '');
  var pX = S('g', { opacity: 0 }, packet);
  S('circle', { cx: 0, cy: -22, r: 10, fill: COL.guard, stroke: '#0a101c', 'stroke-width': 2 }, pX);
  S('path', { d: 'M-4 -26 l8 8 M4 -26 l-8 8', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, pX);

  /* ---------- Logique de la fabrication ---------- */
  function paramsKey(p) { return JSON.stringify(p) + MODELS.A.n + MODELS.B.n + MODELS.I.n; }
  function pathHash(steps) { return hash(steps.map(function (s) { return [s.m, s.st, s.chk, s.rej ? 1 : 0, s.end || '', s.human ? s.human.role : '', s.use ? s.use.map(function (u) { return u.k; }).join('') : ''].join(':'); }).join('|')); }

  function addLogLine(t, a, x) { st.logLines.push({ t: t, a: a, x: x }); st.logDirty = true; }
  function syncLog() {
    var r = st.run; if (!r) return;
    if (r.idx < r.logIdx) { st.logLines.length = r.logStart; r.logIdx = -1; }
    for (var i = r.logIdx + 1; i <= r.idx; i++) {
      var s = r.steps[i];
      addLogLine(mmss(r.starts[i]), 'ORCH', STATES[s.st] + ' · ' + s.t);
      s.log.forEach(function (l) { addLogLine(mmss(r.starts[i]), l[0], l[1]); });
    }
    r.logIdx = r.idx;
    st.logDirty = true;
  }

  function liveCounts(run) {
    var h = 0, g = 0;
    for (var i = 0; i <= run.idx && i < run.steps.length; i++) {
      var s = run.steps[i];
      var done = i < run.idx || (i === run.idx && run.fin);
      if (s.human && (i < run.idx || run.ok[i])) h++;
      if ((s.m === 'entree' || s.m === 'sortie') && s.chk.indexOf('x') < 0 && s.chk.indexOf('o') >= 0 && done) g++;
    }
    return { h: h, g: g };
  }

  function presetName(id) { return id && PRESET[id] ? PRESET[id].name : 'Entrées personnalisées'; }

  function startRun(presetId) {
    if (st.estop) { flash('Système à l\'arrêt : déverrouiller puis acquitter avant de relancer.'); return; }
    if (presetId && PRESET[presetId]) { st.params = applyPreset(st.params, presetId); st.sel = presetId; }
    if (st.run) endRun(true);
    var p = clone(st.params);
    st.lastParams = clone(p);
    var steps = buildSteps(p), starts = [], acc = 0;
    steps.forEach(function (s) { starts.push(acc); acc += s.d; });
    var key = paramsKey(p), ph = pathHash(steps), ch = hash(String(Math.random()) + key);
    st.run = { params: p, key: key, name: presetName(st.sel), steps: steps, starts: starts, total: acc, idx: 0, el: 0, ok: {}, hold: 0, waiting: false, waitNext: false, fin: false, logStart: 0, logIdx: -1, path: ph, content: ch };
    st.logLines.push({ sep: true, x: st.run.name + ' · classe ' + p.cls + ' · ' + STACKS[p.stack].n });
    st.run.logStart = st.logLines.length;
    var prev = null;
    st.replays.forEach(function (r) { if (r.key === key) prev = r; });
    st.replays.push({ name: st.run.name, key: key, path: ph, content: ch, same: prev ? prev.path === ph : null });
    if (st.replays.length > 8) st.replays.shift();
    st.idle = 0;
    syncLog();
    st.dirty = true;
    refreshScen();
  }
  function endRun(aborted) {
    var r = st.run; if (!r) return;
    var c = liveCounts(r);
    st.hum += c.h; st.gates += c.g;
    var last = r.steps[r.steps.length - 1];
    if (aborted) { st.ko += 1; addLogLine(mmss(r.starts[r.idx] + r.el), 'SYSTÈME', 'Fabrication interrompue'); }
    else if (last.end === 'ok') st.ok += 1;
    else if (last.end === 'part') { st.ok += 1; st.ko += 1; }
    else st.ko += 1;
    st.run = null; st.idle = 0; st.dirty = true;
  }
  function advance() {
    var r = st.run; if (!r) return;
    if (r.idx + 1 >= r.steps.length) { r.fin = true; endRun(false); return; }
    r.idx += 1; r.el = 0; r.waiting = false; r.waitNext = false; r.hold = 0;
    syncLog();
    st.dirty = true;
  }
  function approve() {
    var r = st.run; if (!r || !r.waiting) return;
    r.ok[r.idx] = true; r.waiting = false; r.hold = 0;
    st.dirty = true;
    if (st.stepmode) r.waitNext = true; else advance();
  }
  function seekTo(frac) {
    var r = st.run; if (!r) { startRun(st.sel || 'creation'); r = st.run; if (!r) return; }
    var t = clamp(frac, 0, 0.9999) * r.total, idx = 0;
    for (var i = 0; i < r.steps.length; i++) if (r.starts[i] <= t) idx = i;
    for (var j = 0; j < idx; j++) if (r.steps[j].human) r.ok[j] = true;
    r.idx = idx; r.el = clamp(t - r.starts[idx], 0, r.steps[idx].d);
    r.waiting = false; r.waitNext = false; r.hold = 0;
    syncLog(); st.dirty = true;
  }

  function tick(dt) {
    if (st.estop || !st.playing) return;
    st.clock += dt;
    var r = st.run;
    if (!r) {
      if ($('demo').checked) {
        st.idle += dt;
        if (st.idle > 2.5) {
          if (st.demoIdx >= DEMO.length) { $('demo').checked = false; st.demoIdx = 0; flash('Démo terminée : choisis un scénario ou relance la démo automatique.'); }
          else { st.params = defaults(); startRun(DEMO[st.demoIdx]); st.demoIdx += 1; }
        }
      }
      return;
    }
    if (r.waiting) { if ($('autohuman').checked) { r.hold += dt; if (r.hold >= 1.5) approve(); } return; }
    if (r.waitNext) return;
    var s = r.steps[r.idx];
    r.el += dt * st.speed;
    if (r.el >= s.d) {
      r.el = s.d;
      if (s.human && !r.ok[r.idx]) { r.waiting = true; r.hold = 0; st.dirty = true; }
      else if (st.stepmode) r.waitNext = true;
      else advance();
    }
  }

  /* ---------- Rendu de la scène ---------- */
  var PILL = {
    idle: ['#0e1626', '#2a3957', '#6b7a96'],
    run: ['#3d2f00', COL.warn, '#ffe9a6'],
    ok: ['#0f3320', COL.ok, '#b8f2c6'],
    ko: ['#4a1414', COL.guard, '#ffc9c9'],
  };
  function setPill(p, state) {
    var c = PILL[state];
    p.r.setAttribute('fill', c[0]); p.r.setAttribute('stroke', c[1]); p.t.setAttribute('fill', c[2]);
    p.r.setAttribute('class', state === 'run' ? 'pulse' : '');
  }
  function shortAngle(a, b) { var d = ((b - a + 540) % 360) - 180; if (d <= -180) d = 180; return d; }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function setGlyph(g, state, stopped) {
    var col = state === 'done' ? COL.ok : COL.human;
    g.c.setAttribute('stroke', col);
    g.c.setAttribute('fill', state === 'wait' ? '#4a2f08' : (state === 'done' ? '#0f3320' : COL.deep));
    g.body.setAttribute('fill', col); g.t.setAttribute('fill', col);
    g.g.setAttribute('class', state === 'wait' && !stopped ? 'pulse' : '');
    g.g.setAttribute('opacity', state === 'idle' ? 0.65 : 1);
  }
  function humanRoles(s) { return s && s.human ? [s.human.role].concat(s.human.also || []) : []; }

  function render() {
    var r = st.run, s = r ? r.steps[r.idx] : null;
    var stopped = !!st.estop;
    var p = r ? r.params : st.params;
    belt.setAttribute('stroke-dashoffset', -(st.clock * 26) % 22);

    var cur = s ? s.st : -1;
    dial.arcs.forEach(function (a, i) {
      var f = '#1d2a47';
      if (r) {
        if (i < cur) f = '#4c3c9b';
        else if (i === cur) f = s.stc === 'x' ? COL.guard : (s.end === 'ok' && r.el >= s.d ? COL.ok : COL.warn);
      }
      a.setAttribute('fill', f);
    });
    dialState.textContent = s ? (s.stl || STATES[s.st]) : 'En attente';
    dialState.setAttribute('fill', s && s.stc === 'x' ? COL.guard : COL.text);
    dialStep.textContent = r ? 'étape ' + (r.idx + 1) + ' / ' + r.steps.length : 'aucune fabrication';

    MODS.forEach(function (m) {
      var on = s && s.m === m.id && !stopped;
      var sp = spokes[m.id];
      sp.line.setAttribute('stroke', on ? mods[m.id].color : '#24365c');
      sp.line.setAttribute('stroke-width', on ? 3 : 2);
      var u = ((st.clock * 0.7) % 1);
      sp.dot.setAttribute('opacity', on ? 1 : 0);
      if (on) { sp.dot.setAttribute('cx', sp.x0 + (sp.x1 - sp.x0) * u); sp.dot.setAttribute('cy', sp.y0 + (sp.y1 - sp.y0) * u); }
    });

    var lastOf = {};
    if (r) for (var i = 0; i <= r.idx; i++) lastOf[r.steps[i].m] = i;
    MODS.forEach(function (m) {
      var M = mods[m.id], li = lastOf[m.id], active = r && li === r.idx;
      var chk = li !== undefined ? r.steps[li].chk : '';
      var prog = active ? clamp(r.el / s.d, 0, 1) : 1;
      var failed = false;
      M.pills.forEach(function (pl, k) {
        var c = chk.charAt(k) || '-', state = 'idle';
        if (li !== undefined && c !== '-') {
          var revealed = !active || prog >= (k + 1) / (M.pills.length + 1) || prog >= 1;
          state = revealed ? (c === 'x' ? 'ko' : 'ok') : 'run';
          if (revealed && c === 'x') failed = true;
        }
        setPill(pl, state);
      });
      M.frame.setAttribute('stroke', failed ? COL.guard : (li !== undefined ? M.color : COL.line));
      M.frame.setAttribute('stroke-width', active ? 4 : (li !== undefined ? 2.5 : 2));
      M.g.style.filter = active && !stopped ? 'drop-shadow(0 0 10px ' + (failed ? COL.guard : M.color) + ')' : '';
      var par = active && s.par;
      M.prog.setAttribute('width', active ? 180 * prog : 0);
      M.prog.setAttribute('fill', par ? COL.agent : M.color);
      M.prog2.setAttribute('opacity', par ? 1 : 0);
      M.prog2.setAttribute('width', par ? 180 * clamp(prog * 0.85, 0, 1) : 0);
      if (M.beam) {
        var scanning = active && !stopped && prog < 1;
        M.beam.setAttribute('opacity', scanning ? 0.55 : 0);
        M.beam.setAttribute('x', -MW / 2 + ((st.clock * 90) % (MW - 4)));
      }
      if (m.id === 'sandbox') {
        var use = active && s.use ? s.use : null;
        M.tag.textContent = CLASSES[p.cls].iso + ' · ' + (use && use.length > 1 ? use.map(function (u) { return MODELS[u.k].n; }).join(' ‖ ') : '3 agents IA');
      }
      (m.roles || []).forEach(function (role) {
        var gl = glyphs[m.id + ':' + role];
        var done = false;
        if (r) for (var q = 0; q <= r.idx; q++) { var hs = r.steps[q]; if (hs.m === m.id && humanRoles(hs).indexOf(role) >= 0 && (q < r.idx || r.ok[q])) done = true; }
        var wait = r && s && s.m === m.id && humanRoles(s).indexOf(role) >= 0 && !r.ok[r.idx];
        setGlyph(gl, wait ? 'wait' : (done ? 'done' : 'idle'), stopped);
      });
    });
    var rssiWait = r && s && humanRoles(s).indexOf('RSSI') >= 0 && !r.ok[r.idx];
    var rssiDone = false;
    if (r) for (var q2 = 0; q2 <= r.idx; q2++) { var h2 = r.steps[q2]; if (humanRoles(h2).indexOf('RSSI') >= 0 && (q2 < r.idx || r.ok[q2])) rssiDone = true; }
    setGlyph(salleGlyph, rssiWait ? 'wait' : (rssiDone ? 'done' : 'idle'), stopped);
    salleCap.setAttribute('fill', st.estop || rssiDone ? '#7a1212' : '#d62828');

    if (r) {
      var th = MOD[s.m].th, from = r.idx > 0 ? MOD[r.steps[r.idx - 1].m].th : th;
      var k = r.idx > 0 ? ease(clamp(r.el / (s.d * 0.35), 0, 1)) : 1;
      var a = from + shortAngle(from, th) * k;
      var pt = onTrack(a);
      packet.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ',' + pt.y.toFixed(1) + ')');
      var label = s.pk || '';
      var w = Math.max(54, label.length * 6.6 + 18);
      pRect.setAttribute('width', w); pRect.setAttribute('x', -w / 2);
      pRect.setAttribute('stroke', s.rej ? COL.guard : (COL[MOD[s.m].type] || COL.warn));
      pText.textContent = label;
      packet.setAttribute('opacity', label ? 1 : 0);
      pX.setAttribute('opacity', s.rej && r.el > s.d * 0.4 ? 1 : 0);
    } else packet.setAttribute('opacity', 0);

    var frac = 0;
    if (r) {
      var pb = r.idx > 0 ? r.steps[r.idx - 1].bud : 0;
      frac = pb + (s.bud - pb) * clamp(r.el / s.d, 0, 1);
    }
    needle.setAttribute('transform', 'rotate(' + (clamp(frac, 0, 1) * 180).toFixed(1) + ')');
    gaugeVal.textContent = Math.round(clamp(frac, 0, 1) * 100) + ' % · plafond ' + CAPS[p.cap].n + ' · fictif';
    gaugeVal.setAttribute('fill', frac >= 0.9 ? COL.guard : COL.mute);

    var ci = CLASSES[p.cls], down = {}, active = {};
    if (r) for (var j = 0; j <= r.idx; j++) { var mo = r.steps[j].mod; if (mo && mo.down) mo.down.forEach(function (kk) { down[kk] = true; }); if (mo && mo.up) mo.up.forEach(function (kk) { delete down[kk]; }); }
    if (r && s.use) s.use.forEach(function (u) { active[u.k] = u.r; });
    ['A', 'B', 'I'].forEach(function (key) {
      var P = rpills[key], L = rlines[key];
      P.t1.textContent = MODELS[key].n;
      var byClass = ci.models.indexOf(key) >= 0, byProject = p.allow[key];
      var state = !byClass || !byProject ? 'blk' : (down[key] ? 'ko' : (active[key] ? 'act' : 'idle'));
      P.r.setAttribute('fill', state === 'act' ? '#0d3a5e' : (state === 'ko' ? '#4a1414' : COL.deep));
      P.r.setAttribute('stroke', state === 'act' ? COL.agent : (state === 'ko' ? COL.guard : (state === 'blk' ? '#3a4560' : COL.line)));
      P.t1.setAttribute('fill', state === 'blk' ? '#5d6b86' : COL.text);
      P.t2.textContent = state === 'act' ? active[key] : (state === 'blk' ? (byClass ? 'désactivé' : 'interdit (classe)') : (state === 'ko' ? 'indisponible' : MODELS[key].s));
      P.strike.setAttribute('opacity', state === 'blk' || state === 'ko' ? 1 : 0);
      P.strike.setAttribute('stroke', state === 'ko' ? COL.guard : '#5d6b86');
      var on = state === 'act' && !stopped;
      L.line.setAttribute('opacity', on ? 0.9 : 0);
      var u = ((st.clock * 0.9 + L.i * 0.3) % 1);
      var x1 = parseFloat(L.line.getAttribute('x1')), y1 = parseFloat(L.line.getAttribute('y1')), x2 = parseFloat(L.line.getAttribute('x2')), y2 = parseFloat(L.line.getAttribute('y2'));
      L.dot.setAttribute('opacity', on ? 1 : 0);
      L.dot.setAttribute('cx', x1 + (x2 - x1) * u); L.dot.setAttribute('cy', y1 + (y2 - y1) * u);
    });

    var stack = STACKS[p.stack];
    skillsFoot.textContent = 'Pile : ' + stack.n;
    var skillsOn = r && s && s.skills && !stopped;
    var loaded = r && lastOf.sandbox !== undefined;
    skillChips.forEach(function (c, i) {
      if (i === 3) c.t.textContent = stack.skills.join(' · ');
      var pulse = skillsOn && Math.floor(st.clock * 1.4) % 4 === i;
      c.r.setAttribute('fill', pulse ? '#0d3a5e' : COL.deep);
      c.r.setAttribute('stroke', loaded ? COL.agent : COL.line);
      c.t.setAttribute('fill', loaded ? COL.text : '#6b7a96');
    });

    var lc = r ? liveCounts(r) : { h: 0, g: 0 };
    $('k-ok').textContent = st.ok; $('k-ko').textContent = st.ko; $('k-h').textContent = st.hum + lc.h; $('k-g').textContent = st.gates + lc.g;

    renderCaption(r, s);
    $('clock').textContent = r ? 'T+' + mmss(r.starts[r.idx] + r.el) : 'T+00:00';
    if (document.activeElement !== $('scrub')) $('scrub').value = r ? Math.round(((r.starts[r.idx] + r.el) / r.total) * 1000) : 0;
    var line = r ? r.name + ' · ' + p.cls + ' · ' + STACKS[p.stack].n + ' · ' + p.tickets + ' ticket(s) · modèles : ' + (effectiveModels(p).map(function (k) { return MODELS[k].n; }).join(', ') || 'aucun') : 'Usine logicielle sous contrôle : orchestrateur déterministe, contrôles, humains aux points de décision';
    if ($('run-line').textContent !== line) $('run-line').textContent = line;
    if (st.logDirty) renderLog();
    renderPanes();
  }

  var capKey = '';
  function renderCaption(r, s) {
    var waiting = r && r.waiting, auto = $('autohuman').checked;
    var key = r ? [r.key, r.idx, waiting, auto, r.waitNext, st.flash].join('|') : 'idle|' + st.flash + '|' + (st.estop || '');
    if (key === capKey) return;
    capKey = key;
    var c = $('caption');
    c.textContent = '';
    function span(cls, text) { var e = H('span', { class: cls, text: text }); c.appendChild(e); return e; }
    if (st.flash) { span('title', st.flash); return; }
    if (!r) { span('title', 'Choisis un scénario, règle les entrées, ou laisse la démonstration tourner.'); return; }
    span('step', 'Étape ' + (r.idx + 1) + ' / ' + r.steps.length);
    var chip = span('chip', MOD[s.m].title); chip.style.borderColor = COL[MOD[s.m].type];
    span('title', s.t);
    if (s.st >= 1 && s.st <= 8 && (r.idx === 0 || r.steps[r.idx - 1].st !== s.st)) {
      var tr = TRANS[s.st - 1];
      span('guard', 'Transition vers « ' + tr[1] + ' » : condition = ' + tr[2]);
    }
    if (waiting) {
      var w = span('wait', '');
      if (auto) w.textContent = s.human.role + ' : ' + s.human.label + ' (validation simulée…)';
      else {
        var b = H('button', { type: 'button', class: 'btn go small', text: s.human.role + ' : ' + s.human.label });
        b.addEventListener('click', approve);
        w.appendChild(b);
      }
    } else if (r.waitNext) span('wait', 'Pas à pas : « Étape suivante » pour continuer');
  }

  var TAGC = { HUMAIN: COL.human, CONTRÔLE: COL.guard, AGENT: COL.agent, GITLAB: COL.ext, ORCH: COL.system, 'SYSTÈME': COL.mute, RSSI: COL.guard };
  function renderLog() {
    st.logDirty = false;
    var ol = $('log');
    ol.textContent = '';
    st.logLines.slice(-160).forEach(function (l) {
      var li = document.createElement('li');
      if (l.sep) { li.appendChild(H('span', { class: 'sep', text: l.x })); ol.appendChild(li); return; }
      var a = H('span', { class: 'tag', text: l.a }); a.style.color = TAGC[l.a] || COL.mute;
      li.appendChild(H('time', { text: l.t })); li.appendChild(a); li.appendChild(H('span', { text: l.x }));
      ol.appendChild(li);
    });
    ol.parentNode.scrollTop = ol.parentNode.scrollHeight;
  }

  /* ---------- Panneaux : scénarios, entrées, humains, orchestration ---------- */
  function previewSteps() {
    var key = paramsKey(st.params);
    if (key !== st.previewKey) { st.previewKey = key; st.preview = buildSteps(clone(st.params)); }
    return st.preview;
  }
  function buildScenList() {
    var host = $('scen-list');
    PRESETS.forEach(function (pr) {
      var b = H('button', { type: 'button', class: 'scen', 'data-id': pr.id }, [H('b', { text: pr.name }), H('span', { text: pr.short })]);
      b.addEventListener('click', function () { startRun(pr.id); });
      host.appendChild(b);
    });
  }
  function refreshScen() {
    Array.prototype.forEach.call($('scen-list').children, function (b) { b.classList.toggle('on', b.getAttribute('data-id') === st.sel); });
  }

  var paramsBuilt = false, ctl = {};
  function changed() { st.sel = ''; $('demo').checked = false; refreshScen(); st.dirty = true; }
  function segGroup(id, options, get, set) {
    var wrap = H('div', { class: 'seg', role: 'group' });
    options.forEach(function (o) {
      var b = H('button', { type: 'button', class: 'btn small', 'data-v': o[0], text: o[1] });
      b.addEventListener('click', function () { set(o[0]); changed(); });
      wrap.appendChild(b);
    });
    ctl[id] = function () { Array.prototype.forEach.call(wrap.children, function (b) { b.classList.toggle('on', b.getAttribute('data-v') === String(get())); }); };
    return wrap;
  }
  function field(label, node, noteId) {
    return H('div', { class: 'field' }, [H('label', { text: label }), node, noteId ? H('p', { class: 'note', id: noteId }) : null]);
  }
  function buildParams() {
    var host = $('params'), P = function () { return st.params; };
    host.appendChild(field('Mode', segGroup('mode', [['creation', 'Création'], ['feature', 'Feature'], ['campagne', 'Campagne']], function () { return P().mode; }, function (v) { P().mode = v; })));
    host.appendChild(field('Classe du projet', segGroup('cls', [['C0', 'C0'], ['C1', 'C1'], ['C2', 'C2'], ['C3', 'C3']], function () { return P().cls; }, function (v) { P().cls = v; }), 'cls-text'));
    var sel = H('select', { class: 'sel', 'aria-label': 'Pile technique' });
    Object.keys(STACKS).forEach(function (k) { sel.appendChild(H('option', { value: k, text: STACKS[k].n + ' (' + STACKS[k].note + ')' })); });
    sel.addEventListener('change', function () { P().stack = sel.value; changed(); });
    ctl.stack = function () { sel.value = P().stack; };
    host.appendChild(field('Langage (règles de pile du service commun)', sel, 'stack-text'));
    var rng = H('input', { type: 'range', min: 1, max: 6, value: 3, 'aria-label': 'Nombre de tickets' });
    var rv = H('span', { class: 'rv', text: '3' });
    rng.addEventListener('input', function () { P().tickets = parseInt(rng.value, 10); rv.textContent = rng.value; changed(); });
    ctl.tickets = function () { rng.value = P().tickets; rv.textContent = P().tickets; };
    host.appendChild(field('Tickets embarqués', H('div', { class: 'rng' }, [rng, rv])));
    host.appendChild(field('Plafond de budget', segGroup('cap', [['serre', 'Serré'], ['normal', 'Normal'], ['large', 'Large']], function () { return P().cap; }, function (v) { P().cap = v; })));
    var mods3 = H('div', { class: 'checks' });
    ['A', 'B', 'I'].forEach(function (k) {
      var cb = H('input', { type: 'checkbox', 'aria-label': 'Autoriser le modèle ' + k });
      cb.addEventListener('change', function () { P().allow[k] = cb.checked; changed(); });
      var ms = H('select', { class: 'sel', 'aria-label': 'Modèle d\'exemple, emplacement ' + k + ' (' + MODELS[k].s + ')' });
      MODEL_CHOICES[k].forEach(function (nm) { ms.appendChild(H('option', { value: nm, text: nm })); });
      ms.addEventListener('change', function () {
        /* deux emplacements cloud ne portent jamais le même modèle : échange avec l'autre */
        var other = k === 'A' ? 'B' : (k === 'B' ? 'A' : null);
        if (other && MODELS[other].n === ms.value) MODELS[other].n = MODELS[k].n;
        MODELS[k].n = ms.value;
        changed();
      });
      mods3.appendChild(H('div', { class: 'chk' }, [cb, ms, H('span', { text: ' ' + MODELS[k].s })]));
      ctl['allow' + k] = function () { cb.checked = !!P().allow[k]; ms.value = MODELS[k].n; };
    });
    host.appendChild(field('Modèles d\'IA autorisés par le projet (noms d\'exemple, au choix)', mods3, 'allow-text'));
    host.appendChild(field('Pilotage des modèles', segGroup('policy', [['seul', 'Un seul modèle'], ['duo', 'Deux en parallèle']], function () { return P().policy; }, function (v) { P().policy = v; }), 'policy-text'));
    host.appendChild(field('Équipe plateforme en cas d\'escalade', segGroup('esc', [['arret', 'Arrêter la fabrication'], ['reprise', 'Intervenir et reprendre']], function () { return P().esc; }, function (v) { P().esc = v; }), 'esc-text'));
    var fl = H('div', { class: 'checks' });
    FAULTS.forEach(function (k) {
      var cb = H('input', { type: 'checkbox' });
      cb.addEventListener('change', function () { P().faults[k] = cb.checked; changed(); });
      fl.appendChild(H('label', { class: 'chk' }, [cb, H('span', { text: FAULT_TXT[k][0] + ' : ' + FAULT_TXT[k][1] })]));
      ctl['f' + k] = function () { cb.checked = !!P().faults[k]; };
    });
    host.appendChild(field('Pannes et cas limites injectés', fl));
    paramsBuilt = true;
  }
  function refreshParams() {
    if (!paramsBuilt) return;
    Object.keys(ctl).forEach(function (k) { ctl[k](); });
    var p = st.params, ci = CLASSES[p.cls], eff = effectiveModels(p);
    var set = function (id, txt) { var e = $(id); if (e) e.textContent = txt; };
    set('cls-text', ci.txt);
    set('stack-text', 'Règles chargées : connexion SSO (SAML / OIDC), règles IA, design system + ' + STACKS[p.stack].skills.join(', ') + '. L\'orchestration, les contrôles et les modèles ne changent pas.');
    set('esc-text', p.esc === 'reprise' ? 'L\'ingénieur plateforme diagnostique et relance (boucle, budget, modèle) dans le périmètre du plan figé ; les échecs de contrôle de sortie restent des arrêts.' : 'Toute escalade arrête la fabrication (cellule détruite, clé révoquée).');
    set('allow-text', 'Effectifs (classe ∩ projet) : ' + (eff.length ? eff.map(function (k) { return MODELS[k].n; }).join(', ') : 'aucun, refus par défaut') + '.');
    set('policy-text', p.policy === 'duo' ? (eff.length >= 2 ? 'Tests et relecture sur ' + MODELS[eff[0]].n + ', implémentation sur ' + MODELS[eff[1]].n + ' ; en parallèle dès 2 tickets.' : 'Deux modèles requis : un seul est autorisé, retour à un modèle unique.') : 'Les trois rôles utilisent le même modèle (indépendance réduite).');
    set('derived', 'Isolation ' + ci.iso + ' · ' + ci.appr + ' approbateur(s) · budget ' + CAPS[p.cap].n + ' · ' + p.tickets + ' ticket(s). Les entrées s\'appliquent au prochain lancement.');
  }

  function renderHumans() {
    var r = st.run, steps = r ? r.steps : previewSteps(), list = [];
    steps.forEach(function (s, i) { if (s.human) list.push({ i: i, s: s }); });
    var roster = $('roster'), dec = $('decisions');
    var count = {}, now = {};
    list.forEach(function (x) {
      humanRoles(x.s).forEach(function (ro) {
        count[ro] = (count[ro] || 0) + 1;
        if (r && x.i === r.idx && !r.ok[x.i]) now[ro] = true;
      });
    });
    roster.textContent = '';
    ['PO', 'UX', 'CP', 'ING', 'RSSI', 'PLAT'].forEach(function (ro) {
      roster.appendChild(H('div', { class: 'role' + (now[ro] ? ' now' : '') }, [
        H('b', { text: ro + ' · ' + ROLES[ro].n }),
        H('span', { class: 'rs', text: now[ro] ? 'décision attendue' : (count[ro] ? count[ro] + ' décision(s) prévue(s)' : 'en veille') }),
        H('p', { text: ROLES[ro].d }),
      ]));
    });
    dec.textContent = '';
    if (!list.length) dec.appendChild(H('li', { text: 'Aucune décision humaine dans cette fabrication.' }));
    list.forEach(function (x) {
      var state = !r ? 'plan' : (x.i < r.idx || r.ok[x.i] ? 'done' : (x.i === r.idx ? 'now' : 'plan'));
      var mark = state === 'done' ? '✔' : (state === 'now' ? '⏳' : '○');
      dec.appendChild(H('li', { class: state }, [H('span', { class: 'mk', text: mark }), H('span', { text: humanRoles(x.s).join(' + ') + ' · ' + x.s.human.label + ' (' + MOD[x.s.m].title + ')' })]));
    });
  }
  function renderOrch() {
    var r = st.run, s = r ? r.steps[r.idx] : null, cur = s ? s.st : -1;
    var host = $('trans');
    host.textContent = '';
    var tbl = H('table');
    tbl.appendChild(H('tr', null, [H('th', { text: 'Transition' }), H('th', { text: 'Condition' }), H('th', { text: 'Par' })]));
    TRANS.forEach(function (t, i) {
      var cls = cur === i + 1 ? 'now' : (cur > i + 1 ? 'done' : (cur === i ? 'next' : ''));
      tbl.appendChild(H('tr', { class: cls }, [H('td', { text: t[0] + ' → ' + t[1] }), H('td', { text: t[2] }), H('td', { text: t[3] })]));
    });
    host.appendChild(tbl);
    var rp = $('replays');
    rp.textContent = '';
    if (!st.replays.length) rp.appendChild(H('p', { class: 'note', text: 'Aucune fabrication pour l\'instant.' }));
    st.replays.slice().reverse().forEach(function (x) {
      var badge = x.same === null ? 'première fabrication avec ces entrées' : (x.same ? 'chemin identique ✔' : 'chemin différent');
      rp.appendChild(H('div', { class: 'rp' }, [
        H('b', { text: x.name }),
        H('span', { text: 'chemin d\'état #' + x.path + ' (déterministe) · ' + badge }),
        H('span', { class: 'mute', text: 'contenu généré #' + x.content + ' (varie à chaque fabrication)' }),
      ]));
    });
  }
  var lastSig = '';
  function currentPane() {
    var ids = ['p-scen', 'p-params', 'p-humans', 'p-orch', 'p-info', 'p-log'];
    for (var i = 0; i < ids.length; i++) if (!$(ids[i]).hidden) return ids[i];
    return '';
  }
  function renderPanes() {
    var pane = currentPane();
    var sig = pane + '|' + (st.run ? st.run.key + '|' + st.run.idx + '|' + st.run.waiting + '|' + Object.keys(st.run.ok).length : 'idle') + '|' + st.replays.length;
    if (sig === lastSig && !st.dirty) return;
    lastSig = sig; st.dirty = false;
    if (pane === 'p-params') refreshParams();
    if (pane === 'p-humans') renderHumans();
    if (pane === 'p-orch') renderOrch();
  }

  /* ---------- Détail d'un composant ---------- */
  var INFO = {
    orchestre: { t: 'Orchestrateur déterministe', w: 'Machine à états unique : Cadrage, Contrôle d\'entrée, Planification, Prêt à lancer, Lancé, Exécution, Contrôle de sortie, Revue, Fusionné. Mêmes entrées, mêmes états, mêmes contrôles, mêmes outils : le workflow est déterministe, pas la sortie des modèles. Chaque transition a une garde explicite (onglet Orchestration).', h: 'Il sollicite un humain au plan, au go, à la revue et à l\'escalade. Il n\'étend jamais ses propres droits.', k: 'Workflow durable (candidat : Temporal), snapshot immuable du run, journal rejouable, budget de première classe (invariants 1, 4, 7, 10).', usine: 0, tech: 4 },
    portail: { t: 'Portail de dépôt', w: 'Le PO choisit les tickets à embarquer, le designer dépose les maquettes. Le dossier est enregistré puis figé.', h: 'Product Owner (tickets), UX/UI designer (maquettes).', k: 'Portail web, registre de projets et de droits propre à PHARE, connecteurs tickets et maquettes derrière interface.', usine: 2, tech: 0 },
    entree: { t: 'Contrôle d\'entrée', w: 'Avant tout calcul coûteux : complétude, détection d\'injection dans les tickets et maquettes, contrôle déterministe des données personnelles, classification C0 à C3 et vérification qu\'un modèle est autorisé. Un dossier refusé revient avec son motif.', h: 'Aucune validation humaine : le PO ou le designer corrige et redépose.', k: 'Règles en code et classifieurs en services séparés, fail-closed. Le contenu externe est une donnée : il ne confère aucune autorité (invariant 2).', usine: 12, tech: 1 },
    plan: { t: 'Planification et go', w: 'L\'usine produit seule le plan et les intentions de test, validés par des règles déterministes. Le chef de projet lit le plan chiffré et signe le go : c\'est le seul acte humain. Le run est lié à un dossier figé immuable.', h: 'Chef de projet : go signé, jamais approbateur de la MR. Le PO ne valide pas le plan ; un validateur d\'intentions reste possible en option par projet (ADR 0006).', k: 'Plan-then-execute, snapshot scellé (backlog, maquettes, plan, classe, SHA, versions), budget estimé.', usine: 22, tech: 2 },
    sandbox: { t: 'Cellule isolée et agents', w: 'Trois rôles d\'agents : auteur des tests, implémenteur, relecteur consultatif. Tests gelés avant l\'implémentation, aucun secret longue durée, sortie réseau en liste blanche, écriture vers la forge uniquement par l\'orchestrateur via un patch. Les rôles peuvent utiliser des modèles différents, en parallèle.', h: 'Personne n\'intervient ; le RSSI garde l\'arrêt d\'urgence.', k: 'Isolation N2 minimum, N3 pour C3 (Kubernetes), boucle d\'agent interne derrière AgentRunner, modèles via LlmProvider, skills selon la pile.', usine: 50, tech: 5 },
    skills: { t: 'Service commun de skills', w: 'Service commun d\'entreprise, catalogue signé, versionné et revu : socle d\'authentification SAML / OIDC, skills IAG (IA générative), design system, skills de pile par langage. Un projet demande des skills ; l\'orchestrateur résout et épingle les versions. Changer de langage change les skills de pile, pas l\'orchestration ni les gardes.', h: 'Des experts rédigent et relisent les skills ; propriétaire du service commun à nommer.', k: 'Frontière de confiance (signature, revue, versionnage), consommée par interface (ADR 0006) ; une pile hors gabarit du MVP exige sa qualification (illustratif ici).', usine: 50, tech: 6 },
    sortie: { t: 'Contrôle de sortie', w: 'Contrôle indépendant du générateur : tests gelés, mutation, analyse statique, secrets, politique de diff. Un échec déclenche une autocorrection bornée, sinon escalade.', h: 'Aucun : tout est consigné dans le dossier de preuves.', k: 'Gate indépendant (invariant 3), dossier de preuves attaché à la MR.', usine: 66, tech: 8 },
    forge: { t: 'Forge GitLab', w: 'PHARE ouvre la Merge Request avec son dossier de preuves ; le pipeline CI s\'exécute ; un ingénieur relit et approuve selon les règles d\'approbation GitLab. PHARE n\'a ni droit d\'approbation ni droit de fusion.', h: 'Ingénieur logiciel : relecteur et approbateur ; deux approbateurs distincts en renforcé (C3).', k: 'GitLab payant interne, règles d\'approbation, vérification du cadre de revue au préflight (faisabilité à vérifier), invariant 6.', usine: 80, tech: 10 },
    prod: { t: 'Fusion et production', w: 'Fusion et déploiement relèvent de GitLab ; PHARE observe l\'état Fusionné sans le piloter.', h: 'Selon les règles de l\'entreprise, dans GitLab.', k: 'Environnements protégés de GitLab, observation par API et webhooks.', usine: 88, tech: 11 },
    escalade: { t: 'Équipe plateforme (escalade)', w: 'Quand une fabrication sort de son enveloppe (boucle d\'agent bloquée, budget, modèle indisponible sans repli, échec répété), l\'équipe reçoit un paquet d\'escalade lisible (état, essais, coûts, dernière erreur). Elle peut relancer dans le périmètre du plan figé (autre modèle autorisé, contexte reconstruit, plafond relevé dans sa délégation), abandonner ou mettre en quarantaine. Élargir le périmètre exige un nouveau dossier figé et un nouveau go.', h: 'Ingénieur plateforme (équipe de construction au début, puis équipe de run dédiée).', k: 'Console d\'escalade, runbooks, kill switch par run, campagne, projet ou global.', usine: 66, tech: 12 },
    budget: { t: 'Budget de fabrication', w: 'Chaque fabrication a un plafond de consommation de tokens ; le dépassement suspend la fabrication et escalade. Le budget est une ressource de première classe. Le plafond (serré, normal, large) est une entrée de la fabrication.', h: 'Un humain décide de relever (dans sa délégation) ou d\'arrêter.', k: 'Budgets par run et par projet, clé virtuelle éphémère plafonnée, coût par tâche réussie. Valeurs de la simulation : illustratives.', usine: 50, tech: 12 },
    router: { t: 'Modèles d\'IA et passerelle', w: 'Les modèles restent hors de la cellule. La cellule n\'a pas d\'internet libre, quel que soit le niveau (C0 à C3) : l\'agent joint son modèle par une seule passerelle surveillée, avec une clé temporaire plafonnée. Niveaux C0 à C2 : modèle cloud ou interne ; niveau C3 : modèles internes seulement. La recherche web ou l\'exécution de code menées par le fournisseur (côté fournisseur, hors de portée de la cellule) sont refusées : la passerelle rejette toute requête qui les active. Les noms affichés (Claude, Gemini, Codex, Mistral, Kimi) sont des exemples : PHARE n\'est lié à aucun d\'eux. Une interface unique route vers les modèles autorisés pour la classe du projet. Deux modèles peuvent travailler en parallèle sur deux tâches différentes. Une panne bascule sur un autre modèle sans changer le workflow ; sans repli autorisé, la fabrication est suspendue.', h: 'Gouvernance et RSSI décident quels modèles sont autorisés par classe.', k: 'Interface LlmProvider, deux familles de modèles au MVP, matrice de capacités, suite de conformité (invariant 11).', usine: 50, tech: 6 },
    estop: { t: 'Salle de contrôle et arrêt d\'urgence', w: 'Le RSSI (ou son adjoint) fixe les règles de classe et dispose de l\'arrêt d\'urgence (le bouton rouge de la salle de contrôle fait la même chose que celui du pupitre) : il gèle les fabrications, détruit les sandboxes, révoque les clés temporaires, interdit les lancements. Le réarmement exige un déverrouillage puis un acquittement explicite : la plateforme ne redémarre jamais seule.', h: 'RSSI (éventuellement son adjoint). Actionnable sans l\'IdP via un compte de secours (à définir avec le RSSI).', k: 'Portée run, campagne, projet ou global (invariant 12). Disponibilité du kill switch suivie dans le modèle de menaces (A12).', usine: 0, tech: 12 },
  };
  function showInfo(key) {
    var d = INFO[key]; if (!d) return;
    $('i-title').textContent = d.t; $('i-what').textContent = d.w; $('i-human').textContent = d.h; $('i-tech').textContent = d.k;
    $('x-usine').href = 'usine.html#t=' + d.usine;
    $('x-tech').href = 'index.html#creation/' + d.tech;
    setPane('p-info');
  }
  function setPane(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('on', t.getAttribute('data-pane') === id); });
    ['p-scen', 'p-params', 'p-humans', 'p-orch', 'p-log', 'p-info', 'p-gloss'].forEach(function (pn) { $(pn).hidden = pn !== id; });
    if (id === 'p-log') st.logDirty = true;
    st.dirty = true;
  }

  /* ---------- Interactions ---------- */
  svg.addEventListener('click', function (e) {
    var n = e.target;
    while (n && n !== svg) {
      if (n.getAttribute && n.getAttribute('data-action') === 'estop') { engage(); return; }
      if (n.getAttribute && n.getAttribute('data-key')) { showInfo(n.getAttribute('data-key')); return; }
      n = n.parentNode;
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
    t.addEventListener('click', function () { setPane(t.getAttribute('data-pane')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (b) {
    b.addEventListener('click', function () {
      st.speed = parseFloat(b.getAttribute('data-speed'));
      Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (o) { o.classList.toggle('on', o === b); });
    });
  });
  var flashTimer = 0;
  $('demo').addEventListener('change', function () { if ($('demo').checked) { st.demoIdx = 0; st.idle = 0; } });
  function flash(msg) { st.flash = msg; clearTimeout(flashTimer); flashTimer = setTimeout(function () { st.flash = ''; }, 3500); }
  function setPlaying(p) { st.playing = p; $('play').textContent = p ? 'Pause' : 'Lecture'; }
  $('play').addEventListener('click', function () { setPlaying(!st.playing); });
  function prev() {
    var r = st.run; if (!r || st.estop) return;
    if (!st.stepmode && r.el > 1.5 && !r.waiting) { r.el = 0; r.waitNext = false; r.hold = 0; return; }
    if (r.idx === 0) { r.el = 0; r.waiting = false; r.waitNext = false; r.hold = 0; return; }
    r.idx -= 1; r.waiting = false; r.hold = 0; r.fin = false;
    Object.keys(r.ok).forEach(function (k) { if (parseInt(k, 10) >= r.idx) delete r.ok[k]; });
    for (var j = 0; j < r.idx; j++) if (r.steps[j].human) r.ok[j] = true;
    if (st.stepmode) { r.el = r.steps[r.idx].d; if (r.steps[r.idx].human) r.ok[r.idx] = true; r.waitNext = true; } else { r.el = 0; r.waitNext = false; }
    syncLog(); st.dirty = true;
  }
  $('prev').addEventListener('click', prev);
  $('next').addEventListener('click', function () {
    if (st.estop) return;
    var r = st.run;
    if (!r) { startRun(st.sel || null); return; }
    if (r.waiting) approve(); else advance();
  });
  $('stepmode').addEventListener('change', function (e) { st.stepmode = e.target.checked; if (st.run && !st.stepmode) st.run.waitNext = false; });
  $('scrub').addEventListener('input', function (e) { if (!st.estop) seekTo(parseFloat(e.target.value) / 1000); });
  $('launch').addEventListener('click', function () { startRun(null); });
  $('replay').addEventListener('click', function () { if (st.lastParams) st.params = clone(st.lastParams); startRun(null); });
  document.addEventListener('keydown', function (e) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); setPlaying(!st.playing); }
    if (e.key === 'Escape') engage();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight' && !st.estop && st.run) { if (st.run.waiting) approve(); else advance(); }
  });

  /* Arrêt d'urgence : engagé (verrouillé) → déverrouillé (tourner) → acquitté (redémarrage explicite) */
  function paintEstop() {
    var cap = $('estop'), lamp = $('lamp'), txt = $('estop-text');
    $('release').hidden = st.estop !== 'latched';
    $('ack').hidden = st.estop !== 'released';
    cap.classList.toggle('latched', st.estop === 'latched');
    $('estop-banner').hidden = !st.estop;
    document.querySelector('.scene').classList.toggle('stopped', !!st.estop);
    if (!st.estop) { lamp.className = 'lamp ok'; lamp.textContent = 'EN SERVICE'; txt.textContent = 'Réservé au RSSI ou à son adjoint. Appuyer (ou Échap) pour geler l\'usine.'; }
    else if (st.estop === 'latched') { lamp.className = 'lamp stop'; lamp.textContent = 'ARRÊT D\'URGENCE'; txt.textContent = 'Bouton verrouillé. Tourner pour déverrouiller, puis acquitter.'; }
    else { lamp.className = 'lamp ack'; lamp.textContent = 'À ACQUITTER'; txt.textContent = 'Déverrouillé. L\'usine reste arrêtée jusqu\'à l\'acquittement.'; }
  }
  function engage() {
    if (st.estop) return;
    st.estop = 'latched';
    addLogLine(st.run ? mmss(st.run.starts[st.run.idx] + st.run.el) : '--:--', 'RSSI', 'Arrêt d\'urgence engagé : fabrications gelées, cellules détruites, clés révoquées');
    paintEstop();
  }
  $('estop').addEventListener('click', engage);
  $('release').addEventListener('click', function () { if (st.estop === 'latched') { st.estop = 'released'; paintEstop(); } });
  $('ack').addEventListener('click', function () {
    if (st.estop !== 'released') return;
    st.estop = null;
    addLogLine('--:--', 'RSSI', 'Acquittement : reprise manuelle de l\'exploitation');
    if (st.run) endRun(true);
    paintEstop();
  });

  /* ---------- Boucle ---------- */
  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(dt);
    render();
    requestAnimationFrame(frame);
  }

  /* Hash de revue : #s=duo&i=3&e=0.5&c=C2&stack=python-react&tk=4&cap=serre&pol=duo&f=secret,kill&tab=orch&key=router&estop=1 */
  function fromHash() {
    var h = (window.location.hash || '').replace(/^#/, '');
    if (!h) return;
    /* Seules les clés connues sont lues, dans un objet sans prototype : le nom d'une propriété ne vient jamais de l'URL sans contrôle. */
    var q = Object.create(null), KEYS = ['s', 'i', 'e', 'c', 'stack', 'tk', 'cap', 'pol', 'f', 'tab', 'key', 'estop'];
    h.split('&').forEach(function (kv) {
      var x = kv.split('=');
      if (KEYS.indexOf(x[0]) < 0) return;
      try { q[x[0]] = decodeURIComponent(x[1] || ''); } catch (err) { q[x[0]] = ''; }
    });
    var p = st.params;
    if (q.c && CLASSES[q.c]) p.cls = q.c;
    if (q.stack && STACKS[q.stack]) p.stack = q.stack;
    if (q.tk) p.tickets = clamp(parseInt(q.tk, 10) || 3, 1, 6);
    if (q.cap && CAPS[q.cap]) p.cap = q.cap;
    if (q.s && PRESET[q.s]) {
      $('demo').checked = false;
      st.params = applyPreset(p, q.s); st.sel = q.s;
      if (q.pol) st.params.policy = q.pol === 'duo' ? 'duo' : 'seul';
      if (q.f) q.f.split(',').forEach(function (f) { if (FAULTS.indexOf(f) >= 0) st.params.faults[f] = true; });
      startRun(null);
      var r = st.run, i = clamp(parseInt(q.i || '0', 10), 0, r.steps.length - 1);
      for (var j = 0; j < i; j++) if (r.steps[j].human) r.ok[j] = true;
      r.idx = i; r.el = clamp(parseFloat(q.e || '0') * r.steps[i].d, 0, r.steps[i].d);
      syncLog();
      setPlaying(false);
    }
    if (q.estop) { engage(); if (q.estop === '2') { st.estop = 'released'; paintEstop(); } }
    if (q.key) showInfo(q.key);
    if (q.tab) setPane({ scen: 'p-scen', params: 'p-params', humans: 'p-humans', orch: 'p-orch', log: 'p-log', info: 'p-info', gloss: 'p-gloss' }[q.tab] || 'p-scen');
  }

  buildScenList();
  buildParams();
  refreshScen();
  paintEstop();
  fromHash();
  render();
  requestAnimationFrame(frame);
})();
