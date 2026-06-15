"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ApplicationContent,
  CvExperience,
  CvLanguage,
} from "@/lib/generation/content";

const fieldGap = { display: "grid", gap: 6, marginBottom: "var(--sp-4)" } as const;

/** Split a textarea value into trimmed, non-empty lines (highlights, skills). */
function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Split a textarea into paragraphs on blank lines (preserves multi-line text). */
function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

/**
 * Client editor for the persisted ApplicationContent. Edits headline, summary,
 * experiences + highlights, skills, languages and the letter paragraphs. Arrays
 * are edited as newline text and re-assembled on save; formations/contact are
 * carried through untouched. Saves via PUT then router.refresh(). Behaviour
 * unchanged by the redesign.
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
    initial.cv.experiences.map((e) => ({ ...e, highlightsText: e.highlights.join("\n") })),
  );
  const [skillsText, setSkillsText] = useState(initial.cv.skills.join("\n"));
  const [languagesText, setLanguagesText] = useState(
    initial.cv.languages.map((l) => (l.level ? `${l.name} : ${l.level}` : l.name)).join("\n"),
  );
  const [recipientContext, setRecipientContext] = useState(initial.letter.recipientContext ?? "");
  const [lettreText, setLettreText] = useState(initial.letter.paragraphs.join("\n\n"));

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function updateExperience(idx: number, patch: Record<string, string>) {
    setExperiences((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
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
      category: e.category,
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
    <section className="card">
      <h2 className="section-title">Éditer la candidature</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Modifiez librement le texte. Les listes (atouts, compétences, langues) se
        saisissent une par ligne ; les paragraphes de lettre se séparent par une
        ligne vide.
      </p>

      <h3 style={{ margin: "var(--sp-4) 0 var(--sp-3)" }}>CV</h3>

      <div style={fieldGap}>
        <label className="label">Titre / accroche</label>
        <input className="input" value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </div>

      <div style={fieldGap}>
        <label className="label">Résumé</label>
        <textarea className="input" style={{ minHeight: 90, resize: "vertical" }} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>

      <label className="label">Expériences</label>
      {experiences.map((e, i) => (
        <div key={i} style={{ border: "1px solid var(--hairline)", borderRadius: "var(--radius-sm)", padding: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input className="input" placeholder="Intitulé" value={e.title} onChange={(ev) => updateExperience(i, { title: ev.target.value })} />
            <input className="input" placeholder="Organisation" value={e.organisation ?? ""} onChange={(ev) => updateExperience(i, { organisation: ev.target.value })} />
            <input className="input" placeholder="Période" value={e.period ?? ""} onChange={(ev) => updateExperience(i, { period: ev.target.value })} />
            <input className="input" placeholder="Lieu" value={e.location ?? ""} onChange={(ev) => updateExperience(i, { location: ev.target.value })} />
          </div>
          <div style={{ ...fieldGap, marginTop: 8, marginBottom: 0 }}>
            <label className="label">Atouts (un par ligne)</label>
            <textarea className="input" style={{ minHeight: 70, resize: "vertical" }} value={e.highlightsText} onChange={(ev) => updateExperience(i, { highlightsText: ev.target.value })} />
          </div>
        </div>
      ))}

      <div style={fieldGap}>
        <label className="label">Compétences (une par ligne)</label>
        <textarea className="input" style={{ minHeight: 80, resize: "vertical" }} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
      </div>

      <div style={fieldGap}>
        <label className="label">Langues (une par ligne — « Français : courant »)</label>
        <textarea className="input" style={{ minHeight: 70, resize: "vertical" }} value={languagesText} onChange={(e) => setLanguagesText(e.target.value)} />
      </div>

      <h3 style={{ margin: "var(--sp-5) 0 var(--sp-3)" }}>Lettre</h3>

      <div style={fieldGap}>
        <label className="label">Destinataire / contexte (optionnel)</label>
        <input className="input" value={recipientContext} onChange={(e) => setRecipientContext(e.target.value)} />
      </div>

      <div style={fieldGap}>
        <label className="label">Paragraphes (séparés par une ligne vide)</label>
        <textarea className="input" style={{ minHeight: 220, resize: "vertical" }} value={lettreText} onChange={(e) => setLettreText(e.target.value)} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {msg && (
          <span className="small" style={{ color: msg.ok ? "var(--good)" : "#b3261e" }}>{msg.text}</span>
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
      <button onClick={run} disabled={running} className="btn btn-primary">
        {running ? "Génération en cours… (peut prendre ~1 min)" : "Générer la candidature"}
      </button>
      {msg && <span className="small" style={{ color: "#b3261e" }}>{msg}</span>}
    </div>
  );
}
