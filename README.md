# prototype_2D

Trois vues animées du fonctionnement de PHARE, reliées par une barre de navigation commune et des liens croisés. Aucune dépendance, aucun serveur : ouvrir le fichier dans un navigateur.

| Vue | Fichier | Public | Contenu |
|---|---|---|---|
| **Simulateur** | `simulateur.html` | Ingénieurs, DSI, salon | Synoptique interactif : orchestrateur déterministe au centre, huit modules autour, 16 scénarios, entrées paramétrables, humains, intervention de l'équipe plateforme, deux modèles en parallèle, service commun de skills, arrêt d'urgence |
| **Chaîne de production** | `usine.html` | Visiteurs de salon, public large | Visite guidée : 8 stations de la réception à la livraison, vitesses 0,75× à 4×, interruptible à tout moment ; la case « Enchaîner les versions » (cochée par défaut) boucle sur les 5 versions ; décochée, ou après un choix manuel ou un lien profond, la visite s'arrête en fin de parcours (« Rejouer » relance) |
| **Technique** | `index.html` | DSI, architectes | Schéma des acteurs, dépendances et contrôles, trois scénarios (création, feature, campagne) |

## Vocabulaire

Les trois vues parlent la même langue : « fabrication » (run), « cellule isolée » (sandbox), « contrôle d'entrée / de sortie » (gardes, préflight), « dossier figé et signé » (snapshot), « arrêt d'urgence » (kill switch). Les termes d'ingénierie restent dans la rubrique « Sous le capot » et le glossaire (onglet Mots). Toute valeur chiffrée affichée est fictive.

## Déploiement

Site statique de 11 fichiers, sans build ni serveur applicatif : [DEPLOIEMENT-APACHE.md](DEPLOIEMENT-APACHE.md) décrit la publication sur Apache (configuration, en-têtes de sécurité, contrôles, retour arrière).

## Intégration continue

Workflow GitHub Actions (`.github/workflows/ci.yml`), lancé à chaque `push` sur `main`, à chaque `pull request` et chaque lundi :

- **Vérifications de base** (`.github/scripts/checks.sh`, lançable en local avec `bash .github/scripts/checks.sh`) : syntaxe JavaScript, aucune ressource externe, aucun script ni gestionnaire d'événement en ligne, aucun `eval`, aucun appel réseau ni stockage navigateur, structure des pages HTML, fichiers et liens relatifs existants, aucun secret apparent.
- **Analyse statique de sécurité (SAST)** : CodeQL sur le JavaScript, requêtes « security-extended ». Les résultats apparaissent dans l'onglet *Security > Code scanning* (disponible sur un dépôt public ; sur un dépôt privé, il faut GitHub Advanced Security, à vérifier).
- **Mise à jour des actions** : Dependabot (hebdomadaire). Les actions sont épinglées par empreinte de commit.

## Signification de PHARE

**P**lateforme **H**ybride **A**gentique de **R**éalisation **E**ncadrée : rappelée dans l'en-tête des trois vues.

## Navigation

- **Barre commune** en haut des trois vues, avec la vue courante en surbrillance.
- **Liens croisés** : chaque étape de la chaîne propose « Voir ce composant dans le simulateur » ; chaque composant du simulateur renvoie vers l'étape de la chaîne et vers l'étape de la vue technique ; la vue technique renvoie vers le simulateur (même scénario) et vers la chaîne (même étape).
- **Liens profonds** : `usine.html#t=50`, `index.html#creation/5`, `simulateur.html#s=duo`.

## Simulateur

