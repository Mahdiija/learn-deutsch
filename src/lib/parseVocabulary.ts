import type { VocabItem } from "@/data/vocabulary";

export type ParseResult = {
  title: string;
  items: VocabItem[];
  skipped: number;
};

/** Matches: `1. die Vorlesung — معنی` (also –, —, -, : separators) */
const LINE_RE =
  /^\s*(\d+)\s*[.)]\s*(.+?)\s*[—–−:\-]\s*(.+?)\s*$/u;

export function parseVocabularyText(raw: string): ParseResult {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let title = "Arbeitsbuch Wörter";
  const items: VocabItem[] = [];
  let skipped = 0;
  let sawNumbered = false;

  for (const line of lines) {
    const match = line.match(LINE_RE);
    if (!match) {
      if (!sawNumbered && items.length === 0) {
        title = line;
      } else {
        skipped += 1;
      }
      continue;
    }

    sawNumbered = true;
    const id = Number(match[1]);
    const de = match[2].trim();
    const fa = match[3].trim();
    if (!de || !fa || Number.isNaN(id)) {
      skipped += 1;
      continue;
    }
    items.push({ id, de, fa });
  }

  // If uploaded list reuses ids poorly, normalize sequential ids for quiz keys
  const normalized = items.map((item, index) => ({
    ...item,
    id: item.id || index + 1,
  }));

  // Ensure unique ids (duplicates like erreichen twice stay as separate entries)
  const used = new Set<number>();
  const unique = normalized.map((item, index) => {
    let id = item.id;
    if (used.has(id)) {
      id = Math.max(...used, index + 1) + 1;
    }
    used.add(id);
    return { ...item, id };
  });

  return { title, items: unique, skipped };
}

export function serializeVocabulary(title: string, items: VocabItem[]): string {
  const body = items.map((item, i) => `${i + 1}. ${item.de} — ${item.fa}`).join("\n");
  return `${title}\n\n${body}\n`;
}
