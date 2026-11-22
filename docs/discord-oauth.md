# Connexion Discord et ajout automatique au serveur

Le site demande les scopes `identify guilds.join`. Après acceptation sur Discord,
le callback récupère le profil et ajoute l’utilisateur au serveur configuré, puis
termine la connexion au site ou au launcher. Les joueurs gardent le rôle `PLAYER`
et ne reçoivent aucun accès créateur ou SFTP depuis le launcher.

## Discord Developer Portal

1. Ouvrir [les applications Discord](https://discord.com/developers/applications)
   et sélectionner l’application correspondant au `DISCORD_CLIENT_ID` du site.
   Le bot doit appartenir à cette même application.
2. Dans **OAuth2 > Redirects**, conserver ou ajouter exactement
   `https://launched.infuseting.fr/api/auth/discord/callback`.
   Cette URL doit correspondre à `DISCORD_REDIRECT_URI`. Pour le développement,
   ajouter aussi `http://localhost:3000/api/auth/discord/callback` si cette adresse
   est utilisée localement. Le launcher n’a pas besoin d’une redirection distincte.
3. Dans **Bot**, récupérer le token du bot. Si un nouveau token doit être généré,
   utiliser **Reset Token**, puis mettre à jour les autres services utilisant
   l’ancien token. Copier le token uniquement dans la configuration serveur
   `DISCORD_BOT_TOKEN` ; ce n’est pas le Client Secret OAuth.
4. Si le bot n’est pas encore présent sur le serveur, dans **OAuth2 > OAuth2 URL
   Generator**, sélectionner le scope `bot` et la permission **Create Instant
   Invite / Créer une invitation**, puis ouvrir l’URL et choisir le serveur
   Launched. Si le bot est déjà installé, vérifier cette permission sur son rôle.

Les scopes de connexion `identify guilds.join` sont déjà envoyés par le site.
Le générateur d’URL ne les active pas globalement sur l’application : il sert ici
à installer le bot une seule fois. Aucun intent privilégié n’est nécessaire pour
cet appel HTTP, et aucun processus de bot connecté en permanence n’est requis.

## Configuration du serveur web

Conserver les identifiants OAuth existants et ajouter le token :

```dotenv
DISCORD_CLIENT_ID=identifiant_de_la_meme_application
DISCORD_CLIENT_SECRET=secret_oauth_existant
DISCORD_BOT_TOKEN=token_du_bot
DISCORD_GUILD_ID=1496947207847411965
DISCORD_REDIRECT_URI=https://launched.infuseting.fr/api/auth/discord/callback
```

Vérifier que `DISCORD_GUILD_ID` est bien l’identifiant du serveur cible. Le copier
depuis Discord avec le mode développeur si nécessaire. Aucun de ces secrets ne
doit utiliser un préfixe `NEXT_PUBLIC_`.

En local, utiliser `.env.local`. Avec le Docker Compose du dépôt, renseigner
`.env` sur l’hôte, puis reconstruire et recréer le service web pour charger le
code et les nouvelles variables :

```sh
docker compose up -d --build web
```

Sans token de bot, la route de connexion et la vérification préalable du launcher
renvoient une indisponibilité. Si Discord refuse l’ajout ou ne répond pas dans les
dix secondes, aucun compte, cookie de session ou code launcher n’est émis par
cette tentative. Le site affiche une erreur avec une action de nouvelle connexion.

## Vérifier après déploiement

- Se connecter avec un compte qui n’appartient pas encore au serveur : accepter
  l’autorisation d’ajout à des serveurs, puis vérifier son arrivée et la connexion.
- Refaire la connexion avec un membre existant : elle doit aussi réussir.
- Vérifier le parcours du launcher et la conservation des accès du joueur.
- Si le règlement du serveur nécessite une validation, le membre rejoint avec
  l’état `pending` et doit accepter ce règlement dans Discord avant de discuter.

Les connexions déjà ouvertes ne déclenchent pas d’ajout rétroactif : une nouvelle
connexion OAuth est nécessaire. Les tokens OAuth ne sont pas conservés pour
réintégrer ultérieurement les utilisateurs qui quittent le serveur.

Références : [scopes OAuth2](https://docs.discord.com/developers/topics/oauth2),
[ajout d’un membre](https://docs.discord.com/developers/resources/guild#add-guild-member).
