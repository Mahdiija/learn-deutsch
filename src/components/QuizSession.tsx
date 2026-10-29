"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VOCABULARY, formatVocabLine, type VocabItem } from "@/data/vocabulary";
import { parseVocabularyText, serializeVocabulary } from "@/lib/parseVocabulary";
import {
  REASK_CORRECT_CHANCE,
  answerOf,
  buildOptions,
  buildSessionQueue,
  getWordById,
  insertRandomly,
  promptOf,
  type QuizDirection,
} from "@/lib/quiz";
import { clearDeck, loadDeck, saveDeck } from "@/lib/storage";

type Phase = "home" | "quiz" | "done";

type Feedback = {
  kind: "correct" | "wrong" | "reask";
  line: string;
};

type SessionSize = "all" | 10 | 20 | 30;

export default function QuizSession() {
  const [phase, setPhase] = useState<Phase>("home");
  const [title, setTitle] = useState("Arbeitsbuch Wörter");
  const [words, setWords] = useState<VocabItem[]>(VOCABULARY);
  const [activeWords, setActiveWords] = useState<VocabItem[]>(VOCABULARY);
  const [pasteText, setPasteText] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [direction, setDirection] = useState<QuizDirection>("de-fa");
  const [sessionSize, setSessionSize] = useState<SessionSize>("all");
  const [hydrated, setHydrated] = useState(false);

  const [queue, setQueue] = useState<number[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [asked, setAsked] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [learnedLines, setLearnedLines] = useState<string[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [missedIds, setMissedIds] = useState<number[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const pickRef = useRef<(choice: string) => void>(() => {});
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const deck = loadDeck();
    setTitle(deck.title);
    setWords(deck.items);
    setHydrated(true);
  }, []);

  const current = useMemo(
    () =>
      currentId == null ? null : getWordById(activeWords, currentId) ?? null,
    [currentId, activeWords],
  );

  const remaining = queue.length + (currentId != null && !answered ? 1 : 0);
  const progressDone = Math.max(0, sessionTotal - remaining);
  const progressPct =
    sessionTotal > 0 ? Math.min(100, Math.round((progressDone / sessionTotal) * 100)) : 0;

  const applyImport = useCallback((raw: string) => {
    const result = parseVocabularyText(raw);
    if (result.items.length === 0) {
      setImportError(
        "هیچ واژه‌ای پیدا نشد. هر خط باید شبیه این باشد:\n1. die Vorlesung — معنی فارسی",
      );
      setImportMsg(null);
      return;
    }
    setWords(result.items);
    setTitle(result.title);
    saveDeck(result.title, result.items);
    setPasteText(raw);
    setImportError(null);
    setImportMsg(
      `${result.items.length} واژه بارگذاری شد` +
        (result.skipped ? ` · ${result.skipped} خط رد شد` : ""),
    );
  }, []);

  function onFileChange(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      applyImport(String(reader.result ?? ""));
    };
    reader.onerror = () => {
      setImportError("خواندن فایل ناموفق بود.");
    };
    reader.readAsText(file, "UTF-8");
  }

  function resetToDefault() {
    clearDeck();
    setWords(VOCABULARY);
    setTitle("Arbeitsbuch Wörter");
    setPasteText("");
    setImportMsg("لیست پیش‌فرض بارگذاری شد.");
    setImportError(null);
  }

  function downloadCurrent() {
    const text = serializeVocabulary(title, words);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_") || "woerter"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function present(
    id: number,
    nextQueue: number[],
    list: VocabItem[],
    dir: QuizDirection,
  ) {
    const word = getWordById(list, id);
    if (!word) return;
    setCurrentId(id);
    setQueue(nextQueue);
    setOptions(buildOptions(word, list, dir));
    setAnswered(false);
    setSelected(null);
    setFeedback(null);
    setAsked((n) => n + 1);
  }

  function startSession(focusMissed = false) {
    const source =
      focusMissed && missedIds.length > 0
        ? words.filter((w) => missedIds.includes(w.id))
        : words;

    if (source.length === 0) {
      setImportError("لیست واژه خالی است. اول متن را آپلود یا پیست کن.");
      return;
    }

    const limit =
      focusMissed || sessionSize === "all" ? undefined : sessionSize;
    const q = buildSessionQueue(source, limit);
    const [first, ...rest] = q;
    setActiveWords(source);
    setCorrectCount(0);
    setWrongCount(0);
    setLearnedLines([]);
    setAsked(0);
    setMissedIds([]);
    setSessionTotal(q.length);
    setPhase("quiz");
    present(first, rest, source, direction);
  }

  function goNext(nextQueue: number[]) {
    if (nextQueue.length === 0) {
      setCurrentId(null);
      setPhase("done");
      return;
    }
    const [first, ...rest] = nextQueue;
    present(first, rest, activeWords, direction);
  }

  function onPick(choice: string) {
    if (!current || answered) return;

    setSelected(choice);
    setAnswered(true);

    const line = formatVocabLine(current);
    const isCorrect = choice === answerOf(current, direction);

    if (!isCorrect) {
      setWrongCount((n) => n + 1);
      setMissedIds((prev) =>
        prev.includes(current.id) ? prev : [...prev, current.id],
      );
      setFeedback({ kind: "wrong", line });
      return;
    }

    setCorrectCount((n) => n + 1);
    setLearnedLines((prev) => (prev.includes(line) ? prev : [...prev, line]));

    const shouldReask = Math.random() < REASK_CORRECT_CHANCE;
    setFeedback({ kind: shouldReask ? "reask" : "correct", line });
  }

  pickRef.current = onPick;

  function continueAfterAnswer() {
    if (!current || !feedback) return;

    if (feedback.kind === "wrong" || feedback.kind === "reask") {
      goNext(insertRandomly(queue, current.id));
      return;
    }
    goNext(queue);
  }

  useEffect(() => {
    if (phase !== "quiz") return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && answered) {
        e.preventDefault();
        nextBtnRef.current?.click();
        return;
      }
      if (answered) return;
      const num = Number(e.key);
      if (num >= 1 && num <= options.length) {
        e.preventDefault();
        pickRef.current(options[num - 1]);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, answered, options]);

  if (!hydrated) {
    return (
      <div className="mx-auto px-4 py-16 text-center text-ink/60" dir="rtl">
        در حال بارگذاری…
      </div>
    );
  }

  if (phase === "home") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 py-10" dir="rtl">
        <header className="space-y-3 text-center">
          <p className="text-sm tracking-wide text-ink/60" dir="ltr">
            {title}
          </p>
          <h1 className="text-3xl font-bold text-ink">تمرین واژه‌های آلمانی</h1>
          <p className="text-base leading-8 text-ink/70">
            لیست را با همان قالب آپلود یا پیست کن، بعد جلسه را شروع کن. ترتیب
            تصادفی است؛ اشتباه‌ها دوباره می‌آیند و گاهی جواب درست هم تکرار می‌شود.
          </p>
        </header>

        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-ink">بارگذاری لیست</h2>
          <p className="text-sm leading-7 text-ink/65">
            قالب هر خط:{" "}
            <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs" dir="ltr">
              1. die Vorlesung — معنی فارسی
            </code>
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onFileChange(file);
            }}
            className={`rounded-xl border border-dashed px-4 py-6 text-center text-sm transition ${
              dragOver
                ? "border-accent bg-accent/5 text-accent"
                : "border-ink/20 bg-paper text-ink/55"
            }`}
          >
            فایل .txt را اینجا رها کن یا از دکمهٔ آپلود استفاده کن
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
            >
              آپلود فایل .txt
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => applyImport(pasteText)}
              className="rounded-lg border border-ink/15 bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-white"
            >
              اعمال متن پیست‌شده
            </button>
            <button
              type="button"
              onClick={downloadCurrent}
              className="rounded-lg border border-ink/15 bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-white"
            >
              دانلود لیست فعلی
            </button>
            <button
              type="button"
              onClick={resetToDefault}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm text-ink/70 hover:bg-white"
            >
              بازگشت به پیش‌فرض
            </button>
          </div>

          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={`Arbeitsbuch Wörter\n\n1. die Vorlesung — جلسهٔ درس دانشگاهی، سخنرانی آموزشی\n2. verfügbar — در دسترس، موجود`}
            rows={7}
            className="w-full resize-y rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm leading-7 text-ink outline-none focus:border-accent"
            dir="ltr"
          />

          {importMsg && (
            <p className="text-sm text-green-800 bg-green-50 rounded-lg px-3 py-2">
              {importMsg}
            </p>
          )}
          {importError && (
            <p className="whitespace-pre-line text-sm text-red-800 bg-red-50 rounded-lg px-3 py-2">
              {importError}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white/80 p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold">تنظیمات جلسه</h2>

          <div className="space-y-2">
            <p className="text-sm text-ink/60">جهت سؤال</p>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                active={direction === "de-fa"}
                onClick={() => setDirection("de-fa")}
                label="آلمانی → فارسی"
              />
              <ToggleChip
                active={direction === "fa-de"}
                onClick={() => setDirection("fa-de")}
                label="فارسی → آلمانی"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-ink/60">تعداد سؤال در این جلسه</p>
            <div className="flex flex-wrap gap-2">
              {(["all", 10, 20, 30] as const).map((size) => (
                <ToggleChip
                  key={String(size)}
                  active={sessionSize === size}
                  onClick={() => setSessionSize(size)}
                  label={size === "all" ? `همه (${words.length})` : String(size)}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => startSession(false)}
            className="w-full rounded-xl bg-accent px-8 py-3 text-lg font-semibold text-white shadow-sm transition hover:bg-accent-dark"
          >
            شروع جلسه · {words.length} واژه
          </button>
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white/70 p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-ink" dir="ltr">
            {title}
          </h2>
          <ol className="max-h-[360px] space-y-2 overflow-y-auto text-sm leading-7 text-ink/85">
            {words.map((item, index) => (
              <li key={`${item.id}-${index}`} dir="ltr" className="text-left">
                <span className="font-medium text-ink">
                  {index + 1}. {item.de}
                </span>
                <span className="text-ink/50"> — </span>
                <span dir="rtl" className="inline text-right">
                  {item.fa}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  if (phase === "done") {
    const accuracy =
      correctCount + wrongCount > 0
        ? Math.round((correctCount / (correctCount + wrongCount)) * 100)
        : 0;

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10" dir="rtl">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-ink">جلسه تمام شد</h1>
          <p className="text-ink/70">
            {asked} سؤال · {correctCount} درست · {wrongCount} اشتباه · دقت {accuracy}%
          </p>
        </header>

        <section className="rounded-2xl border border-ink/10 bg-white/70 p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold" dir="ltr">
            {title}
          </h2>
          <div className="space-y-2 text-sm leading-7" dir="ltr">
            {learnedLines.length === 0 ? (
              <p className="text-ink/60" dir="rtl">
                هنوز خطی ثبت نشده.
              </p>
            ) : (
              learnedLines.map((line) => (
                <p key={line} className="text-left text-ink/90">
                  {line}
                </p>
              ))
            )}
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          {missedIds.length > 0 && (
            <button
              type="button"
              onClick={() => startSession(true)}
              className="rounded-xl border border-amber-400 bg-amber-50 px-6 py-3 font-semibold text-amber-950"
            >
              فقط اشتباه‌ها ({missedIds.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => startSession(false)}
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-dark"
          >
            جلسهٔ جدید
          </button>
          <button
            type="button"
            onClick={() => setPhase("home")}
            className="rounded-xl border border-ink/15 px-6 py-3 font-semibold text-ink"
          >
            بازگشت به خانه
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-10" dir="rtl">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-ink/60">
          <span>
            سؤال {asked} · باقی‌مانده حدود {remaining}
          </span>
          <span>
            ✓ {correctCount} · ✗ {wrongCount}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => setPhase("home")}
          className="text-xs text-ink/45 hover:text-ink"
        >
          پایان زودهنگام و بازگشت
        </button>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/80 p-6 shadow-sm">
        <p className="mb-2 text-xs tracking-wider text-ink/45" dir="ltr">
          {title}
        </p>
        <p className="mb-1 text-sm text-ink/55">
          {direction === "de-fa" ? "معنی این واژه چیست؟" : "معادل آلمانی چیست؟"}
        </p>
        <h2
          className={`mb-6 text-3xl font-bold tracking-tight text-ink ${
            direction === "de-fa" ? "" : ""
          }`}
          dir={direction === "de-fa" ? "ltr" : "rtl"}
        >
          {current ? promptOf(current, direction) : ""}
        </h2>

        <div className="flex flex-col gap-3">
          {options.map((opt, idx) => {
            const isChosen = selected === opt;
            const correct = current ? answerOf(current, direction) : "";
            const isRight = answered && opt === correct;
            const isWrongPick = answered && isChosen && opt !== correct;

            let style =
              "border-ink/15 bg-paper hover:border-accent/40 hover:bg-accent/5";
            if (isRight) style = "border-green-600 bg-green-50 text-green-900";
            if (isWrongPick) style = "border-red-500 bg-red-50 text-red-900";
            if (answered && !isRight && !isWrongPick)
              style = "border-ink/10 bg-paper/60 opacity-60";

            return (
              <button
                key={`${idx}-${opt}`}
                type="button"
                disabled={answered}
                onClick={() => onPick(opt)}
                className={`rounded-xl border px-4 py-3 text-base leading-7 transition ${style} ${
                  direction === "fa-de" ? "text-left" : "text-right"
                }`}
                dir={direction === "fa-de" ? "ltr" : "rtl"}
              >
                <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-ink/5 text-xs text-ink/45">
                  {idx + 1}
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-ink/40">کلید ۱–۴ برای انتخاب · Enter برای بعدی</p>

        {feedback && (
          <div
            className={`mt-5 rounded-xl px-4 py-3 text-sm leading-7 ${
              feedback.kind === "wrong"
                ? "bg-red-50 text-red-900"
                : feedback.kind === "reask"
                  ? "bg-amber-50 text-amber-950"
                  : "bg-green-50 text-green-900"
            }`}
          >
            {feedback.kind === "wrong" && (
              <p className="mb-2 font-semibold">اشتباه — دوباره می‌پرسیم.</p>
            )}
            {feedback.kind === "correct" && (
              <p className="mb-2 font-semibold">درست!</p>
            )}
            {feedback.kind === "reask" && (
              <p className="mb-2 font-semibold">
                درست بود — ولی کمی بعد دوباره می‌آید.
              </p>
            )}
            <p dir="ltr" className="text-left font-medium">
              {feedback.line}
            </p>
            <button
              ref={nextBtnRef}
              type="button"
              onClick={continueAfterAnswer}
              className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              بعدی
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-accent text-white"
          : "border border-ink/15 bg-paper text-ink/75 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
