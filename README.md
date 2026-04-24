# Suivi des composants vélo

Petite application web pour suivre les kilomètres cumulés par vélo (depuis [Intervals.icu](https://intervals.icu)) et te rappeler quand entretenir les composants : cire de chaîne, contrôle des freins, etc.

## Installation

```bash
cd bike-tracker
npm install
```

## Lancer en local

```bash
npm run dev
```

Ouvre `http://localhost:5173`. Saisis ta clé API Intervals.icu (`Settings → Developer settings`). Elle est stockée uniquement dans ton navigateur (`localStorage`).

## Build de production

```bash
npm run build
```

La sortie est générée dans `dist/`. Tu peux la servir avec n'importe quel hébergement statique, par exemple `npx serve dist`.

## Configuration Strava

La connexion Strava passe par le Worker Cloudflare. Avant de déployer le Worker,
définis les secrets avec l'identifiant et le secret de ton application Strava :

```bash
cd worker
npx wrangler secret put STRAVA_CLIENT_ID
npx wrangler secret put STRAVA_CLIENT_SECRET
```

Dans Strava, l'URL de callback autorisée doit correspondre à `STRAVA_REDIRECT_URI`
dans `worker/wrangler.toml`, par exemple :

```text
https://bike-tracker-worker.componenttracker.workers.dev/strava/callback
```

## Utilisation

- **Charger les vélos** : saisis ta clé API puis charge tes vélos. Tes vélos et leur distance totale depuis Intervals.icu s'affichent.
- **Ajouter un composant** : pour chaque vélo, ajoute des éléments comme « Cire de chaîne » (par exemple tous les 3000 km) ou « Contrôle des freins » (tous les 5000 km). Tu peux aussi définir le kilométrage de départ pour afficher « plus que X km » ou « en retard ».
- **Marquer comme fait** : quand tu entretiens un composant, clique sur « Fait » pour remettre son suivi au kilométrage actuel du vélo.

Toutes les données de composants sont stockées uniquement dans ton navigateur.
