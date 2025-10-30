# Cotisation App

Simple local contribution tracking app (vanilla HTML/JS). This repository is intended to be run locally.

Quick start

1. Install Node.js (v16+ recommended).
2. From the project folder run:

```powershell
node server.js
```

3. Open http://localhost:3000 in your browser.

Notes
- `data.json` is ignored by `.gitignore` for privacy (contains admin hashes and member data). Use `data.example.json` as a template.

How to publish to GitHub

1. Create a new repository on GitHub (web or with `gh repo create`).
2. Add the remote and push:

```powershell
git remote add origin https://github.com/<your-username>/<repo>.git
git branch -M main
git push -u origin main
```


## AI Assistant

This project includes a small embedded assistant widget (`ai-widget.js`). It supports two modes:
- Local (offline): a lightweight rule-based helper that answers common questions about the app and deployment. Works without any external services.
- OpenAI (cloud): if you paste your OpenAI API key in the widget at runtime, the assistant can use the OpenAI ChatCompletions API to provide richer responses. Do NOT commit your API key to the repository; the widget stores it in your browser `localStorage` only.

Notes about security and hosting
- If you host the site on GitHub Pages (static hosting), the AI widget's local mode works fine. The OpenAI mode also works from the browser but requires the user's key and exposes it to the client — for production, prefer a server-side proxy that keeps the key secret.
- The app's Node server (`server.js`) cannot run on GitHub Pages. If you need server-side persistence (writing `data.json`), deploy the server to a hosting provider (Render, Fly, Heroku, or a VPS) and set environment variables (admin password) there.

If you want, I can:
- Add a small serverless proxy example (GitHub Actions or a minimal server) and instructions to store the OpenAI key in GitHub Secrets.
- Provide a GitHub Pages-friendly build that disables server API calls and keeps persistence in `localStorage` so the app works as a static site.
If you need me to create the remote using the GitHub CLI, tell me and ensure `gh` is authenticated on this machine.

## Static-only mode (GitHub Pages)

The client automatically detects if it's running on GitHub Pages (hostname ends with `github.io`) and switches to a "static-only" mode:

- When static-only is active, the app will not probe or call `/api/*` endpoints and will instead use `localStorage` for all persistence.
- This allows you to host the frontend on GitHub Pages without a server. Note that data will be stored per-browser and not shared between users.
- You can override the detection for testing by adding `?staticOnly=1` to the URL or setting `localStorage.setItem('staticOnly','1')` in the console.

## OpenAI proxy (recommended for production)

For production use of the AI assistant, do NOT expose your OpenAI API key in the browser. Instead deploy a small proxy that stores the key server-side and forwards requests.

Included: `openai-proxy.js` — a tiny Express app that exposes `POST /openai-proxy` and forwards to OpenAI using the `OPENAI_API_KEY` environment variable.

Run locally for testing:

```powershell
# set environment variable (Windows PowerShell)
$env:OPENAI_API_KEY = 'sk-...'
node openai-proxy.js
```

Deploying (high level):

- Deploy the proxy to any Node-capable host (Render, Fly, Heroku, DigitalOcean App Platform, a VPS, etc.).
- Set the environment variable `OPENAI_API_KEY` in the host's secret / environment settings (Render: Environment > Add Secret). Do NOT commit the key to GitHub.
- Configure CORS or the host to allow your frontend domain to call the proxy.

Using the proxy from the frontend:

1. Deploy the proxy and note its public URL, e.g. `https://my-proxy.example.com/openai-proxy`.
2. In your frontend pages that include `ai-widget.js`, define the global variable `window.OPENAI_PROXY_URL` (before loading `ai-widget.js`) to point to the proxy URL. Example in `index.html` (insert in `<head>`):

```html
<script>window.OPENAI_PROXY_URL = 'https://my-proxy.example.com/openai-proxy';</script>
<script src="ai-widget.js"></script>
```

The widget will prefer the proxy URL if present and will not require the user to paste their OpenAI key into the browser.

## Security note

- Never commit secrets (API keys) to the repository. Use GitHub Secrets / platform environment variables.
- If you want, I can add a GitHub Actions example that deploys the proxy to a chosen platform and reads the secret from `secrets.OPENAI_API_KEY` — tell me which hosting provider you plan to use and I will prepare the workflow.
# App de Cotisation

Petite application de gestion de cotisations (statique).

## Lancer l'application

Option 1 — Ouvrir directement :
- Double-cliquez sur `index.html` dans l'explorateur de fichiers pour l'ouvrir dans votre navigateur.

Option 2 — Servir via un petit serveur HTTP (préférable pour éviter des problèmes CORS si vous ajoutez des modules) :

PowerShell / Terminal (si Python est installé) :

```powershell
python -m http.server 8000
```

puis ouvrez http://localhost:8000 dans votre navigateur.

Option 3 — Lancer le serveur Node.js (API + frontend servis ensemble)

Prerequis : Node.js installé.

Dans PowerShell, placez-vous dans le dossier du projet puis lancez :

```powershell
npm install
npm start
```

Le serveur écoute par défaut sur http://localhost:3000 — ouvrez cette URL pour utiliser l'application avec l'API.

## Notes
- Les données (membres, montants et mot de passe administrateur) sont stockées localement dans le navigateur via `localStorage`. Ce n'est pas sécurisé pour des données sensibles.
- Mot de passe par défaut : `bestking` (modifiable dans le stockage local via les outils développeur si besoin).

## Fonctionnalités ajoutées
- Ajout / suppression de membres
- Ajout de montants (validation d'entrée positive)
- Total affiché
- Persistance locale
- Mode sombre basique

## API et persistance

Si vous lancez le serveur Node.js, les données sont persistées dans `data.json`.


## Prochaines améliorations possibles
- Remplacer l'authentification côté client par un backend sécurisé
- Validation plus avancée et édition des montants
- Export/Import CSV

