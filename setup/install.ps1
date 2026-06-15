<#
.SYNOPSIS
  Deterministic, idempotent installer for Candidance on Windows.

.DESCRIPTION
  The mechanical half of the install runbook (setup/install.md). Safe to re-run:
  it converges an existing install to an up-to-date, production-built state.

  Steps:
    1. Prerequisites  - install Node.js LTS + git via winget if missing.
    2. Claude CLI     - check `claude` is present and logged in (warn only).
    3. Fetch          - clone the repo to a fixed folder, or update it in place.
    4. Dependencies   - `npm ci`, with a flagged better-sqlite3 build fallback.
    5. Configure      - create .env (LLM_PROVIDER=claude-code) if absent.
    6. Build          - `npm run build` (required for PDF rendering).
    7. Launcher       - create a Desktop shortcut to the supervised launcher.

  Can run standalone (downloaded on a clean machine) or from inside the clone.

.PARAMETER RepoUrl
  Git URL to clone. Defaults to the published repository.

.PARAMETER InstallDir
  Target folder. Defaults to %USERPROFILE%\candidance.

.PARAMETER BuildFromSource
  Force compiling better-sqlite3 from source (use after installing MSVC tools).

.PARAMETER NoLaunch
  Do not offer to start the app at the end.
#>
[CmdletBinding()]
param(
  [string]$RepoUrl = "https://github.com/decuyperjeremie/candidance.git",
  [string]$InstallDir = (Join-Path $env:USERPROFILE "candidance"),
  [switch]$BuildFromSource,
  [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"

function Info($m)  { Write-Host "[install] $m" -ForegroundColor Cyan }
function Ok($m)    { Write-Host "[install] $m" -ForegroundColor Green }
function Warn($m)  { Write-Host "[install] $m" -ForegroundColor Yellow }
function Fail($m)  { Write-Host "[install] $m" -ForegroundColor Red }

function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

# Re-read PATH from the registry so tools installed in this session are found
# without reopening the terminal.
function Refresh-Path {
  $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Ensure-Winget {
  if (-not (Have "winget")) {
    Fail "winget introuvable. Installez 'App Installer' depuis le Microsoft Store, puis relancez."
    throw "winget required"
  }
}

function Ensure-Tool($cmd, $wingetId, $label) {
  if (Have $cmd) { Ok "$label déjà présent ($((& $cmd --version 2>&1 | Select-Object -First 1)))."; return }
  Ensure-Winget
  Info "Installation de $label via winget ($wingetId)…"
  winget install -e --id $wingetId --accept-source-agreements --accept-package-agreements
  Refresh-Path
  if (-not (Have $cmd)) {
    Warn "$label installé mais pas encore sur le PATH de cette session."
    Warn "Fermez puis rouvrez Claude Code / le terminal et relancez ce script."
    throw "$label not on PATH yet"
  }
  Ok "$label installé."
}

# --- 1. Prerequisites ------------------------------------------------------
Ensure-Tool "node" "OpenJS.NodeJS.LTS" "Node.js LTS"
Ensure-Tool "git"  "Git.Git"           "git"

# --- 2. Claude CLI (powers generation; not required to finish installing) --
if (Have "claude") {
  Ok "CLI 'claude' détectée."
} else {
  Warn "CLI 'claude' introuvable. La génération de CV/lettres en a besoin."
  Warn "Installez Claude Desktop (avec Claude Code) et connectez-vous : lancez 'claude' puis /login."
}

# --- 3. Fetch (clone or update) -------------------------------------------
if (Test-Path (Join-Path $InstallDir ".git")) {
  Info "Install existante détectée dans $InstallDir — mise à jour…"
  git -C $InstallDir fetch --quiet origin
  git -C $InstallDir reset --hard origin/main
} else {
  if (Test-Path $InstallDir) {
    Fail "$InstallDir existe mais n'est pas un dépôt git. Supprimez-le ou choisissez -InstallDir."
    throw "install dir not a git repo"
  }
  Info "Clonage de $RepoUrl vers $InstallDir…"
  git clone $RepoUrl $InstallDir
}
Set-Location $InstallDir
Ok "Code récupéré dans $InstallDir."

# --- 4. Dependencies (with better-sqlite3 fallback) -----------------------
function Install-Deps {
  if ($BuildFromSource) { $env:npm_config_build_from_source = "true" }
  npm ci
}
try {
  Info "Installation des dépendances (npm ci)…"
  Install-Deps
  Ok "Dépendances installées."
}
catch {
  # better-sqlite3 is the one native module; a prebuilt binary normally covers
  # Node LTS on Windows. If the build fell back to source and failed, the user
  # is missing the MSVC C++ build tools.
  Fail "npm ci a échoué. Erreur :"
  Write-Host $_.Exception.Message
  Warn "============================================================"
  Warn " Échec probable de la compilation de better-sqlite3 (module natif)."
  Warn " Installez les outils de build C++ puis recompilez :"
  Warn ""
  Warn "   winget install -e --id Microsoft.VisualStudio.2022.BuildTools \\"
  Warn "     --override `"--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended`""
  Warn ""
  Warn " Puis relancez ce script avec : -BuildFromSource"
  Warn "   powershell -ExecutionPolicy Bypass -File setup\install.ps1 -BuildFromSource"
  Warn "============================================================"
  throw
}

# --- 5. Configure ----------------------------------------------------------
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Ok "Fichier .env créé (LLM_PROVIDER=claude-code par défaut)."
  Info "Optionnel : ajoutez FRANCE_TRAVAIL_CLIENT_ID/SECRET dans .env pour activer la recherche d'offres."
} else {
  Ok ".env déjà présent — conservé tel quel."
}

# --- 6. Build (production; required for PDF rendering) --------------------
Info "Construction de l'application (npm run build)…"
npm run build
Ok "Build terminé."

# --- 7. Desktop launcher shortcut -----------------------------------------
$bat = Join-Path $InstallDir "setup\candidance.bat"
$desktop = [Environment]::GetFolderPath("Desktop")
$lnk = Join-Path $desktop "Candidance.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnk)
$shortcut.TargetPath = $bat
$shortcut.WorkingDirectory = $InstallDir
$shortcut.IconLocation = "shell32.dll,13"
$shortcut.Description = "Lancer Candidance"
$shortcut.Save()
Ok "Raccourci créé sur le Bureau : Candidance."

Ok "Installation terminée. 🎉"
if (-not $NoLaunch) {
  $ans = Read-Host "Lancer Candidance maintenant ? (O/n)"
  if ($ans -eq "" -or $ans -match "^[OoYy]") { Start-Process $bat }
}
