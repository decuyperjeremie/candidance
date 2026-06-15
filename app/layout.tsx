import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tatiana — Assistant de recherche d'emploi",
  description: "Prototype : trouver, adapter, suivre des candidatures (communication, Île-de-France).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <Link href="/" className="nav-brand">
              Tatiana
            </Link>
            <Link href="/offres">Offres</Link>
            <Link href="/suivi">Suivi</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
