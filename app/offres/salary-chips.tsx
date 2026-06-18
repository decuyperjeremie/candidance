import { rawSalaryIsMeaningful, type SalaryInfo } from "@/lib/aggregation/salary";

/**
 * Renders salary as chips: separate "💶 Brut : …" / "💵 Net : …" when the label
 * distinguished them, a single "💶 …" amount otherwise, or the raw label as a
 * fallback when no amount could be extracted but the text is still informative
 * (e.g. "Selon profil"). Pure presentational — safe in server and client trees.
 */
export function SalaryChips({ info, raw }: { info: SalaryInfo | null; raw?: string }) {
  if (info?.brut || info?.net) {
    return (
      <>
        {info.brut && <span className="chip chip-pay">💶 Brut : {info.brut.label}</span>}
        {info.net && <span className="chip chip-pay">💵 Net : {info.net.label}</span>}
      </>
    );
  }
  if (info?.montant) {
    return <span className="chip chip-pay">💶 {info.montant.label}</span>;
  }
  if (rawSalaryIsMeaningful(raw)) {
    return <span className="chip chip-pay">💶 {raw}</span>;
  }
  return null;
}
