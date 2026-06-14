import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tatiana — Assistant de recherche d'emploi",
  description: "Prototype jetable. Foundation slice (profile + LLM bridge).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          padding: 0,
          background: "#0b0b0f",
          color: "#e7e7ea",
        }}
      >
        {children}
      </body>
    </html>
  );
}
