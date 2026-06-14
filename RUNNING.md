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
