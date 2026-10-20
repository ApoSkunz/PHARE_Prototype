# Déployer le prototype 2D sur Apache

Ce guide publie le prototype `prototype_2D/` sur un serveur Apache 2.4 afin de le partager par une URL (démonstration, stand, revue). Il ne remplace pas l'ouverture directe des fichiers dans un navigateur, qui reste possible (voir le [README](README.md)).

**Statut des énoncés** : les *faits* sont vérifiés sur le contenu du dépôt ; les *consignes* Apache sont des pratiques courantes à valider sur votre distribution ; ce qui dépend d'une personne ou d'une décision est marqué **« à décider »** ou **« (à vérifier) »**.

## 1. Ce que l'on déploie

**Faits** (vérifiés sur les fichiers du dépôt) :

- Site **100 % statique** : HTML, CSS et JavaScript, environ 250 Ko au total. Aucune étape de build, aucun serveur applicatif, aucune base de données.
- **Aucune ressource externe** : ni police, ni CDN, ni image distante. Le prototype fonctionne sans accès à internet.
- **Aucun appel réseau** dans les scripts (ni `fetch`, ni `XMLHttpRequest`, ni `WebSocket`), aucun stockage navigateur, aucun cookie, aucun `eval`.
- **Aucun script ni gestionnaire d'événement en ligne** dans les pages ; tous les liens sont **relatifs**, donc le site fonctionne à la racine d'un domaine comme dans un sous-chemin (`/phare-prototype/`).
- Les scripts posent des attributs `style` sur des éléments SVG : la politique de sécurité de contenu (§5) doit donc autoriser les styles en ligne.

Fichiers à publier (13) :

