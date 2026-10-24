# Feuille de route — vue processus 3D

## Cap produit

Proposer une lecture spatiale du processus PHARE sans dupliquer la logique du
schéma 2D : mêmes scénarios, mêmes étapes et mêmes dépendances. La vue 2D
reste disponible à tout instant comme vue de référence et solution de repli.

## Jalons

1. **Socle navigable (livré)** — bouton 2D/3D, scène WebGL locale, caméra
   orbitale, blocs volumétriques, tubes de liaison, éclairage et survol des
   composants.
2. **Lecture vivante (livré)** — synchronisation des étapes et scénarios existants,
   mise en évidence des blocs actifs, flux lumineux se déplaçant dans les
   tubes.
3. **Inspection (livré)** — clic pour cadrer un composant, cartouche détaillé,
   isolement d'un sous-ensemble (garde, bac à sable, dépendances externes).
4. **Décomposition (livré)** — vue éclatée d'un composant choisi, niveaux de détail
   et liens entrants/sortants conservés.
5. **Finition (livré, validation multi-navigateurs à poursuivre)** — accessibilité
   clavier, réduction des mouvements, rendu limité à 1,5× de densité et repli
   explicite si WebGL est indisponible.

## Critères du premier jalon

- Aucun appel CDN : le moteur 3D est fourni dans le dépôt.
- Les données métier restent dans `data.js` ; la 3D en dérive sa géométrie.
- L'utilisateur peut orbiter, zoomer, survoler et retrouver la vue 2D.
- Les scénarios de la vue processus alimentent la même surbrillance en 3D.
