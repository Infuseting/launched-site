# Launched — site et espace créateur

Site Next.js / React du launcher Minecraft Launched : présentation, téléchargements,
connexion Discord, gestion des sessions et des accès SFTP. L'application Tauri se trouve
dans le dépôt voisin `launched`.

## Démarrer en local

Prérequis : Node.js 22 LTS recommandé (20.9 minimum), npm, PostgreSQL et SFTPGo pour
les fonctions de gestion. La vitrine et les tests isolés ne nécessitent pas de base active.

```sh
npm ci
# Copier .env.example vers .env et adapter les valeurs à votre environnement.
npm run db:generate
npm run db:push
npm run dev
```

Ouvrir `http://localhost:3000`. Configurer le callback Discord local sur
`http://localhost:3000/api/auth/discord/callback` et utiliser la même valeur pour
`DISCORD_REDIRECT_URI`. `db:push` modifie le schéma de la base ciblée : vérifier
`DATABASE_URL` et sauvegarder une base existante avant de l'utiliser.

Le fichier `.env.example` décrit les variables attendues. Ne pas réutiliser ses valeurs
de démonstration en production. Le secret JWT chiffre aussi les identifiants SFTP
historiques : une rotation doit prendre en compte les données déjà stockées.

## Contrôles qualité

```sh
npm run check       # Formatage, ESLint sans avertissement, types et tests
npm run build       # Compilation et génération Next.js de production
npm run format      # Appliquer le formatage partagé
npm audit           # Audit du graphe de dépendances npm installé
```

`npm run db:generate` est nécessaire après une installation ou un changement Prisma.
`typecheck` exécute `next typegen` avant TypeScript pour fonctionner sur un clone neuf.
Les tests Node couvrent notamment l'authentification du launcher, les fichiers de
synchronisation, les migrations, les accès Discord, les loaders et les mises à jour
partielles. Ils utilisent des adaptateurs isolés et des répertoires temporaires, sans
modifier les sessions ni la base réelles. La CI exécute les mêmes contrôles et le build.

## Organisation du code

| Dossier                    | Responsabilité                                          |
| -------------------------- | ------------------------------------------------------- |
| `src/app`                  | Pages et routes HTTP Next.js App Router                 |
| `src/components/dashboard` | Cartes et formulaires de l'espace créateur              |
| `src/components/ui`        | Primitives réutilisables shadcn/Base UI/Radix           |
| `src/hooks`                | État et interactions côté navigateur                    |
| `src/lib`                  | Authentification, Prisma, SFTPGo et protocoles partagés |
| `src/lib/validations`      | Validation des entrées et distinction absent/vide       |
| `src/types`                | Contrats de données du tableau de bord                  |
| `prisma`                   | Schéma PostgreSQL et données de développement           |
| `tests`                    | Tests des routes et des comportements métier            |
| `scripts`                  | Maintenance et migration des sessions                   |

Consulter [CONTRIBUTING.md](CONTRIBUTING.md) avant de modifier le code et
[docs/launcher-discord.md](docs/launcher-discord.md) pour le protocole launcher.
Les règles propres à la version Next.js installée sont dans `AGENTS.md` et
`node_modules/next/dist/docs`.

## Exploitation

`npm run build` puis `npm start` lancent une version de production. Le Dockerfile
et `docker-compose.yml` fournissent l'intégration PostgreSQL/SFTPGo ; le réseau
externe `npm-network` doit déjà exister. Le conteneur applique actuellement
`prisma db push` au démarrage : vérifier cette politique avant un déploiement.

La migration de stockage est séparée : consulter le script `scripts/migrate-sessions.mjs`
et sa documentation avant toute exécution sur les données du serveur. Ne pas lancer
de seed, de migration ou de déploiement pour un simple contrôle de code.

## Dépendances à suivre

L'audit du 21 novembre 2026 est passé de 22 alertes à 4 alertes élevées après les
correctifs compatibles, dont Next.js et sa configuration ESLint en `16.4.6`.
Les quatre entrées restantes sont `prisma`, `@prisma/config`, `deepmerge-ts` et
`effect`. Prisma `6.19.3` verrouille les deux dernières bibliothèques en `7.1.5`
et `3.21.0` : elles concernent l'épuisement de pile lors de fusions récursives et
une expression régulière coûteuse dans les schémas. `npm audit --omit=dev` les
signale également, Prisma étant présent dans le graphe du client.

Une mise à niveau Prisma ou un correctif amont est nécessaire pour lever ces
alertes. Ne pas appliquer d'override majeur transitoire sans valider la génération
du client, les migrations et les opérations PostgreSQL/SFTPGo. Relancer `npm audit`
au moment de la livraison : ce résultat décrit les dépendances installées, pas
une garantie générale d'absence de vulnérabilités.
