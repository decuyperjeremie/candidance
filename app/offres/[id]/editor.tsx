"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ApplicationContent,
  CvExperience,
  CvLanguage,
} from "@/lib/generation/content";

const ACCENT = "#7fd4ff";
const MUTED = "#9a9aa3";
const CARD_BG = "#14141b";
const BORDER = "#23232d";

const labelStyle = {
  display: "block",
  fontSize: "0.78rem",
  color: MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
} as const;

const inputStyle = {
  width: "100%",
  background: "#0e0e14",
  color: "#e7e7ea",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "0.55rem 0.7rem",
  fontSize: "0.95rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
} as const;

const fieldGap = { display: "grid", gap: 6, marginBottom: "1rem" } as const;

/** Split a textarea value into trimmed, non-empty lines (highlights, skills). */
function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Split a textarea into paragraphs on blank lines (preserves multi-line text). */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Client editor for the persisted ApplicationContent. Edits headline, summary,
 * experiences + highlights, skills, languages and the letter paragraphs. Arrays
 * are edited as newline text (paragraphs on blank lines) and re-assembled on
 * save. Formations/contact are carried through untouched. Saves via
 * PUT /api/applications/<offerId>, then router.refresh() so the read-only view +
 * downloads reflect the edits. Invalid saves surface the server's 422 message.
 */
