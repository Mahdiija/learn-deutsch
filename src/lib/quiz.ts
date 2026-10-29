import type { VocabItem } from "@/data/vocabulary";

export type QuizDirection = "de-fa" | "fa-de";

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildSessionQueue(
  words: VocabItem[],
  limit?: number,
): number[] {
  const ids = shuffle(words.map((w) => w.id));
  if (limit && limit > 0 && limit < ids.length) {
    return ids.slice(0, limit);
  }
  return ids;
}

/** Chance to ask a correctly answered word again later in the session. */
export const REASK_CORRECT_CHANCE = 0.28;

export function insertRandomly(queue: number[], id: number): number[] {
  if (queue.length === 0) return [id];
  const next = [...queue];
  // Prefer not putting it immediately next — at least a bit later when possible
  const minIndex = next.length >= 3 ? 1 : 0;
  const index =
    minIndex + Math.floor(Math.random() * (next.length - minIndex + 1));
  next.splice(index, 0, id);
  return next;
}

export function buildOptions(
  correct: VocabItem,
  all: VocabItem[],
  direction: QuizDirection,
  count = 4,
): string[] {
  const correctAnswer = direction === "de-fa" ? correct.fa : correct.de;
  const pickField = direction === "de-fa" ? "fa" : "de";

  const distractors = shuffle(
    all.filter(
      (w) => w.id !== correct.id && w[pickField] !== correct[pickField],
    ),
  )
    .slice(0, Math.max(0, count - 1))
    .map((w) => w[pickField]);

  return shuffle([correctAnswer, ...distractors]);
}

export function getWordById(
  words: VocabItem[],
  id: number,
): VocabItem | undefined {
  return words.find((w) => w.id === id);
}

export function answerOf(word: VocabItem, direction: QuizDirection): string {
  return direction === "de-fa" ? word.fa : word.de;
}

export function promptOf(word: VocabItem, direction: QuizDirection): string {
  return direction === "de-fa" ? word.de : word.fa;
}
