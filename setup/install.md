# Installer Candidance — runbook Claude Code

> **Dépôt :** `https://github.com/decuyperjeremie/candidance`
> **URL de clone :** `https://github.com/decuyperjeremie/candidance.git`
>
> **Comment lancer ce fichier :** ouvre **Claude Code** (dans **Claude Desktop**),
> colle le contenu de ce fichier dans la conversation et écris :
> _« Exécute ce runbook d'installation, étape par étape, sur ma machine Windows. »_

Ce runbook installe l'application sur un PC **Windows**, sans que l'utilisatrice
ait à taper de commandes elle-même : **Claude Code exécute les étapes**. Il est
**idempotent** — le relancer ne casse rien et met simplement l'install à jour.

La génération de CV/lettres utilise le **compte Claude connecté localement**
(provider `claude-code`) : pas de clé API, pas de facturation séparée.

---

## Prérequis (à vérifier d'abord)

- **Claude Desktop** installé, avec **Claude Code**, et **connecté** : dans un
  terminal, `claude` puis `/login` doit fonctionner. C'est ce compte qui
  produira les CV/lettres.
- Une connexion Internet (clone + téléchargement des dépendances).
- Node.js et git **ne sont pas requis au préalable** : le script les installe
  via `winget` s'ils manquent.

> Claude Code : si `claude --version` échoue, arrête-toi et demande à
> l'utilisatrice d'installer Claude Desktop et de se connecter (`/login`) avant
> de continuer.

---

## Procédure

Tout le travail mécanique (prérequis, clone, dépendances, build, raccourci) est
fait par un script PowerShell reproductible — **tu n'inventes pas les commandes**.

### Étape 1 — Récupérer et lancer l'installateur

Depuis n'importe quel dossier, télécharge puis exécute le script d'install :

```powershell
$dir = "$env:USERPROFILE\Downloads"
Invoke-WebRequest -UseBasicParsing `
  -Uri "https://raw.githubusercontent.com/decuyperjeremie/candidance/main/setup/install.ps1" `
  -OutFile "$dir\candidance-install.ps1"
powershell -ExecutionPolicy Bypass -File "$dir\candidance-install.ps1"
```

Le script, dans l'ordre :
1. installe **Node.js LTS** et **git** via winget s'ils manquent ;
2. vérifie la présence du CLI `claude` (avertit seulement s'il manque) ;
3. clone le dépôt dans **`%USERPROFILE%\candidance`** (ou le met à jour s'il existe) ;
4. installe les dépendances (`npm ci`) ;
5. crée `.env` avec `LLM_PROVIDER=claude-code` ;
6. fait un **build de production** (`npm run build`) ;
7. crée un **raccourci « Candidance » sur le Bureau** ;
8. propose de lancer l'app.

> Si winget vient d'installer Node ou git mais que le script dit qu'ils ne sont
> « pas encore sur le PATH », **ferme et rouvre le terminal / Claude Code**, puis
> relance la même commande. Le script reprend là où il en était.

### Étape 2 — ⚠️ Fallback `better-sqlite3` (uniquement si l'étape 1 échoue à `npm ci`)

`better-sqlite3` est le **seul module natif**. Sur Node LTS + Windows il utilise
normalement un binaire **pré-compilé**. Si la compilation depuis les sources
échoue (message mentionnant `better-sqlite3`, `node-gyp`, `MSB`, ou un compilateur
C++ manquant), installe les outils de build puis recompile :

```powershell
winget install -e --id Microsoft.VisualStudio.2022.BuildTools `
  --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

# Recompiler depuis les sources, puis reprendre l'install :
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\candidance-install.ps1" -BuildFromSource
```

Ne passe à cette étape **que** si l'étape 1 a réellement échoué sur ce module —
sinon ignore-la.

### Étape 3 — Lancer

L'app se lance via le **raccourci « Candidance »** du Bureau (ou le script l'a déjà
ouverte). Une fenêtre s'ouvre, le serveur démarre, et le navigateur s'ouvre sur
`http://localhost:3000`. **Fermer la fenêtre arrête l'app.**

---

## Mises à jour

Pas besoin de relancer ce runbook à chaque fois : un bouton **« Mettre à jour »**
est intégré dans l'app (en haut à droite). Il récupère la dernière version, la
reconstruit et redémarre tout seul.

Le runbook reste le **filet de secours** : si l'app ne démarre plus, relance
l'étape 1 — elle remet l'install dans un état propre et à jour sans toucher aux
données (`data\`) ni à la configuration (`.env`).

## Où sont mes données ?

Tout est dans le dossier d'install `%USERPROFILE%\candidance` :
- `data\` — base SQLite (offres, candidatures générées) ;
- `.env` — configuration.

Ces deux éléments sont **hors du dépôt git** : ils survivent aux mises à jour et
aux réinstallations.
