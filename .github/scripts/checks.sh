#!/usr/bin/env bash
# Vérifications de base du prototype statique. À lancer depuis la racine du dépôt.
# Sortie : un message « ::error » par défaut constaté (annotation GitHub), code de sortie 1 si au moins un.
set -u

fail=0
err() { echo "::error::$1"; fail=1; }

echo "== 1. Syntaxe JavaScript"
for f in *.js; do
  node --check "$f" || err "Erreur de syntaxe dans $f"
done

echo "== 2. Aucune ressource externe (le prototype fonctionne sans réseau)"
# L'espace de noms SVG est une constante, pas une ressource.
ext=$(grep -nE "https?://" ./*.html ./*.css ./*.js | grep -v "http://www.w3.org/2000/svg" || true)
if [ -n "$ext" ]; then echo "$ext"; err "URL absolue détectée dans le code : ressource externe interdite"; fi

echo "== 3. Aucun script ni gestionnaire d'événement en ligne (CSP stricte)"
inline=$(grep -noEi "<script([[:space:]][^>]*)?>" ./*.html | grep -vi "src=" || true)
if [ -n "$inline" ]; then echo "$inline"; err "Script en ligne détecté"; fi
handlers=$(grep -nEi "[[:space:]]on[a-z]+[[:space:]]*=" ./*.html || true)
if [ -n "$handlers" ]; then echo "$handlers"; err "Gestionnaire d'événement en ligne détecté"; fi

echo "== 4. Pas d'API d'évaluation dynamique"
dyn=$(grep -nE "\beval[[:space:]]*\(|new[[:space:]]+Function[[:space:]]*\(|document\.write[[:space:]]*\(" ./*.js || true)
if [ -n "$dyn" ]; then echo "$dyn"; err "eval, new Function ou document.write détecté"; fi

echo "== 5. Pas d'appel réseau ni de stockage navigateur (le prototype n'en utilise aucun)"
net=$(grep -nE "\bfetch[[:space:]]*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie" ./*.js || true)
if [ -n "$net" ]; then echo "$net"; err "Appel réseau ou stockage navigateur détecté : à justifier et à reporter dans le guide de déploiement (CSP)"; fi

echo "== 6. Structure des pages HTML"
for p in ./*.html; do
  head -n 1 "$p" | grep -qi "<!doctype html>" || err "$p : déclaration <!doctype html> absente en première ligne"
  grep -q "<html lang=" "$p" || err "$p : attribut lang absent sur <html>"
  grep -q "<title>" "$p" || err "$p : balise <title> absente"
done

echo "== 7. Fichiers référencés par les pages HTML"
for p in ./*.html; do
  while IFS= read -r ref; do
    ref="${ref%%#*}"
    [ -z "$ref" ] && continue
    [ -f "$ref" ] || err "$p : fichier référencé introuvable : $ref"
  done < <(grep -oE '(href|src)="[^":]+"' "$p" | sed -E 's/^(href|src)="//; s/"$//')
done

echo "== 8. Liens relatifs des fichiers Markdown"
for md in ./*.md; do
  while IFS= read -r ref; do
    ref="${ref%%#*}"
    [ -z "$ref" ] && continue
    [ -e "$ref" ] || err "$md : lien relatif introuvable : $ref"
  done < <(grep -oE '\]\([^)#:]+' "$md" | sed 's/^](//')
done

echo "== 9. Aucun secret apparent dans le dépôt"
sec=$(grep -rnE "BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}" --exclude-dir=.git --exclude-dir=.github . || true)
if [ -n "$sec" ]; then echo "$sec"; err "Secret apparent détecté"; fi

if [ "$fail" -ne 0 ]; then echo "Vérifications en échec"; exit 1; fi
echo "Toutes les vérifications sont passées"
