import type { LegalDoc } from "./terms.js";
import { legalTerms } from "./terms.js";
import { legalPrivacy } from "./privacy.js";
import { legalGuidelines } from "./guidelines.js";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "links" };

export type LegalPayload = {
  slug: string;
  title: string;
  updated: string;
  blocks: LegalBlock[];
  related: string[];
};

/** Assemble every doc behind `/api/legal/:page` from one consistent source. */
export function legalDocs(appName: string): Record<string, LegalDoc> {
  const updated = String(new Date().getFullYear());
  const docs = [legalTerms(appName, updated), legalPrivacy(appName, updated), legalGuidelines(appName, updated)];
  return Object.fromEntries(docs.map((d) => [d.slug, d]));
}

/** Render-ready blocks for the React client (legacy portable markup). */
export function legalBlocks(doc: LegalDoc): LegalBlock[] {
  const blocks: LegalBlock[] = [{ kind: "p", text: doc.intro }];
  for (const section of doc.sections) {
    blocks.push({ kind: "h2", text: section.heading });
    for (const text of section.body) blocks.push({ kind: "p", text });
    if (section.list) blocks.push({ kind: "list", items: section.list });
  }
  blocks.push({ kind: "links" });
  return blocks;
}

/**
 * Full response for one doc. `title`/`body` stay flat so the previous React
 * client (one paragraph) keeps rendering; `doc` carries the structured copy.
 */
export function legalPayload(doc: LegalDoc, all: Record<string, LegalDoc>): {
  title: string;
  body: string;
  doc: LegalPayload;
} {
  const parts: string[] = [doc.intro];
  for (const section of doc.sections) {
    parts.push(section.heading, ...section.body);
    if (section.list) parts.push(...section.list);
  }
  const body = parts.join("\n\n");
  return {
    title: doc.title,
    body,
    doc: {
      slug: doc.slug,
      title: doc.title,
      updated: doc.updated,
      blocks: legalBlocks(doc),
      related: Object.keys(all).filter((k) => k !== doc.slug),
    },
  };
}
