import { VOCABULARY, type VocabItem } from "@/data/vocabulary";

const KEY = "arbeitsbuch-vocab-v1";

export type StoredDeck = {
  title: string;
  items: VocabItem[];
  updatedAt: number;
};

export function loadDeck(): StoredDeck {
  if (typeof window === "undefined") {
    return { title: "Arbeitsbuch Wörter", items: VOCABULARY, updatedAt: 0 };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return { title: "Arbeitsbuch Wörter", items: VOCABULARY, updatedAt: 0 };
    }
    const parsed = JSON.parse(raw) as StoredDeck;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return { title: "Arbeitsbuch Wörter", items: VOCABULARY, updatedAt: 0 };
    }
    return {
      title: parsed.title || "Arbeitsbuch Wörter",
      items: parsed.items,
      updatedAt: parsed.updatedAt || 0,
    };
  } catch {
    return { title: "Arbeitsbuch Wörter", items: VOCABULARY, updatedAt: 0 };
  }
}

export function saveDeck(title: string, items: VocabItem[]): void {
  const payload: StoredDeck = { title, items, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearDeck(): void {
  localStorage.removeItem(KEY);
}
