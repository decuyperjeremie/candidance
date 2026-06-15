/**
 * Application tracking (migration 0005): a status lifecycle per application plus
 * an event history (status changes, relances, free-text notes). Status is a
 * column on the `applications` row; history lives in `application_events`.
 * SQL-only, no ORM (project convention).
 */

import { getDb } from "@/lib/db";

/** The allowed status lifecycle, in order. */
export const STATUSES = [
  "à_traiter",
  "générée",
  "validée",
  "envoyée",
  "relancée",
  "réponse",
] as const;
export type ApplicationStatus = (typeof STATUSES)[number];

/** Human labels for display (the raw values use underscores). */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  à_traiter: "À traiter",
  générée: "Générée",
  validée: "Validée",
  envoyée: "Envoyée",
  relancée: "Relancée",
  réponse: "Réponse reçue",
};

export function isStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export type EventType = "status" | "relance" | "note";

export type ApplicationEvent = {
  id: number;
  offerId: number;
  type: EventType;
  note?: string;
  createdAt: string;
};

export type TrackedApplication = {
  offerId: number;
  offerTitle: string;
  company?: string;
  status: ApplicationStatus;
  lastUpdate: string;
};

/** Read the current status of an offer's application ('à_traiter' if none). */
export function getStatus(offerId: number): ApplicationStatus {
  const row = getDb()
    .prepare("SELECT status FROM applications WHERE offer_id = ?")
    .get(offerId) as { status?: string } | undefined;
  return isStatus(row?.status) ? row!.status : "à_traiter";
}

/** Statuses for many offers at once (for the offer list). Missing -> absent. */
export function getStatuses(offerIds: number[]): Map<number, ApplicationStatus> {
  const map = new Map<number, ApplicationStatus>();
  if (offerIds.length === 0) return map;
  const placeholders = offerIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(`SELECT offer_id, status FROM applications WHERE offer_id IN (${placeholders})`)
    .all(...offerIds) as { offer_id: number; status: string }[];
  for (const r of rows) if (isStatus(r.status)) map.set(r.offer_id, r.status);
  return map;
}

/**
 * Set the status of an existing application and log a `status` event. Throws if
 * the offer has no application (status only exists once an application is made).
 */
export function setStatus(offerId: number, status: ApplicationStatus): void {
  if (!isStatus(status)) throw new Error(`Statut invalide : ${status}`);
  const db = getDb();
  const tx = db.transaction(() => {
    const res = db
      .prepare(
        "UPDATE applications SET status = ?, status_updated_at = datetime('now') WHERE offer_id = ?",
      )
      .run(status, offerId);
    if (res.changes === 0) {
      throw new Error(`Aucune candidature pour l'offre #${offerId}.`);
    }
    db.prepare(
      "INSERT INTO application_events (offer_id, type, note) VALUES (?, 'status', ?)",
    ).run(offerId, status);
  });
  tx();
}

/** Add a relance or note event (timestamped). */
export function addEvent(offerId: number, type: Exclude<EventType, "status">, note?: string): void {
  if (type !== "relance" && type !== "note") throw new Error(`Type d'événement invalide : ${type}`);
  if (type === "note" && !note?.trim()) throw new Error("Une note ne peut pas être vide.");
  getDb()
    .prepare("INSERT INTO application_events (offer_id, type, note) VALUES (?, ?, ?)")
    .run(offerId, type, note?.trim() || null);
}

/** Event history for an application, most recent first. */
export function getEvents(offerId: number): ApplicationEvent[] {
  const rows = getDb()
    .prepare(
      "SELECT id, offer_id, type, note, created_at FROM application_events WHERE offer_id = ? ORDER BY created_at DESC, id DESC",
    )
    .all(offerId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as number,
    offerId: r.offer_id as number,
    type: r.type as EventType,
    note: (r.note as string) ?? undefined,
    createdAt: r.created_at as string,
  }));
}

/** All applications with their offer + status + last update, newest first. */
export function listTrackedApplications(): TrackedApplication[] {
  const rows = getDb()
    .prepare(`
      SELECT a.offer_id, o.title, o.company, a.status,
             COALESCE(a.status_updated_at, a.updated_at) AS last_update
      FROM applications a
      JOIN offers o ON o.id = a.offer_id
      ORDER BY last_update DESC
    `)
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    offerId: r.offer_id as number,
    offerTitle: r.title as string,
    company: (r.company as string) ?? undefined,
    status: isStatus(r.status) ? (r.status as ApplicationStatus) : "à_traiter",
    lastUpdate: r.last_update as string,
  }));
}
