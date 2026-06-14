# Tatiana — Assistant de recherche d'emploi

> Prototype jetable. Outil personnel pour aider **Tatiana Ávila Gomes** (utilisatrice non-technique) à trouver des offres, adapter ses candidatures, passer le premier filtre IA des recruteurs et suivre ses candidatures.

---

## 1. Le problème

Tatiana perd beaucoup de temps à :
1. **Chercher** des offres dispersées sur plusieurs sites.
2. **Adapter** son CV et sa lettre à chaque offre.
3. **Passer le premier filtre** : ses candidatures sont rejetées par les ATS (logiciels de tri automatique) avant qu'un humain ne les lise.
4. **Suivre** où elle en est (qui a été relancé, qui a répondu).

## 2. Ce que l'outil fait

```
Crawl multi-sources → Agrégation + dédup → Pour chaque offre : CV + lettre adaptés (anti-ATS)
                                                ↓
                  Elle relit / édite / valide dans une interface web
                                                ↓
                  Email pré-rempli + fichiers (PDF/DOCX) → Envoi MANUEL par elle
                                                ↓
                  Suivi de candidature (statut, relances, réponses)
```

**Principe directeur : automatiser un maximum, mais validation humaine obligatoire avant tout envoi.** Aucune candidature n'est envoyée sans son clic.

## 3. Profil de l'utilisatrice

> Sources : `source/CV_Tatiana_27.05.md` (faits — source de vérité) + `source/extract-linkedin.md` (cadrage, réalisations, compétences) + fiche CARISM publique.

- **Tatiana Ávila Gomes** — Paris 18e · 07 52 48 69 44 · tatiana.avilag@gmail.com
- **Headline** : Responsable communication corporate, institutionnelle & de crise | Relations presse | Consultante | Doctorante (désinformation) | **24 ans d'expérience** | FR·EN·PT
- **Doctorante** SIC (Paris Panthéon-Assas, labo CARISM, thèse fake news / bolsonarisme, contrat 2023–2026).
- **Journaliste** (RFI, pige).
- **20-24 ans en communication** corporate, institutionnelle & **de crise** sur 3 continents (Brésil, USA, France) : rebranding, relations presse, événementiel international.
- **Réalisations** : comm de crise grands groupes (énergie, naval, construction) · management équipe de 15 (TIM/MassMedia) · événements 250-350 pers. (forums franco-brésiliens Macron/Lula, forum Japon).
- **Formations** : M2 Sciences Po (Paris 1 Sorbonne), Master Socio/Politique (FGV Brésil), Licence Journalisme (Brésil).
- **Langues** : 🇵🇹 Portugais natif · 🇫🇷 Français C1/C2 · 🇬🇧 Anglais C1 · 🇪🇸 Espagnol B1.

**Profil cadre, hybride : communication (cœur, dont crise) ↔ journalisme/médias ↔ académique/recherche.**

## 4. Périmètre du crawl

- **Postes visés** : ouvert sur les **3 mondes** — communication (priorité), journalisme/médias, académique/recherche (désinformation, SIC).
- **Zone** : Paris / Île-de-France.
- **Langue des offres** : français (international francophone éventuel plus tard).
- **Objectif** : **le maximum de sources** → architecture de **connecteurs pluggables** (interface `JobSource`, un connecteur par site), branchés par ordre de fiabilité.

| Source | Méthode | Fiabilité |
|---|---|---|
| **France Travail** (ex-Pôle Emploi) | API publique gratuite | ✅ Haute |
| **APEC** | API / scraping | ✅ Haute (emploi cadre) |
| **Welcome to the Jungle** | Scraping | 🟡 Moyenne (bcp comm/média) |
| Sites directs (universités, agences comm, médias, CARISM…) | Scraping ciblé | 🟡 Moyenne |
| **LinkedIn / Indeed / Glassdoor** | Navigateur headless | ⚠️ Best-effort (anti-bot) |

## 5. Cœur métier : passer les ATS

- Réinjecter les **mots-clés exacts** de l'offre (intitulé, compétences, outils).
- Format **propre et parsable** (pas de colonnes exotiques, tableaux, images de texte).
- Adapter l'accroche et l'ordre des expériences à l'offre.
- **Garde-fou : zéro invention.** Jamais d'expérience/diplôme fabriqué. L'IA reformule et priorise à partir du profil structuré ; elle n'invente pas.

