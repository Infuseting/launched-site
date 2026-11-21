# Contribuer à Launched

## Avant de proposer un changement

1. Installer les dépendances avec `npm ci` et générer le client avec `npm run db:generate`.
2. Lire les composants et contrats existants avant d'ajouter une abstraction.
3. Exécuter `npm run check`, puis `npm run build`.
4. Vérifier visuellement la page modifiée sur petit et grand écran, au clavier et avec
   la préférence de réduction des animations.

La CI contrôle le formatage, ESLint, TypeScript, les tests et le build. Les règles
s'appliquent au code de production et aux tests ; les sorties générées sont ignorées.
Le fichier de verrouillage doit être conservé avec toute modification de dépendance.

## Lisibilité et responsabilités

- Garder les composants visuels séparés des appels réseau et de la validation métier.
- Privilégier des types explicites aux frontières et `unknown` pour une entrée non
  vérifiée. Éviter `any`, les assertions destinées à masquer une erreur et les
  désactivations globales de lint.
- Commenter les invariants, la compatibilité historique et les raisons d'un choix.
  Un commentaire qui répète l'instruction suivante ajoute du bruit.
- Préserver l'immutabilité des objets React, y compris les objets imbriqués des listes.
- Capturer les erreurs des actions asynchrones, annoncer leur résultat honnêtement et
  annuler les chargements lors du démontage. Une copie refusée ne doit pas être annoncée
  comme réussie.

## Contrats et données

- Vérifier l'authentification et les droits dans chaque route de mutation. Utiliser les
  helpers de `src/lib/api/middleware.ts` et valider le corps avant les écritures.
- Un champ absent d'une mise à jour partielle doit préserver sa valeur. `false`, `''`
  et `[]` sont des valeurs explicites, distinctes de `undefined`.
- Retourner une `ValidationError` pour une erreur de saisie attendue. Les erreurs
  internes sont journalisées côté serveur et retournent un message générique.
- Regrouper les écritures liées dans une transaction ou une écriture imbriquée Prisma.
  Les effets SFTPGo et les fichiers ont leur propre cycle de vie, à traiter explicitement.
- Ajouter des régressions pour les changements de comportement, surtout pour
  l'authentification, les droits, les chemins de fichiers et la conservation des données.
  Éviter les tests qui ne font que recopier l'implémentation.

## Design et accessibilité

- Préserver la direction visuelle existante et réutiliser les primitives installées.
  Les tokens communs vivent dans `src/app/globals.css`.
- Associer chaque champ à un libellé et nommer les boutons à icône. Les erreurs de
  formulaire doivent rester visibles et être annoncées par les lecteurs d'écran.
- Utiliser `DashboardModal` pour les formulaires du tableau de bord : il fournit la
  gestion du focus, Échap et le verrouillage du défilement avec Base UI, compatible
  avec les sélecteurs Discord imbriqués.
- Garder un focus visible, des contenus utilisables à faible largeur et des animations
  respectant `prefers-reduced-motion`, y compris les animations JavaScript.
- Avant de toucher à une primitive shadcn, consulter les docs de son API exacte : les
  composants installés utilisent actuellement plusieurs bibliothèques de base.

## Vérifications qui nécessitent les services

Les tests isolés et le build ne remplacent pas une vérification avec PostgreSQL,
Discord, SFTPGo et le launcher réels. Avant livraison, vérifier les connexions,
la création/modification des sessions, les collaborateurs et les transferts,
les téléchargements et la synchronisation dans un environnement de test adapté.
