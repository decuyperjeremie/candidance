import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; pdfkit loads its .afm font metrics from a
  // path relative to its own files. Both must stay external to the server bundle
  // so they resolve from node_modules at runtime (otherwise pdfkit 500s on a
  // missing Helvetica.afm when rendering CV/letter PDFs).
  serverExternalPackages: ["better-sqlite3", "pdfkit"],
};

export default nextConfig;
