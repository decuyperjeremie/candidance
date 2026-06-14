/**
 * Render an ApplicationContent to the four downloadable files. One shared model
 * (content) -> identical content across PDF and DOCX.
 */

import type { ApplicationContent } from "@/lib/generation/content";
import { renderCvDocx, renderLetterDocx } from "./docx";
import { renderCvPdf, renderLetterPdf } from "./pdf";

export const APPLICATION_FILES = ["cv.pdf", "cv.docx", "lettre.pdf", "lettre.docx"] as const;
export type ApplicationFile = (typeof APPLICATION_FILES)[number];

export function isApplicationFile(name: string): name is ApplicationFile {
  return (APPLICATION_FILES as readonly string[]).includes(name);
}

export const CONTENT_TYPES: Record<ApplicationFile, string> = {
  "cv.pdf": "application/pdf",
  "lettre.pdf": "application/pdf",
  "cv.docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "lettre.docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Render a single application file from the content. */
export function renderFile(content: ApplicationContent, file: ApplicationFile): Promise<Buffer> {
  const name = content.cv.contact.fullName;
  switch (file) {
    case "cv.pdf":
      return renderCvPdf(content.cv);
    case "cv.docx":
      return renderCvDocx(content.cv);
    case "lettre.pdf":
      return renderLetterPdf(content.letter, name);
    case "lettre.docx":
      return renderLetterDocx(content.letter, name);
  }
}