export function ApplicationEditor({
  offerId,
  initial,
}: {
  offerId: number;
  initial: ApplicationContent;
}) {
  const router = useRouter();
  const [headline, setHeadline] = useState(initial.cv.headline ?? "");
  const [summary, setSummary] = useState(initial.cv.summary ?? "");
  const [experiences, setExperiences] = useState(
    initial.cv.experiences.map((e) => ({
      ...e,
      highlightsText: e.highlights.join("\n"),
    })),
  );
  const [skillsText, setSkillsText] = useState(initial.cv.skills.join("\n"));
  const [languagesText, setLanguagesText] = useState(
    initial.cv.languages.map((l) => (l.level ? `${l.name} : ${l.level}` : l.name)).join("\n"),
  );
  const [recipientContext, setRecipientContext] = useState(
    initial.letter.recipientContext ?? "",
  );
  const [lettreText, setLettreText] = useState(initial.letter.paragraphs.join("\n\n"));

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function updateExperience(idx: number, patch: Record<string, string>) {
    setExperiences((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  }

  function buildContent(): ApplicationContent {
    const langs: CvLanguage[] = lines(languagesText).map((line) => {
      const sep = line.indexOf(":");
      if (sep === -1) return { name: line };
      return { name: line.slice(0, sep).trim(), level: line.slice(sep + 1).trim() || undefined };
    });
    const exps: CvExperience[] = experiences.map((e) => ({
      title: e.title,
      organisation: e.organisation,
      period: e.period,
      location: e.location,
      highlights: lines(e.highlightsText),
    }));
    return {
      cv: {
        ...initial.cv,
        headline: headline.trim() || undefined,
        summary: summary.trim() || undefined,
        experiences: exps,
        skills: lines(skillsText),
        languages: langs,
      },
      letter: {
        recipientContext: recipientContext.trim() || undefined,
        paragraphs: paragraphs(lettreText),
      },
    };
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/applications/${offerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildContent()),
        cache: "no-store",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? `Échec (HTTP ${res.status}).` });
        return;
      }
      setMsg({ ok: true, text: "Enregistré. Les téléchargements reflètent vos modifications." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: `Échec : ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        padding: "1.25rem 1.4rem",
        marginTop: "1.5rem",
      }}
    >
      <h2 style={{ fontSize: "1.15rem", marginTop: 0 }}>Éditer la candidature</h2>
      <p style={{ color: MUTED, fontSize: "0.85rem", marginTop: 0 }}>
        Modifiez librement le texte. Les listes (atouts, compétences, langues) se
        saisissent une par ligne ; les paragraphes de lettre se séparent par une
        ligne vide.
      </p>

      <h3 style={{ fontSize: "0.95rem", color: ACCENT, marginBottom: "0.6rem" }}>CV</h3>

      <div style={fieldGap}>
        <label style={labelStyle}>Titre / accroche</label>
        <input style={inputStyle} value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </div>

      <div style={fieldGap}>
        <label style={labelStyle}>Résumé</label>
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <label style={labelStyle}>Expériences</label>
      {experiences.map((e, i) => (
        <div
          key={i}
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: "0.8rem 0.9rem",
            marginBottom: "0.8rem",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="Intitulé"
              value={e.title}
              onChange={(ev) => updateExperience(i, { title: ev.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Organisation"
              value={e.organisation ?? ""}
              onChange={(ev) => updateExperience(i, { organisation: ev.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Période"
              value={e.period ?? ""}
              onChange={(ev) => updateExperience(i, { period: ev.target.value })}
            />
            <input
              style={inputStyle}
              placeholder="Lieu"
              value={e.location ?? ""}
              onChange={(ev) => updateExperience(i, { location: ev.target.value })}
            />
          </div>
          <div style={{ ...fieldGap, marginTop: 8, marginBottom: 0 }}>
            <label style={labelStyle}>Atouts (un par ligne)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              value={e.highlightsText}
              onChange={(ev) => updateExperience(i, { highlightsText: ev.target.value })}
            />
          </div>
        </div>
      ))}

      <div style={fieldGap}>
        <label style={labelStyle}>Compétences (une par ligne)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
        />
      </div>

      <div style={fieldGap}>
        <label style={labelStyle}>Langues (une par ligne — « Français : natif »)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
          value={languagesText}
          onChange={(e) => setLanguagesText(e.target.value)}
        />
      </div>

      <h3 style={{ fontSize: "0.95rem", color: ACCENT, margin: "1.2rem 0 0.6rem" }}>Lettre</h3>

      <div style={fieldGap}>
        <label style={labelStyle}>Destinataire / contexte (optionnel)</label>
        <input
          style={inputStyle}
          value={recipientContext}
          onChange={(e) => setRecipientContext(e.target.value)}
        />
      </div>

      <div style={fieldGap}>
        <label style={labelStyle}>Paragraphes (séparés par une ligne vide)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 220, resize: "vertical" }}
          value={lettreText}
          onChange={(e) => setLettreText(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: saving ? "#2a2a33" : ACCENT,
            color: saving ? MUTED : "#0b0b0f",
            border: "none",
            borderRadius: 8,
            padding: "0.6rem 1.2rem",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {msg && (
          <span style={{ color: msg.ok ? "#3ddc84" : "#ff8080", fontSize: "0.9rem" }}>
            {msg.text}
          </span>
        )}
      </div>
    </section>
  );
}

/**
 * "Générer" — triggers the existing application-generation route for an offer
 * with no application yet, then refreshes. Surfaces the route's clear message
 * (e.g. provider unavailable) on failure; no fabricated content on error.
 */
export function GenerateButton({ offerId }: { offerId: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/applications/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId }),
        cache: "no-store",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? `Échec (HTTP ${res.status}).`);
        return;
      }
      router.refresh();
    } catch (err) {
      setMsg(`Échec : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
      <button
        onClick={run}
        disabled={running}
        style={{
          background: running ? "#2a2a33" : ACCENT,
          color: running ? MUTED : "#0b0b0f",
          border: "none",
          borderRadius: 8,
          padding: "0.6rem 1.2rem",
          fontSize: "0.95rem",
          fontWeight: 600,
          cursor: running ? "default" : "pointer",
        }}
      >
        {running ? "Génération en cours… (peut prendre ~1 min)" : "Générer la candidature"}
      </button>
      {msg && <span style={{ color: "#ff8080", fontSize: "0.9rem" }}>{msg}</span>}
    </div>
  );
}
