# Lancer Tatiana (prototype)

## 1. Installer

```bash
npm install
```

## 2. Configurer (optionnel pour le profil, requis pour l'IA)

```bash
cp .env.example .env
```

Le **chargement du profil fonctionne sans aucune config**. Pour l'étape LLM, 3 providers (`LLM_PROVIDER`) :
- **`claude-code`** (défaut) : utilise ton abonnement **Claude Max** via le CLI `claude` en headless — **pas de clé API**. Prérequis : `claude` installé et connecté (`claude` puis `/login`). Modèle par alias `sonnet`/`opus` (override `CLAUDE_CODE_MODEL`).
- **`ollama`** : modèle local gratuit/hors-ligne. `LLM_PROVIDER=ollama`, serveur Ollama lancé + `ollama pull llama3.1`.
- **`claude`** : API Anthropic payante. `LLM_PROVIDER=claude` + `ANTHROPIC_API_KEY=...` (facturé séparément de ton Max).

## 3. Base de données

SQLite s'initialise tout seul (`data/tatiana.db`). Pour rejouer/voir les migrations :

```bash
npm run migrate
```

## 4. Smoke check (vérification bout-en-bout)

```bash
npm run smoke           # profil + 1 appel LLM via le provider actif
npm run smoke -- --no-llm   # profil seulement
```

Sans clé API, l'étape LLM affiche un message clair au lieu de planter.

## 5. App web

```bash
npm run dev     # http://localhost:3000
```

- Route de vérification JSON : `GET /api/smoke` (ajoute `?llm=0` pour sauter l'IA).
- Route de découverte d'offres : `GET /api/discover` (voir §6).

## 6. Découverte d'offres (Slice 2 — communication, Île-de-France)

Agrège des offres réelles depuis des connecteurs pluggables, déduplique
inter-sources, filtre sur la **communication** + l'Île-de-France, score la
pertinence vs le profil, et stocke en SQLite.

### Identifiants France Travail (source principale, gratuite)

1. Crée un compte développeur sur **https://francetravail.io**.
2. Crée une **application** → tu obtiens un *Identifiant* (client id) et une
   *Clé secrète* (client secret).
3. **Abonne** l'application à l'API « Offres d'emploi v2 » (autorise le scope).
4. Renseigne dans `.env` :

```bash
FRANCE_TRAVAIL_CLIENT_ID=...
FRANCE_TRAVAIL_CLIENT_SECRET=...
```

### Choisir les sources

```bash
# Par défaut (non défini) : france-travail uniquement.
JOB_SOURCES=france-travail,apec,welcome-to-the-jungle
```

APEC et Welcome to the Jungle sont **opt-in et non bloquants** (scraping : si
ça casse, la passe continue). LinkedIn / Indeed / Glassdoor sont **best-effort**
et nécessitent la dépendance optionnelle `playwright` :

```bash
npm i playwright && npx playwright install chromium
JOB_SOURCES=france-travail,linkedin
```

### Lancer une passe

```bash
npm run discover                                  # comm + toute l'IDF
npm run discover -- --keywords="relations presse" # surcharge des mots-clés
npm run discover -- --departments=75,92 --limit=20
```

Ou via l'app : `GET /api/discover?keywords=communication&departments=75,92&limit=20`.

Sans identifiants France Travail, la passe ne plante pas : elle affiche un
message clair par source et renvoie 0 offre.

## 7. Générer une candidature (Slice 3 — CV + lettre anti-ATS)

Pour une offre stockée, génère un **CV + une lettre adaptés à l'offre** et
optimisés ATS, exportés en **PDF + DOCX**. L'adaptation passe par le provider
LLM actif (`claude-code` par défaut, ton abonnement Claude Max) avec un
**garde-fou zéro-invention** : tout ce qui est généré est tracé au profil ; ce
qui ne l'est pas est retiré et signalé.

```bash
npm run generate -- --offer=<id>   # <id> = id d'une offre (voir npm run discover)
```

Les 4 fichiers sont écrits dans `data/applications/offer-<id>/` :
`cv.pdf`, `cv.docx`, `lettre.pdf`, `lettre.docx`.

Via l'app :
- `POST /api/applications/generate` avec `{ "offerId": <id> }` → génère + persiste.
- `GET /api/applications/<id>/cv.pdf` (ou `cv.docx`, `lettre.pdf`, `lettre.docx`) → télécharge.

Si le provider LLM n'est pas configuré/joignable, la génération affiche un
message clair et ne produit **aucun** fichier inventé (pas de crash).

## 8. Relire, envoyer, suivre (Slice 4 — interface web)

Tout se fait depuis l'app web (`npm run dev`, http://localhost:3000). La barre de
navigation donne accès à **Offres** et **Suivi**.

### Relire et éditer (Slice 4a)

- `/offres` : la liste, triée par pertinence. **Clique un titre** pour ouvrir la fiche.
- `/offres/<id>` : la fiche détail. Bouton **Générer la candidature** (réutilise la
  génération anti-ATS), **aperçu** du CV + lettre, **éditeur** inline (titre, résumé,
  expériences + atouts, compétences, langues, paragraphes de lettre), **Enregistrer**.
- Les 4 téléchargements (`cv.pdf`, `cv.docx`, `lettre.pdf`, `lettre.docx`) reflètent
  toujours le dernier contenu enregistré.

### Envoyer (Slice 4b — handoff email, envoi manuel)

Depuis la fiche, section **Préparer l'email** :
- **Brouillon mailto** : ouvre ton client mail avec objet + message pré-remplis
  (les pièces jointes s'ajoutent à la main — `mailto:` ne peut pas les porter).
- **email.eml** (`GET /api/applications/<id>/email.eml`) : un fichier `.eml` qui
  s'ouvre dans le client mail avec le CV et la lettre **déjà attachés** (MIME fait
  main, pas de SMTP). **Aucun envoi automatique.**

### Suivre (Slice 4b — statuts + historique)

- Statuts : `à_traiter` → `générée` → `validée` → `envoyée` → `relancée` → `réponse`.
  La génération met le statut à `générée` ; les autres sont posés à la main depuis
  la fiche. On peut **noter une relance** (passe en `relancée`) et **ajouter une note**.
- `/suivi` : toutes les candidatures avec offre, statut et dernière mise à jour ;
  chaque ligne ramène à sa fiche. Le statut s'affiche aussi en pastille dans `/offres`.

> ⚠️ Les PDF se rendent en build de prod (`npm run build && npm start`). En `npm run dev`
> les téléchargements/`.eml` PDF échouent (pdfkit) ; les DOCX marchent partout.

## Structure (slice bootstrap-foundations)

```
app/                  # Next.js App Router (page d'accueil + /api/smoke)
lib/
  config.ts           # config env typée (zod), fail-fast
  db/                 # SQLite (better-sqlite3) + migrations .sql
  profile/            # ingestion CV (.md, depuis le PDF) + LinkedIn (.md) -> CandidateProfile (zod)
  llm/                # bridge LLMProvider : claude | ollama (factory par config)
  smoke.ts            # cœur du smoke check (partagé CLI + API)
scripts/              # smoke.ts, migrate.ts (tsx)
source/               # CV + extract LinkedIn (sources de vérité)
```