| Fichier | Rôle |
|---|---|
| `index.html`, `usine.css`, `usine.js` | Chaîne de production (page d'accueil) |
| `simulateur.html`, `simulateur.css`, `simulateur.js` | Simulateur |
| `processus.html`, `style.css`, `app.js`, `data.js` | Vue processus |
| `shell.css`, `shell.js`, `phare_icon.svg` | Barre de navigation, lecteur et bouton de lancement communs aux trois vues ; logo PHARE (aussi icône d'onglet) |

À **ne pas** publier : `README.md`, ce guide, et les fichiers du dépôt (`.git`, `.github`, `.gitignore`, `.gitattributes`).

## 2. Avant de commencer

**Prérequis**

- Apache HTTP Server **2.4** (à vérifier selon la version fournie par votre distribution).
- Modules : `headers` et `deflate` (compression) ; `ssl` si HTTPS ; `expires` n'est pas nécessaire avec la consigne de cache du §5.
- Un accès en écriture au répertoire servi (par exemple `/var/www/`), avec droits `sudo` ou équivalent.

**Décisions à prendre (propriétaire : le porteur du projet, avec le RSSI pour l'accès)**

| Question | Pourquoi | Proposition |
|---|---|---|
| Qui peut ouvrir le site ? | Le prototype décrit la posture de sécurité de PHARE (gardes, niveaux de confidentialité, arrêt d'urgence). Il ne contient aucune donnée réelle, mais c'est un document de conception. | Réseau interne uniquement, ou authentification (§4). **À décider.** |
| Quelle URL ? | Nom de domaine ou sous-chemin. | `https://phare-proto.<domaine interne>/` **(à décider)** |
| Quelle page d'accueil ? | **Tranché** : `index.html` est la chaîne de production (visite guidée), la vue la plus accessible. | Rien à configurer : `index.html` est la page par défaut d'Apache (`DirectoryIndex`, §4). |

## 3. Installer les fichiers

Organisation proposée : une **copie datée par déploiement** et un lien symbolique `current`. Elle permet de revenir en arrière en une commande (§8).

```bash
# Depuis le dossier du prototype (racine du dépôt PHARE_Prototype ; `prototype_2D/` dans le dépôt PHARE)
BASE=/var/www/phare-prototype
REL="$BASE/releases/$(date +%Y%m%d-%H%M)"

sudo mkdir -p "$REL"
sudo rsync -a --exclude 'README.md' --exclude 'DEPLOIEMENT-APACHE.md' --exclude '.git' --exclude '.github' --exclude '.gitignore' --exclude '.gitattributes' ./ "$REL"/

# Droits : propriétaire root, lecture seule pour Apache
sudo chown -R root:root "$REL"
sudo find "$REL" -type d -exec chmod 755 {} +
sudo find "$REL" -type f -exec chmod 644 {} +

# Bascule vers cette version
sudo ln -sfn "$REL" "$BASE/current"
```

Apache n'a **pas besoin d'être rechargé** pour une mise à jour de fichiers statiques. Le rechargement n'est nécessaire que pour une modification de configuration (§4).

## 4. Configurer Apache (Debian / Ubuntu)

### 4.1 Activer les modules

```bash
sudo a2enmod headers deflate ssl
```

### 4.2 Virtual host

Fichier `/etc/apache2/sites-available/phare-prototype.conf`. Les noms de domaine, certificats et plages réseau sont des **exemples** à remplacer.

```apache
<VirtualHost *:80>
    ServerName phare-proto.exemple.interne
    Redirect permanent / https://phare-proto.exemple.interne/
</VirtualHost>

<VirtualHost *:443>
    ServerName phare-proto.exemple.interne
    DocumentRoot /var/www/phare-prototype/current

    SSLEngine on
    SSLCertificateFile    /etc/ssl/certs/phare-proto.crt
    SSLCertificateKeyFile /etc/ssl/private/phare-proto.key

    <Directory /var/www/phare-prototype/current>
        Options -Indexes
        AllowOverride None
        # Page d'accueil : la chaîne de production
        DirectoryIndex index.html

        # Accès : réseau interne (exemple, à adapter). Voir §4.3 pour l'authentification.
        Require ip 10.0.0.0/8 192.168.0.0/16
    </Directory>

    # Compression
    AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript image/svg+xml

    # Cache : les fichiers ne portent pas de numéro de version, on revalide à chaque visite
    <FilesMatch "\.(html|css|js)$">
        Header set Cache-Control "no-cache"
    </FilesMatch>

    # En-têtes de sécurité (détail au §5)
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "no-referrer"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"

    ErrorLog  ${APACHE_LOG_DIR}/phare-proto-error.log
    CustomLog ${APACHE_LOG_DIR}/phare-proto-access.log combined
</VirtualHost>
```

Activation et contrôle :

```bash
sudo a2ensite phare-prototype
sudo apache2ctl configtest      # doit répondre « Syntax OK »
sudo systemctl reload apache2
```

### 4.3 Restreindre l'accès (au choix, **à décider**)

| Option | Principe | Remarque |
|---|---|---|
| Réseau | `Require ip …` (déjà dans l'exemple) | La plus simple ; suffit si le serveur n'est joignable que depuis le réseau interne. |
| Mot de passe partagé | `AuthType Basic` + fichier `.htpasswd` (`htpasswd -c /etc/apache2/.htpasswd-phare <utilisateur>`) | Simple, mais mot de passe commun et à faire tourner. À réserver à une revue courte. |
| Authentification d'entreprise (SSO) | Module d'authentification OIDC ou SAML | Ajoute une **dépendance** (module Apache tiers) : à faire valider avant usage, conformément à la règle du dépôt sur les dépendances. |

Exemple Basic, à placer dans le bloc `<Directory>` à la place de `Require ip` :

```apache
AuthType Basic
AuthName "PHARE : prototype"
AuthUserFile /etc/apache2/.htpasswd-phare
Require valid-user
```

### 4.4 Variantes

- **Sous-chemin** (`https://serveur/phare-prototype/`) : remplacer `DocumentRoot` par `Alias /phare-prototype /var/www/phare-prototype/current` et reprendre le bloc `<Directory>` à l'identique. Les liens relatifs du prototype fonctionnent sans modification.
- **RHEL, Rocky, AlmaLinux** : le service s'appelle `httpd` ; la configuration va dans `/etc/httpd/conf.d/phare-prototype.conf` ; les modules `headers` et `deflate` sont généralement chargés par défaut (à vérifier) ; pas de `a2enmod` ; contrôle avec `httpd -t` ; ajouter le contexte SELinux si nécessaire (`chcon -R -t httpd_sys_content_t /var/www/phare-prototype`).
- **Windows** (Apache Lounge, XAMPP) : copier les 13 fichiers dans un dossier servi, activer `mod_headers` et `mod_deflate` dans `httpd.conf`, adapter les chemins. Convient pour une démonstration locale, pas pour un partage durable.

## 5. Pourquoi ces en-têtes

| En-tête | Effet | Remarque |
|---|---|---|
| `Content-Security-Policy` | Bloque tout script, toute ressource ou tout appel réseau hors du site lui-même | `style-src 'unsafe-inline'` est **nécessaire** : les scripts posent des attributs `style` sur des éléments SVG (fait, §1). Aucun script en ligne n'est autorisé. |
| `X-Content-Type-Options: nosniff` | Interdit au navigateur de deviner un type de fichier | |
| `X-Frame-Options` et `frame-ancestors` | Empêche l'intégration du site dans une page tierce | Passer à une liste d'origines si vous intégrez le prototype dans un portail interne. |
| `Referrer-Policy: no-referrer` | Aucune adresse transmise lors d'un clic sortant | |
| `Cache-Control: no-cache` | Le navigateur revalide à chaque visite et reçoit les mises à jour sans vider son cache | Les fichiers n'ont pas de numéro de version ; sans cette consigne, un utilisateur peut garder d'anciens scripts. |

Ajouter `Strict-Transport-Security` (HSTS) **uniquement** quand le HTTPS est définitif : `Header always set Strict-Transport-Security "max-age=31536000"` (à valider avec l'équipe réseau).

## 6. Vérifier le déploiement

**Contrôle des fichiers** (remplacer `HOTE`) :

```bash
for f in index.html simulateur.html processus.html phare_icon.svg shell.css style.css simulateur.css usine.css shell.js app.js data.js simulateur.js usine.js; do
  printf '%-16s ' "$f"; curl -s -o /dev/null -w '%{http_code}\n' "https://HOTE/$f"
done
curl -sI https://HOTE/shell.js | grep -i 'content-type\|cache-control\|content-security\|content-encoding'
```

Attendu : `200` pour chaque fichier, un type `text/javascript` ou `application/javascript` pour les `.js`, l'en-tête `Cache-Control: no-cache`, l'en-tête `Content-Security-Policy`.

**Contrôle dans un navigateur**, console ouverte (touche F12) :

1. `https://HOTE/` : la chaîne de production attend en pause ; après lecture, elle enchaîne seule les scénarios.
2. Sélectionner **Scénario : Ticket piégé** : un écran-titre apparaît, puis la visite repart.
3. `https://HOTE/simulateur.html#s=injection` : le scénario s'ouvre ; la démo automatique tourne ou s'arrête selon la case cochée.
4. `https://HOTE/processus.html#creation/5` : la vue processus s'ouvre à l'étape 5.
5. Les trois liens de la barre du haut mènent aux trois vues, et la barre est identique sur chacune (marque PHARE à gauche).
6. Dans chaque vue, le lecteur démarre en pause et propose précédent, lecture, suivant, curseur, vitesses ×1, ×2, ×4, choix du scénario et plein écran, aux mêmes endroits.
7. **Aucune erreur** dans la console, en particulier aucune ligne `Content Security Policy`.
8. Le bouton **Plein écran** (chaîne de production) fonctionne.

## 7. Mettre à jour

Répéter le §3 depuis le dépôt à jour. Aucun rechargement d'Apache. Les utilisateurs reçoivent la nouvelle version à leur prochaine visite grâce à `no-cache`.

## 8. Revenir en arrière

```bash
ls /var/www/phare-prototype/releases                       # repérer la version précédente
sudo ln -sfn /var/www/phare-prototype/releases/<version> /var/www/phare-prototype/current
```

Supprimer les anciennes copies quand elles ne servent plus (garder les trois dernières, par exemple).

## 9. Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| `403 Forbidden` | Droits du répertoire ou `Require` trop restrictif | Vérifier `chmod 755` sur les dossiers et `644` sur les fichiers ; vérifier que votre adresse figure dans `Require ip`. Sous SELinux, vérifier le contexte du §4.4. |
| `404` sur un fichier | Fichier absent ou casse différente (Linux distingue majuscules et minuscules) | Comparer avec la liste du §1. |
| Page blanche ou scène vide | Violation de la politique de sécurité | Lire la console : si `style-src` bloque, vérifier la présence de `'unsafe-inline'` dans le §4.2 ; si une ressource externe est signalée, c'est une régression du prototype (il n'en utilise aucune). |
| Ancienne version affichée | Cache navigateur ou intermédiaire | Vérifier `Cache-Control: no-cache` (§6) ; forcer l'actualisation (Ctrl+F5). |
| Script servi en `text/plain` | Types MIME non chargés | Vérifier que `mod_mime` est actif et que `mime.types` est présent. |
| Le site ne s'ouvre pas dans un cadre d'un portail | `X-Frame-Options` et `frame-ancestors` | Adapter les deux en-têtes (§5). |
| Lent au premier chargement | Compression absente | Vérifier `mod_deflate` (`Content-Encoding: gzip` ou `br` dans la réponse). |

## 10. Limites de ce guide

- **Non testé sur un serveur réel** : les configurations sont des pratiques courantes, validées sur la lecture du contenu du prototype, mais non exécutées sur votre infrastructure. Le critère de réussite est le contrôle du §6, à faire par la personne qui déploie, lors du premier déploiement.
- Les chemins, noms de domaine et plages réseau sont des exemples.
- Le certificat TLS, le DNS, le pare-feu et la sauvegarde relèvent de votre équipe d'exploitation.
- Le prototype est une **simulation illustrative** : il ne remplace pas la conception documentée dans `docs/conception/` et n'exécute aucune plateforme.