- **Démo automatique** (case « stand », activée par défaut) : 5 scénarios à la suite puis arrêt (cocher à nouveau la case pour relancer), choisis pour montrer des facettes différentes : projet complet avec deux modèles en parallèle, projet confidentiel C3 (modèles internes), ticket piégé (injection), contrôle de sortie en échec (banc d'essai), agent bloqué avec intervention du « mécanicien » (équipe plateforme). Les 16 scénarios restent jouables à la main ; toute modification d'une entrée coupe la démo.
- **Scénarios prêts à jouer** (16) : création, feature, campagne sur 2 applications, deux modèles en parallèle, autre langage (Python + React), ticket piégé, secret en sortie, tests insuffisants, fournisseur indisponible, projet C3, aucun modèle autorisé, dépassement de budget, **boucle d'agent bloquée avec intervention de l'équipe plateforme**, **budget relevé par l'équipe plateforme**, changements demandés en revue, kill switch.
- **Entrées du run** (onglet Entrées) : mode, classe C0 à C3, pile technique (puits de skills), nombre de tickets, plafond de budget, modèles autorisés par le projet, pilotage des modèles (un seul ou deux en parallèle), huit pannes injectables et la décision de l'équipe plateforme en cas d'escalade (arrêter le run ou intervenir et reprendre). Un scénario règle ces entrées ; elles restent modifiables.
- **Humains** : pictogrammes de rôle sur les modules (PO, UX, CP, ING, PLAT) et sur la salle de contrôle (RSSI) qui clignotent quand une décision est attendue ; onglet Humains (qui décide quoi, décisions du run, y compris prévues avant lancement) ; option « Humains simulés » pour une démonstration autonome, sinon bouton de validation.
- **Planification** : l'usine produit seule le plan et les tests prévus ; le go du chef de projet est le seul acte humain (ADR 0006).
- **Équipe plateforme** : sur boucle d'agent bloquée, budget atteint ou fournisseur indisponible sans repli, elle reçoit un paquet d'escalade, relance dans le périmètre du plan figé (autre modèle autorisé, contexte reconstruit, plafond relevé dans sa délégation) ou arrête le run.
- **Service commun de skills** : catalogue signé (socle SAML / OIDC, skills IAG, design system, skills de pile) ; changer de langage ne change que les skills de pile.
- **Modèles d'IA (noms d'exemple)** : Claude, Gemini, Codex (cloud, niveaux C0 à C2), Kimi, Mistral (internes, seuls permis en C3). Les noms se changent dans l'onglet Entrées ; ils illustrent l'agnosticisme, PHARE n'est lié à aucun éditeur (à vérifier avec le RSSI avant tout usage réel d'un modèle d'origine donnée). Les modèles sont dessinés **hors** de la cellule isolée ; les agents les joignent par une **passerelle surveillée**, sans internet libre, quel que soit le niveau.
- **Onglet Mots** : glossaire en langage courant (cellule isolée, passerelle, banc d'essai, dossier figé…).
- **Modèles et langages** : routeur de modèles (autorisation par classe et par projet, indisponibilité, repli, deux modèles actifs en même temps sur deux tâches) ; puits de skills selon la pile choisie. Changer de langage ne change ni l'orchestration ni les gardes.
- **Orchestration déterministe** (onglet Orchestration) : table des transitions avec leur garde, transition courante surlignée ; rejeu avec les mêmes entrées : le chemin d'états est identique, le contenu généré varie.
- **Transport** : étape précédente, pause, étape suivante (flèches gauche et droite), pas à pas, vitesse ×1/×2/×4, curseur de position. L'affichage est une fonction de (entrées, étape, temps) : sauts et pas à pas sont exacts.
- **Arrêt d'urgence** : bouton coup de poing sur plaque jaune (touche Échap). Trois états : engagé (verrouillé), déverrouillé (tourner), acquitté (redémarrage explicite). Le run en cours est interrompu à l'acquittement.
- **Revue** : `simulateur.html#s=duo&i=6&e=0.5&c=C2&stack=python-react&tk=4&cap=serre&pol=duo&f=secret,kill&tab=orch&key=router&estop=1` ouvre un scénario à une étape donnée (en pause).

## Chaîne de production

**Cinq versions** au sélecteur « Version » (lien profond `usine.html#v=piege&t=18`) : nominale ; ticket piégé refusé à l'entrée (`v=piege`) ; contrôle de sortie en échec (`v=sortie-ko`) ; projet confidentiel C3 avec modèles internes seuls et deux approbateurs (`v=c3`) ; agent bloqué avec intervention du « mécanicien » de l'équipe plateforme (`v=meca`). Chaque cas non nominal renvoie vers le scénario équivalent du simulateur. Le cas d'échec ajoute un état « Abandonné » au bandeau du cycle de vie.

Sobre et lisible de loin : postes d'agent industriels avec le glyphe de leur rôle (tests, code, relecture, plan), modèles d'IA en cartes **hors** de la cellule, et un bandeau « SORTIE » sous chaque station (ce que l'étape produit, coché quand elle est franchie).

Huit stations : réception, contrôle d'entrée, bureau d'études (plan et tests prévus), feu vert (GO, snapshot scellé, clé plafonnée), atelier robotisé (deux modèles en parallèle, relecteur indépendant, règles chargées, budget), contrôle de sortie (autocorrection bornée, dossier de preuves), quai GitLab (MR, CI, relecture humaine), livraison. Les personnes travaillent sur des postes suspendus : le colis passe dessous. Bandeau du cycle de vie en haut. Lecture automatique, valeurs affichées marquées « illustratives », interruptible (clic, glisser, molette, barre d'espace, curseur) ; plein écran pour un stand.

## Fichiers

- `nav.css` : barre de navigation commune.
- `simulateur.html`, `simulateur.css`, `simulateur.js` : simulateur.
- `usine.html`, `usine.css`, `usine.js` : chaîne de production.
- `index.html`, `style.css`, `app.js`, `data.js` : vue technique, alignée sur les ADR 0001 à 0006 (passerelle modèle, outils côté fournisseur refusés, fichier de contexte projet AGENTS.md).

## Règles

- **Source de vérité** : la conception documentée (`docs/conception/`, ADR). Ces vues ne la remplacent pas ; toute modification se fait après celle des documents.
- **Limites** : simulation illustrative, aucune valeur mesurée, aucune exécution. Piles hors gabarit du MVP (Python + React, .NET + Angular) illustratives, à qualifier. Vérifié visuellement avec Edge sans interface (1280x720 à 1864x900) sur captures statiques ; animations non contrôlées dans d'autres navigateurs.
