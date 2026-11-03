# Connexion Discord du launcher

Le bouton « Continuer sans se connecter » ouvre les sessions publiques sans
créer de compte. Le choix vaut pour l’exécution en cours du launcher. La connexion
Discord reste disponible dans les paramètres, rubrique Comptes. En accès public,
Rust n’envoie aucun jeton Discord, même si un compte est enregistré localement.

Le launcher ouvre `/api/auth/discord/login` sur le site, avec une adresse de retour
`http://127.0.0.1:<port>/callback`, un état aléatoire et un challenge PKCE S256.
Discord continue de revenir sur l’unique `DISCORD_REDIRECT_URI` existante du site.
Il ne faut ajouter ni secret Discord ni redirection Discord locale au launcher.

Le callback du site crée/met à jour l’utilisateur Discord et renvoie au launcher
un code valable une minute. Le launcher échange ce code à usage unique et son
vérificateur PKCE sur `POST /api/auth/launcher/token`. Le jeton opaque retourné
est enregistré localement par le backend Rust, suivant le stockage local des
comptes déjà utilisé par le projet. Il n’est exposé ni à React ni dans les URL.
Seule son empreinte SHA-256 est conservée en base de données.

Le jeton expire après 90 jours sans utilisation ; les requêtes authentifiées
prolongent cette durée automatiquement. `GET /api/auth/launcher/me` restaure le
compte au démarrage. `POST /api/auth/launcher/logout` révoque le jeton en base
avant sa suppression locale. Si le site est indisponible, le compte reste
enregistré et la déconnexion peut être réessayée. Les comptes Minecraft restent
indépendants de ce compte Discord.

Avant d’ouvrir le navigateur, le launcher vérifie `/api/auth/launcher/ready`
(configuration Discord et disponibilité de la base). Un échec s’affiche
immédiatement dans le launcher. Le callback transmet également les refus,
erreurs serveur et demandes expirées au launcher via le retour local validé.
Le launcher revient au premier plan après le retour, une annulation ou un délai
dépassé, et affiche le message d’erreur correspondant.

La page locale de retour demande sa fermeture avec `window.close()` en cas de
succès comme d’erreur et efface le code et l’état de son URL. Certains navigateurs
refusent de fermer un onglet ouvert par une application externe ; dans ce cas,
elle affiche uniquement un message de retour vers Launched. La transmission du
résultat au launcher ne dépend pas de cette fermeture.

## Joueurs et créateurs

Une première connexion depuis le launcher crée un compte `PLAYER`, sans compte
SFTP et sans accès à l’espace créateur. Elle ne nécessite pas d’appartenir au
serveur Discord officiel. La connexion depuis le site conserve le contrôle
d’appartenance au serveur Discord ; elle permet ensuite au joueur de devenir
créateur, avec un quota initial de zéro. Les rôles créateurs existants sont conservés.

Dans le formulaire de session de l’espace créateur, « Accès des joueurs » permet
de choisir entre « Accessible à tout le monde » et « Uniquement les comptes Discord
autorisés ». La liste est recherchable à partir de trois caractères et permet la
sélection multiple de comptes Launched. Un identifiant Discord peut aussi être
ajouté avant la première connexion du joueur. L’ancien réglage de visibilité
indépendant n’est plus utilisé.

La liste accepte les noms d’utilisateur uniques Discord (pas les surnoms ni les
noms d’affichage) et les identifiants Discord. Un utilisateur peut être invité
avant sa première connexion. Lorsqu’il se connecte, son nom vérifié par Discord
est rattaché à son identifiant stable. Les changements de pseudo ultérieurs ne
transfèrent pas cette autorisation au futur détenteur de l’ancien pseudo.
Utiliser directement un identifiant Discord évite l’incertitude d’un changement
de pseudo avant la première connexion. Retirer puis ajouter une entrée réattribue
l’autorisation. Propriétaire et collaborateurs ont aussi accès au jeu ; autoriser
un joueur ne lui donne aucun droit d’édition ou de SFTP.

La liste `/sessions` (et `/api/sessions`), les métadonnées, les visuels, les
manifestes et les fichiers de synchronisation acceptent les requêtes anonymes
uniquement pour les sessions publiques. Un bearer valide donne aussi accès aux
sessions privées autorisées pour le compte. Un bearer fourni mais invalide ou
expiré renvoie 401, sans repli anonyme. Tous utilisent le même filtre d’autorisation
et `Cache-Control: private, no-store`. Les liens symboliques ne sont pas parcourus
par le manifeste et les téléchargements vérifient leur confinement physique.
Rust vérifie à nouveau les droits avant la synchronisation et le lancement,
 même si le jeu est déjà installé.
Les jetons ne sont envoyés qu’à l’origine du site configuré. Les visuels privés
sont chargés via Rust, puis transmis à React sous forme d’images intégrées.

## Déploiement

1. Déployer le site qui autorise les sessions publiques sans bearer, puis publier
   le launcher 1.6.1 ou ultérieur avec le bouton de connexion facultative.
2. Déployer le site avec le nouveau schéma Prisma. Le Dockerfile existant exécute
   `prisma db push` au démarrage, ce qui ajoute les tables `LauncherToken`,
   `LauncherCode`, `SessionAccess`, le rôle `PLAYER` et `Session.publicAccess`.
   Les sessions existantes gardent par défaut l’accès public. Le passage de 1.6.0
   à 1.6.1 n’ajoute pas de nouvelle migration de données.
   Pour une installation hors Docker : `npx prisma generate`, puis appliquer
   `npx prisma db push` avec la connexion de la base ciblée avant le démarrage.
3. Conserver les variables Discord/JWT existantes et une `NEXT_PUBLIC_APP_URL`
   HTTPS correspondant au domaine public. Aucun nouveau secret n’est nécessaire.
   Purger les éventuels caches CDN/proxy des anciennes réponses publiques de
   `/sessions` et `/api/sessions/*` avant d’activer des sessions privées.
4. Vérifier une vraie connexion Discord, fermer/rouvrir le launcher, puis tester
   la déconnexion et une session privée avec deux comptes Discord différents.
   Vérifier aussi le bouton sans connexion, la liste publique, les fichiers publics
   et le refus des liens directs vers les sessions privées.

En développement, définir `LAUNCHED_SITE_URL=http://127.0.0.1:3000` dans
l’environnement du processus Tauri. `LAUNCHED_SERVERS_URL` permet de remplacer
l’URL du catalogue, sur la même origine. Le HTTP est limité au développement local.
Côté site, `NEXT_PUBLIC_APP_URL` et `DISCORD_REDIRECT_URI` doivent aussi cibler
cette instance locale ; sa redirection OAuth doit être enregistrée chez Discord.

## Vérification automatisée

Avec Node 24 :

```sh
node --test src/lib/session-loaders.test.mjs src/lib/launcher-protocol.test.mjs tests/launcher-auth.test.mjs tests/discord-user-search.test.mjs
npm run build
```

Les tests des handlers utilisent une base en mémoire isolée : aucun compte réel,
aucune connexion Discord et aucune base configurée dans `.env.local` ne sont utilisés.
Ils couvrent PKCE, expiration, rejeu concurrent, révocation, invitations en attente,
contrôle de l’état OAuth, l’accès anonyme limité au public, les liens symboliques
et les quatre endpoints de fichiers/métadonnées.
