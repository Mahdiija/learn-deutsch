import { VOCABULARY, type VocabItem } from "@/data/vocabulary";
import type { QuizDirection } from "@/lib/quiz";

const DECK_KEY = "arbeitsbuch-vocab-v1";
const SETTINGS_KEY = "arbeitsbuch-settings-v1";
const ACTIVE_KEY = "arbeitsbuch-active-session-v1";
const HISTORY_KEY = "arbeitsbuch-history-v1";

const MAX_HISTORY = 40;

export type StoredDeck = {
  title: string;
  items: VocabItem[];
  pasteText?: string;
  updatedAt: number;
};

export type StoredSettings = {
  direction: QuizDirection;
  sessionSize: "all" | 10 | 20 | 30;
};

export type FeedbackSnapshot = {
  kind: "correct" | "wrong" | "reask";
  line: string;
};

export type ActiveSession = {
  id: string;
  title: string;
  direction: QuizDirection;
  activeWords: VocabItem[];
  queue: number[];
  currentId: number | null;
  options: string[];
  answered: boolean;
  selected: string | null;
  feedback: FeedbackSnapshot | null;
  asked: number;
  correctCount: number;
  wrongCount: number;
  learnedLines: string[];
  sessionTotal: number;
  missedIds: number[];
  phase: "quiz" | "done";
  updatedAt: number;
};

export type HistoryEntry = {
  id: string;
  title: string;
  direction: QuizDirection;
  words: VocabItem[];
  asked: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  learnedLines: string[];
  missedIds: number[];
  finishedAt: number;
  completed: boolean;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadDeck(): StoredDeck {
  const parsed = readJson<StoredDeck>(DECK_KEY);
  if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    return { title: "Arbeitsbuch Wörter", items: VOCABULARY, updatedAt: 0 };
  }
  return {
    title: parsed.title || "Arbeitsbuch Wörter",
    items: parsed.items,
    pasteText: parsed.pasteText ?? "",
    updatedAt: parsed.updatedAt || 0,
  };
}

export function saveDeck(
  title: string,
  items: VocabItem[],
  pasteText?: string,
): void {
  const prev = readJson<StoredDeck>(DECK_KEY);
  writeJson(DECK_KEY, {
    title,
    items,
    pasteText: pasteText ?? prev?.pasteText ?? "",
    updatedAt: Date.now(),
  } satisfies StoredDeck);
}

export function clearDeck(): void {
  localStorage.removeItem(DECK_KEY);
}

export function loadSettings(): StoredSettings {
  const parsed = readJson<StoredSettings>(SETTINGS_KEY);
  return {
    direction: parsed?.direction === "fa-de" ? "fa-de" : "de-fa",
    sessionSize:
      parsed?.sessionSize === 10 ||
      parsed?.sessionSize === 20 ||
      parsed?.sessionSize === 30
        ? parsed.sessionSize
        : "all",
  };
}

export function saveSettings(settings: StoredSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function loadActiveSession(): ActiveSession | null {
  const parsed = readJson<ActiveSession>(ACTIVE_KEY);
  if (!parsed || !Array.isArray(parsed.activeWords) || !parsed.id) return null;
  if (parsed.phase !== "quiz" && parsed.phase !== "done") return null;
  return parsed;
}

export function saveActiveSession(session: ActiveSession): void {
  writeJson(ACTIVE_KEY, { ...session, updatedAt: Date.now() });
}

export function clearActiveSession(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

export function loadHistory(): HistoryEntry[] {
  const parsed = readJson<HistoryEntry[]>(HISTORY_KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((e) => e && e.id && Array.isArray(e.words));
}

export function saveHistory(entries: HistoryEntry[]): void {
  writeJson(HISTORY_KEY, entries.slice(0, MAX_HISTORY));
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  saveHistory(next);
  return next;
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatHistoryDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}