## 6. Stack technique

- **Full-stack Next.js** (TypeScript, App Router) — une seule app web.
- **Stockage** : SQLite (offres, candidatures, statuts).
- **IA via un bridge de providers switchable** (`LLMProvider`), switch par `LLM_PROVIDER` :
  - **`claude-code`** — DÉFAUT. Appelle le CLI `claude` en headless → utilise l'abonnement **Claude Max** (pas de clé API, inclus dans le pool de crédits Agent SDK du plan). Nécessite le CLI installé + connecté.
  - **`ollama`** — modèle local, gratuit/hors-ligne, qualité moindre.
  - **`claude`** — API Anthropic payante (clé requise), facturée séparément.
- **Documents générés** : **PDF + DOCX** (PDF universel + Word éditable parfois exigé).
- **Sources profil** : `source/CV_Tatiana_Avila_Gomes.12.06.pdf` (original) + son markdown `.md` (parsé) + `source/extract-linkedin.md` (fusionné).

## 7. Interface (parcours utilisatrice)

1. **Liste des offres** agrégées (titre, entreprise, lieu, lien d'origine, date, score de pertinence, statut de candidature).
2. **Détail d'une offre** + **CV adapté** + **lettre adaptée** générés à côté.
3. Elle **relit et édite** les deux.
4. **Validation** → génération PDF + DOCX + **email pré-rempli** (destinataire si connu, objet, corps), éditable.
5. Elle **envoie manuellement**, puis marque le statut.
6. **Tableau de suivi** : statut par candidature, relances, réponses.

---

## 8. 🧩 Découpage en capacités (validé)

| # | Capacité | Rôle | Dépend de |
|---|---|---|---|
| **C1** | `profile-ingestion` | Parser CV docx + fusionner avec extract LinkedIn → profil structuré (source de vérité) | — |
| **C2** | `llm-provider-bridge` | Interface `LLMProvider` → switch Claude ↔ Ollama | — |
| **C3** | `job-sources` | Connecteurs pluggables (`JobSource`) : France Travail, APEC, WTTJ, + best-effort LinkedIn/Indeed/Glassdoor + sites directs | — |
| **C4** | `offer-aggregation` | **Dédup inter-sources** + stockage SQLite + **scoring de pertinence** vs profil + filtres zone/mots-clés | C1, C3 |
| **C5** | `application-generation` | Par offre : CV + lettre adaptés anti-ATS → PDF + DOCX | C1, C2, C4 |
| **C6** | `review-ui` | UI web : liste → détail → CV+lettre éditables → valider | C4, C5 |
| **C7** | `email-handoff` | Fichiers (PDF/DOCX) + email pré-rempli (`mailto:`/`.eml`) → envoi manuel | C5, C6 |
| **C8** | `application-tracking` | Suivi : statuts (à traiter / générée / validée / envoyée / relancée / réponse), relances, historique | C6 |

### Ordre de construction (slices verticales)

- **Slice 0 — Scaffold** : init Next.js (TS, App Router), arbo, SQLite, config env.
- **Slice 1 — Fondations** : C1 + C2.
- **Slice 2 — Trouver** : C3 (connecteurs, France Travail d'abord) + C4 (dédup + scoring). → *liste d'offres réelles.*
- **Slice 3 — Adapter** : C5. → *CV + lettre PDF/DOCX pour une offre.*
- **Slice 4 — Valider, envoyer, suivre** : C6 + C7 + C8. → *parcours complet bout-en-bout + suivi.*

Chaque slice = un incrément **testable et montrable à Tatiana**.

## 9. Contraintes & décisions

- ⚠️ **`mailto:` ne peut PAS joindre de pièces jointes.** Proto : `mailto:` pré-remplit objet+corps, elle attache les fichiers téléchargés à la main (ou on génère un `.eml`). SMTP réel hors périmètre proto (validation manuelle voulue).
- **Dédup inter-sources** (C4) : une même offre publiée sur plusieurs sites = une seule entrée (clé = entreprise + intitulé + lieu normalisés, fuzzy).
- Fréquence du crawl : à la demande (bouton) pour le proto ; planifié plus tard.

## 10. Hors périmètre (prototype)

- Envoi automatique sans validation humaine.
- Multi-utilisateurs / comptes / authentification.
- Marchés hors France.
- Candidature via formulaires propriétaires des sites (on s'arrête au mail / au lien).
