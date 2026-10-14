"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Bookmark, BookOpen, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Globe2, GraduationCap,
  Library, LoaderCircle, Newspaper,
  NotebookPen, RefreshCw, Search, ShieldAlert,
} from "lucide-react";
import { flashcards, getDailyStudySet, glossary, lessons, quizQuestions } from "@/app/lib/learning";
import type { NewsArticle, NewsResponse } from "@/app/lib/types";

type View = "news" | "briefing" | "learn" | "tools" | "saved";

const navItems: { id: View; label: string; icon: typeof Newspaper }[] = [
  { id: "news", label: "World news", icon: Newspaper },
  { id: "briefing", label: "Daily briefing", icon: Globe2 },
  { id: "learn", label: "Learning center", icon: BookOpen },
  { id: "tools", label: "Study tools", icon: Library },
];

const timeAgo = (date: string) => {
  const age = Math.max(0, Date.now() - new Date(date).getTime());
  if (!Number.isFinite(age)) return "Time unavailable";
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const lensFor = (article: NewsArticle) => {
  if (article.topics.includes("Conflict") || article.topics.includes("Security")) return "Realism · security dilemma";
  if (article.topics.includes("Diplomacy")) return "Liberalism · English School";
  if (article.topics.includes("Governance")) return "Constructivism · legitimacy";
  if (article.topics.includes("Climate")) return "Liberalism · collective action";
  return "Constructivism · interdependence";
};

const briefingScore = (article: NewsArticle) => {
  const topicWeight = article.topics.reduce((score, item) => score + ({ Conflict: 5, Security: 4, Diplomacy: 3, Governance: 2, Climate: 2 }[item] || 1), 0);
  const ageHours = (Date.now() - Date.parse(article.publishedAt)) / 3600000;
  const freshness = Number.isFinite(ageHours) && ageHours >= 0 && ageHours < 48 ? (48 - ageHours) / 48 : 0;
  return topicWeight + freshness;
};

function MarkdownText({ text }: { text: string }) {
  return <div className="prose-ai whitespace-pre-wrap text-sm text-paper/85">{text}</div>;
}

function StatusBadge({ status }: { status: NewsArticle["status"] }) {
  const styles = status === "Allegation" ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
    : status === "Official statement" ? "border-sky-300/25 bg-sky-300/10 text-sky-200"
      : status === "Developing report" ? "border-orange-300/25 bg-orange-300/10 text-orange-200"
        : "border-white/10 bg-white/[0.04] text-muted";
  return <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${styles}`}>
    {status === "Allegation" && <ShieldAlert size={11} />}{status}
  </span>;
}

function ArticleCard({ article, saved, onSave }: {
  article: NewsArticle; saved: boolean; onSave: () => void;
}) {
  return <article className="group flex min-h-[258px] flex-col border border-line bg-[#18211f]/85 p-5 transition-colors hover:border-[#627a68] sm:p-6">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] text-muted">
      <span className="font-semibold text-paper/80">{article.source}</span><span className="text-line">/</span>
      <span>{article.region} · {article.country}</span><span className="text-line">/</span><span>{timeAgo(article.publishedAt)}</span>
      <span className="ml-auto"><StatusBadge status={article.status} /></span>
    </div>
    <a href={article.url} target="_blank" rel="noreferrer" className="mt-5 text-[18px] font-semibold leading-[1.35] text-paper decoration-mint/50 underline-offset-4 group-hover:underline sm:text-[20px]">
      {article.title}
    </a>
    <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-6 text-muted">{article.summary}</p>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div className="flex flex-wrap gap-1.5">{article.topics.map((topic) => <span key={topic} className="rounded-sm bg-white/[0.045] px-2 py-1 text-[10px] text-muted">{topic}</span>)}</div>
      <div className="flex items-center gap-2">
        <button onClick={onSave} title={saved ? "Remove saved article" : "Save article"} aria-label={saved ? "Remove saved article" : "Save article"} className={`grid h-8 w-8 place-items-center border transition-colors ${saved ? "border-mint/40 text-mint" : "border-line text-muted hover:text-paper"}`}><Bookmark size={14} fill={saved ? "currentColor" : "none"} /></button>
      </div>
    </div>
  </article>;
}

function SectionHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="mb-8 border-b border-line pb-6 sm:mb-9">
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-mint">{eyebrow}</p>
    <h1 className="font-display text-[34px] leading-tight text-paper sm:text-[42px]">{title}</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{detail}</p>
  </div>;
}

export default function Home() {
  const [view, setView] = useState<View>("news");
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [newsError, setNewsError] = useState("");
  const [loadingNews, setLoadingNews] = useState(true);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All regions");
  const [countryFilter, setCountryFilter] = useState("All countries");
  const [topic, setTopic] = useState("All topics");
  const [saved, setSaved] = useState<NewsArticle[]>([]);
  const [expandedLesson, setExpandedLesson] = useState<string | null>("Realism");
  const [lessonSearch, setLessonSearch] = useState("");
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [notes, setNotes] = useState("");
  const [customGlossary, setCustomGlossary] = useState<{ term: string; definition: string; category: string }[]>([]);
  const [customFlashcards, setCustomFlashcards] = useState<{ front: string; back: string }[]>([]);
  const [customQuizQuestions, setCustomQuizQuestions] = useState<{ question: string; options: string[]; answer: number; explanation: string }[]>([]);
  const [glossaryForm, setGlossaryForm] = useState({ term: "", definition: "", category: "User note" });
  const [flashForm, setFlashForm] = useState({ front: "", back: "" });
  const [quizForm, setQuizForm] = useState({ question: "", options: ["", "", "", ""], answer: 0, explanation: "" });
  const studyDateKey = new Date().toISOString().slice(0, 10);

  const allGlossary = useMemo(() => [...glossary, ...customGlossary], [customGlossary]);
  const dailyFlashcards = useMemo(() => getDailyStudySet([...flashcards, ...customFlashcards], studyDateKey, 20), [customFlashcards]);
  const dailyQuizQuestions = useMemo(() => getDailyStudySet([...quizQuestions, ...customQuizQuestions], studyDateKey, 20), [customQuizQuestions]);

  async function refreshNews() {
    setLoadingNews(true);
    setNewsError("");
    try {
      const response = await fetch("/api/news", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The news feed could not be loaded.");
      setNews(data as NewsResponse);
    } catch (error) {
      setNewsError(error instanceof Error ? error.message : "The news feed could not be loaded.");
    } finally {
      setLoadingNews(false);
    }
  }

  useEffect(() => {
    try {
      const storedArticles: unknown = JSON.parse(localStorage.getItem("gaa-saved") || "[]");
      setSaved(Array.isArray(storedArticles) ? storedArticles.filter((article): article is NewsArticle => typeof article?.url === "string" && typeof article?.title === "string") : []);
      setNotes(localStorage.getItem("gaa-notes") || "");

      const storedGlossary: unknown = JSON.parse(localStorage.getItem("gaa-custom-glossary") || "[]");
      const storedFlashcards: unknown = JSON.parse(localStorage.getItem("gaa-custom-flashcards") || "[]");
      const storedQuiz: unknown = JSON.parse(localStorage.getItem("gaa-custom-quizzes") || "[]");

      setCustomGlossary(Array.isArray(storedGlossary) ? storedGlossary.filter((entry): entry is { term: string; definition: string; category: string } => typeof entry?.term === "string" && typeof entry?.definition === "string") : []);
      setCustomFlashcards(Array.isArray(storedFlashcards) ? storedFlashcards.filter((card): card is { front: string; back: string } => typeof card?.front === "string" && typeof card?.back === "string") : []);
      setCustomQuizQuestions(Array.isArray(storedQuiz) ? storedQuiz.filter((item): item is { question: string; options: string[]; answer: number; explanation: string } => typeof item?.question === "string" && Array.isArray(item?.options) && typeof item?.answer === "number" && typeof item?.explanation === "string") : []);
    } catch { setSaved([]); }
    void refreshNews();
  }, []);

  useEffect(() => {
    if (dailyFlashcards.length === 0) return;
    setFlashIndex((current) => Math.min(current, dailyFlashcards.length - 1));
  }, [dailyFlashcards.length]);

  useEffect(() => {
    if (dailyQuizQuestions.length === 0) return;
    setQuizIndex((current) => Math.min(current, dailyQuizQuestions.length - 1));
  }, [dailyQuizQuestions.length]);

  function handleAddGlossaryTerm() {
    const term = glossaryForm.term.trim();
    const definition = glossaryForm.definition.trim();
    if (!term || !definition) return;
    const next = [...customGlossary, { term, definition, category: glossaryForm.category || "User term" }];
    setCustomGlossary(next);
    localStorage.setItem("gaa-custom-glossary", JSON.stringify(next));
    setGlossaryForm({ term: "", definition: "", category: "User note" });
  }

  function handleAddFlashcard() {
    const front = flashForm.front.trim();
    const back = flashForm.back.trim();
    if (!front || !back) return;
    const next = [...customFlashcards, { front, back }];
    setCustomFlashcards(next);
    localStorage.setItem("gaa-custom-flashcards", JSON.stringify(next));
    setFlashForm({ front: "", back: "" });
    setFlashIndex(0);
    setFlashFlipped(false);
  }

  function handleAddQuizQuestion() {
    const question = quizForm.question.trim();
    const options = quizForm.options.map((option) => option.trim()).filter(Boolean);
    const explanation = quizForm.explanation.trim();
    if (!question || options.length < 2 || !explanation) return;
    const normalizedOptions = [...options.slice(0, 4)];
    while (normalizedOptions.length < 4) normalizedOptions.push(`Option ${normalizedOptions.length + 1}`);
    const answer = Math.min(quizForm.answer, normalizedOptions.length - 1);
    const next = [...customQuizQuestions, { question, options: normalizedOptions, answer, explanation }];
    setCustomQuizQuestions(next);
    localStorage.setItem("gaa-custom-quizzes", JSON.stringify(next));
    setQuizForm({ question: "", options: ["", "", "", ""], answer: 0, explanation: "" });
    setQuizIndex(0);
    setQuizChoice(null);
  }

  function toggleSaved(article: NewsArticle) {
    setSaved((current) => {
      const next = current.some((item) => item.url === article.url) ? current.filter((item) => item.url !== article.url) : [article, ...current];
      localStorage.setItem("gaa-saved", JSON.stringify(next));
      return next;
    });
  }

  const articles = news?.articles || [];
  const filteredArticles = articles.filter((article) => {
    const matchesRegion = region === "All regions" || article.region === region;
    const matchesCountry = countryFilter === "All countries" || article.country === countryFilter;
    const matchesTopic = topic === "All topics" || article.topics.includes(topic);
    const words = `${article.title} ${article.summary} ${article.source} ${article.region} ${article.country} ${article.topics.join(" ")}`.toLowerCase();
    return matchesRegion && matchesCountry && matchesTopic && words.includes(search.toLowerCase());
  });
  const savedArticles = saved;
  const regions = ["All regions", ...new Set(articles.map((article) => article.region))];
  const countries = ["All countries", ...new Set(articles.map((article) => article.country))];
  const topics = ["All topics", ...new Set(articles.flatMap((article) => article.topics))];

  const titleMap: Record<View, string> = {
    news: "World news", briefing: "The daily briefing", learn: "Learning center", tools: "Study tools", saved: "Saved reading",
  };

  function renderArticleList(list: NewsArticle[]) {
    if (loadingNews) return <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-muted"><LoaderCircle className="animate-spin" size={18} /> Gathering live reporting…</div>;
    if (newsError && !news) return <div className="border border-line bg-panel px-6 py-8 text-center"><CircleHelp className="mx-auto text-muted" size={22} /><p className="mt-3 text-paper">Live reporting is temporarily unavailable</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{newsError} No sample headlines are shown. Check your connection and retry.</p><button onClick={() => void refreshNews()} className="mt-5 inline-flex items-center gap-2 border border-line px-4 py-2 text-xs hover:border-mint/50"><RefreshCw size={13} /> Try again</button></div>;
    if (list.length === 0) return <div className="border border-dashed border-line px-6 py-10 text-center text-sm text-muted">{newsError ? "No live articles are available right now." : "No stories match these filters."}</div>;
    return <div className="grid gap-4 xl:grid-cols-2">{list.map((article) => <ArticleCard key={article.url} article={article} saved={saved.some((item) => item.url === article.url)} onSave={() => toggleSaved(article)} />)}</div>;
  }

  function renderMain() {
    if (view === "news") return <>
      <section className="relative mb-8 overflow-hidden border border-line bg-[#18211f]/70 px-6 py-7 sm:px-9 sm:py-9">
        <div className="absolute right-7 top-1/2 hidden -translate-y-1/2 text-[#2c3c34] md:block"><Globe2 size={126} strokeWidth={0.65} /></div>
        <div className="relative max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-mint"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> World affairs / live desk</p>
          <h1 className="mt-4 max-w-xl font-display text-[34px] leading-[1.08] sm:text-[43px]">Understand what moves<br className="hidden sm:block" /> the world.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">Current international reporting, organized for the curious mind. Follow the story, then look at it through an IR lens.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 border border-line bg-ink/50 px-3 py-2 text-[11px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> {news?.sources.length || 0} live publishers</span>
            <span className="text-[11px] text-muted">{news ? `${articles.length} stories · updated ${timeAgo(news.fetchedAt)}` : "Connecting to live reporting"}</span>
          </div>
        </div>
      </section>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-base font-semibold">Latest reporting</h2><p className="mt-1 text-xs text-muted">Publisher-provided reporting. Country/topic tags are keyword-based; status labels are headline signals, not independent verification.</p></div>
        <button onClick={() => void refreshNews()} disabled={loadingNews} className="inline-flex h-9 items-center justify-center gap-2 self-start border border-line px-3 text-xs text-muted transition-colors hover:border-mint/50 hover:text-paper disabled:opacity-50"><RefreshCw size={13} className={loadingNews ? "animate-spin" : ""} /> Refresh</button>
      </div>
      <div className="mb-5 grid gap-2 sm:grid-cols-[minmax(190px,1fr)_repeat(3,minmax(0,auto))]">
        <label className="flex h-10 items-center gap-2 border border-line bg-panel px-3 text-muted"><Search size={14} /><input aria-label="Search news" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search headlines, places, topics" className="w-full bg-transparent text-xs text-paper outline-none placeholder:text-muted/70" /></label>
        <label className="relative flex h-10 items-center border border-line bg-panel px-3 text-xs text-muted"><select aria-label="Filter by region" value={region} onChange={(event) => setRegion(event.target.value)} className="w-full appearance-none bg-transparent pr-5 text-paper outline-none">{regions.map((item) => <option className="bg-panel" key={item}>{item}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3" /></label>
        <label className="relative flex h-10 items-center border border-line bg-panel px-3 text-xs text-muted"><select aria-label="Filter by country" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} className="w-full appearance-none bg-transparent pr-5 text-paper outline-none">{countries.map((item) => <option className="bg-panel" key={item}>{item}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3" /></label>
        <label className="relative flex h-10 items-center border border-line bg-panel px-3 text-xs text-muted"><select aria-label="Filter by topic" value={topic} onChange={(event) => setTopic(event.target.value)} className="w-full appearance-none bg-transparent pr-5 text-paper outline-none">{topics.map((item) => <option className="bg-panel" key={item}>{item}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-3" /></label>
      </div>
      {news?.errors.length ? <p className="mb-4 border-l-2 border-amber-300/60 pl-3 text-xs leading-5 text-muted">Partial feed: {news.errors.join(" ")}</p> : null}
      {renderArticleList(filteredArticles)}
    </>;

    if (view === "briefing") {
      const top = [...articles].sort((left, right) => briefingScore(right) - briefingScore(left)).slice(0, 5);
      return <><SectionHeading eyebrow="A current affairs study note" title="The daily briefing" detail="Five high-signal stories from live publisher feeds, prioritized by conflict, security, diplomacy, and governance topics, with freshness as a tie-breaker. This transparent feed ranking is not independent editorial verification." />
        {newsError && !news ? <div className="border border-line p-6 text-sm text-muted">{newsError} A briefing requires live reporting, so no sample stories are substituted.</div> : loadingNews ? <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted"><LoaderCircle className="animate-spin" size={18} /> Preparing today's briefing…</div> : !top.length ? <p className="text-sm text-muted">No current stories are available for the briefing.</p> : <>
          <div className="mb-7 grid gap-3 sm:grid-cols-3"><div className="border border-line bg-panel p-4"><p className="text-[10px] uppercase tracking-widest text-muted">Date</p><p className="mt-2 font-display text-xl">{new Date().toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}</p></div><div className="border border-line bg-panel p-4"><p className="text-[10px] uppercase tracking-widest text-muted">Live publishers</p><p className="mt-2 font-display text-xl">{news?.sources.join(" · ") || "Awaiting feeds"}</p></div><div className="border border-line bg-panel p-4"><p className="text-[10px] uppercase tracking-widest text-muted">Update cadence</p><p className="mt-2 font-display text-xl">Every 5 minutes</p></div></div>
          <div className="space-y-3">{top.map((article, index) => <article key={article.url} className="grid gap-4 border border-line bg-panel p-5 md:grid-cols-[40px_1fr] md:p-6"><div className="font-display text-2xl text-mint/70">0{index + 1}</div><div><div className="flex flex-wrap items-center gap-2 text-[11px] text-muted"><span>{article.source}</span><span>/</span><span>{article.region}</span><span>/</span><span>{timeAgo(article.publishedAt)}</span><span className="ml-auto"><StatusBadge status={article.status} /></span></div><a href={article.url} target="_blank" rel="noreferrer" className="mt-3 block text-lg font-semibold leading-snug hover:text-mint">{article.title}</a><p className="mt-2 text-sm leading-6 text-muted">{article.summary}</p><div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-mint">Why it matters</p><p className="mt-1.5 text-xs leading-5 text-muted">A {article.topics.join(" / ").toLowerCase()} story in {article.region}. Track what the publisher reports next, seek independent corroboration, and note which actors have a stake.</p></div><div><p className="text-[10px] font-semibold uppercase tracking-widest text-mint">Theory lens</p><p className="mt-1.5 text-xs leading-5 text-muted">Try {lensFor(article)} as a question to investigate, not as a verdict about the story.</p></div></div></div></article>)}</div>
          <section className="mt-8 border border-line bg-[#18211f]/65 p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">Study questions</p><ol className="mt-4 grid gap-3 text-sm leading-6 text-paper/80 md:grid-cols-3">{["Which detail is a reported fact, and which is an actor's claim?", "How might a realist and a liberal explain the incentives differently?", "What additional source or evidence would change your reading?"] .map((question, index) => <li key={question} className="flex gap-3"><span className="font-display text-lg text-mint">0{index + 1}</span>{question}</li>)}</ol></section>
        </>}
      </>;
    }

    if (view === "learn") {
      const filteredLessons = lessons.filter((lesson) => `${lesson.title} ${lesson.field} ${lesson.group} ${lesson.summary} ${lesson.scholars}`.toLowerCase().includes(lessonSearch.toLowerCase()));
      const lessonFields = [
        { field: "International Relations", detail: "Theories of international systems, foreign policy, security, political economy, and global order." },
        { field: "Political Theory & Political Science", detail: "Political ideologies, normative theories, and approaches for studying institutions and political behavior." },
      ] as const;

      return <><SectionHeading eyebrow="International relations, made legible" title="Learning center" detail="Explore international relations and political thought in separate sections. Entries use plain-language explanations, examples, key scholars, and limitations; the traditions overlap and this guide is designed to grow." />
        <label className="mb-7 flex h-10 max-w-lg items-center gap-2 border border-line bg-panel px-3 text-muted"><Search size={14} /><input aria-label="Search lessons" value={lessonSearch} onChange={(event) => setLessonSearch(event.target.value)} placeholder="Search theories, concepts, scholars" className="w-full bg-transparent text-xs text-paper outline-none placeholder:text-muted/70" /></label>
        <div className="space-y-10">{lessonFields.map(({ field, detail }) => {
          const fieldLessons = filteredLessons.filter((lesson) => lesson.field === field);
          const totalLessons = lessons.filter((lesson) => lesson.field === field).length;

          return <section key={field}>
            <div className="mb-4 border-b border-line pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl text-paper">{field}</h2>
                <span className="text-[11px] text-muted">{fieldLessons.length} / {totalLessons} entries</span>
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-muted">{detail}</p>
            </div>
            {fieldLessons.length ? <div className="space-y-2">{fieldLessons.map((lesson, index) => <article key={`${lesson.field}-${lesson.title}`} className="border border-line bg-panel">
              <button onClick={() => setExpandedLesson(expandedLesson === lesson.title ? null : lesson.title)} aria-expanded={expandedLesson === lesson.title} className="flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5">
                <span className="hidden w-8 font-display text-lg text-mint/60 sm:block">{String(index + 1).padStart(2, "0")}</span>
                <span className="flex-1"><span className="block text-sm font-semibold">{lesson.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted">{lesson.summary}</span></span>
                <span className="border border-line px-2 py-1 text-[9px] uppercase tracking-widest text-muted">{lesson.group}</span>
                <ChevronDown size={15} className={`shrink-0 text-muted transition-transform ${expandedLesson === lesson.title ? "rotate-180" : ""}`} />
              </button>
              {expandedLesson === lesson.title && <div className="grid gap-5 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-[4.5rem]">
                <div className="sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-widest text-mint">Explanation</p><p className="mt-2 text-sm leading-6 text-paper/85">{lesson.summary}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-mint">Example</p><p className="mt-2 text-xs leading-6 text-muted">{lesson.example}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-mint">Key scholars</p><p className="mt-2 text-xs leading-6 text-muted">{lesson.scholars}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-mint">What it helps explain</p><p className="mt-2 text-xs leading-6 text-muted">{lesson.strengths}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-mint">Limitations and debates</p><p className="mt-2 text-xs leading-6 text-muted">{lesson.limits}</p></div>
              </div>}
            </article>)}</div> : <p className="border border-dashed border-line px-4 py-6 text-sm text-muted">No entries in this section match your search.</p>}
          </section>;
        })}</div>
      </>;
    }

    if (view === "tools") {
      const flashSet = dailyFlashcards.length ? dailyFlashcards : flashcards;
      const quizSet = dailyQuizQuestions.length ? dailyQuizQuestions : quizQuestions;
      const activeFlashcard = flashSet[flashIndex % flashSet.length] ?? flashSet[0];
      const activeQuiz = quizSet[quizIndex % quizSet.length] ?? quizSet[0];

      return <><SectionHeading eyebrow="Practice makes the theory stick" title="Study tools" detail="20 flashcards and 20 quiz questions rotate into each daily set. Add your own study material to expand future rotations." />
        <div className="grid gap-8 xl:grid-cols-2"><section>
          <div className="mb-3 flex items-center gap-2"><NotebookPen size={16} className="text-mint" /><h2 className="font-semibold">Flashcards</h2><span className="ml-auto text-[11px] text-muted">{flashIndex + 1} / {flashSet.length}</span></div>
          <button onClick={() => setFlashFlipped(!flashFlipped)} className="flex min-h-52 w-full flex-col items-center justify-center border border-line bg-panel p-6 text-center transition-colors hover:border-[#627a68]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">{flashFlipped ? "Answer" : "Prompt"}</span>
            <span className="mt-4 max-w-md font-display text-2xl leading-snug">{activeFlashcard ? (flashFlipped ? activeFlashcard.back : activeFlashcard.front) : "No flashcards yet"}</span>
            <span className="mt-5 text-[11px] text-muted">Click to {flashFlipped ? "see prompt" : "reveal answer"}</span>
          </button>
          <div className="mt-3 flex justify-between">
            <button aria-label="Previous flashcard" onClick={() => { setFlashIndex((flashIndex + flashSet.length - 1) % flashSet.length); setFlashFlipped(false); }} className="grid h-9 w-9 place-items-center border border-line text-muted hover:text-paper"><ChevronLeft size={16} /></button>
            <button aria-label="Next flashcard" onClick={() => { setFlashIndex((flashIndex + 1) % flashSet.length); setFlashFlipped(false); }} className="grid h-9 w-9 place-items-center border border-line text-muted hover:text-paper"><ChevronRight size={16} /></button>
          </div>
          <div className="mt-6 border border-line bg-panel p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">Add a new flashcard</p>
            <div className="mt-3 space-y-3">
              <input value={flashForm.front} onChange={(event) => setFlashForm((current) => ({ ...current, front: event.target.value }))} placeholder="Front of card: e.g. What is deterrence?" className="w-full border border-line bg-ink px-3 py-2 text-xs text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />
              <input value={flashForm.back} onChange={(event) => setFlashForm((current) => ({ ...current, back: event.target.value }))} placeholder="Back of card: concise answer" className="w-full border border-line bg-ink px-3 py-2 text-xs text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />
              <button onClick={handleAddFlashcard} className="inline-flex items-center gap-2 border border-mint/40 bg-mint/10 px-3 py-2 text-[11px] font-semibold text-mint">Add to daily deck</button>
            </div>
          </div>

          <div className="mb-3 mt-9 flex items-center gap-2"><CircleHelp size={16} className="text-mint" /><h2 className="font-semibold">Quick quiz</h2><span className="ml-auto text-[11px] text-muted">{quizIndex + 1} / {quizSet.length}</span></div>
          <div className="border border-line bg-panel p-5">
            <p className="text-sm font-medium leading-6">{activeQuiz?.question || "No quiz items yet."}</p>
            <div className="mt-4 space-y-2">{activeQuiz?.options.map((option, index) => <button key={option} onClick={() => setQuizChoice(index)} disabled={quizChoice !== null || !activeQuiz} className={`flex w-full items-center gap-2 border px-3 py-2.5 text-left text-xs transition-colors ${quizChoice === null ? "border-line hover:border-mint/50" : index === activeQuiz.answer ? "border-mint/40 bg-mint/10 text-mint" : quizChoice === index ? "border-rose-300/40 bg-rose-300/5 text-rose-100" : "border-line text-muted"}`}><span className="grid h-5 w-5 place-items-center border border-current text-[10px]">{quizChoice !== null && index === activeQuiz.answer ? <Check size={12} /> : String.fromCharCode(65 + index)}</span>{option}</button>)}</div>
            {quizChoice !== null && activeQuiz && <p className="mt-3 text-xs leading-5 text-muted">{activeQuiz.explanation}</p>}
            <button onClick={() => { setQuizIndex((quizIndex + 1) % Math.max(quizSet.length, 1)); setQuizChoice(null); }} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-mint">Next question <ArrowUpRight size={12} /></button>
          </div>
          <div className="mt-6 border border-line bg-panel p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">Create a quiz</p>
            <div className="mt-3 space-y-3">
              <input value={quizForm.question} onChange={(event) => setQuizForm((current) => ({ ...current, question: event.target.value }))} placeholder="Question" className="w-full border border-line bg-ink px-3 py-2 text-xs text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />
              {quizForm.options.map((option, index) => <input key={`option-${index}`} value={option} onChange={(event) => setQuizForm((current) => ({ ...current, options: current.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value) }))} placeholder={`Answer choice ${index + 1}`} className="w-full border border-line bg-ink px-3 py-2 text-xs text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />)}
              <div className="flex items-center gap-2 text-xs text-muted"><span>Correct choice:</span><select value={quizForm.answer} onChange={(event) => setQuizForm((current) => ({ ...current, answer: Number(event.target.value) }))} className="border border-line bg-ink px-2 py-1 text-paper outline-none"><option value={0}>1</option><option value={1}>2</option><option value={2}>3</option><option value={3}>4</option></select></div>
              <textarea value={quizForm.explanation} onChange={(event) => setQuizForm((current) => ({ ...current, explanation: event.target.value }))} placeholder="Why is this answer correct?" className="min-h-20 w-full resize-y border border-line bg-ink px-3 py-2 text-xs leading-5 text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />
              <button onClick={handleAddQuizQuestion} className="inline-flex items-center gap-2 border border-mint/40 bg-mint/10 px-3 py-2 text-[11px] font-semibold text-mint">Add to daily quiz set</button>
            </div>
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-center gap-2"><Search size={16} className="text-mint" /><h2 className="font-semibold">Glossary</h2><span className="ml-auto text-[11px] text-muted">{allGlossary.length} terms</span></div>
          <label className="mb-2 flex h-10 items-center gap-2 border border-line bg-panel px-3 text-muted"><Search size={14} /><input aria-label="Search glossary" value={glossarySearch} onChange={(event) => setGlossarySearch(event.target.value)} placeholder="Search terms" className="w-full bg-transparent text-xs text-paper outline-none" /></label>
          <div className="max-h-[365px] overflow-auto border border-line bg-panel">{allGlossary.filter((entry) => `${entry.term} ${entry.definition}`.toLowerCase().includes(glossarySearch.toLowerCase())).map((entry) => <div key={`${entry.term}-${entry.definition}`} className="border-b border-line px-4 py-3 last:border-0"><p className="text-xs font-semibold text-paper">{entry.term}</p><p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-mint">{entry.category}</p><p className="mt-1 text-xs leading-5 text-muted">{entry.definition}</p></div>)}</div>
          <div className="mt-6 border border-line bg-panel p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mint">Add a theory</p>
            <div className="mt-3 space-y-3">
              <input value={glossaryForm.term} onChange={(event) => setGlossaryForm((current) => ({ ...current, term: event.target.value }))} placeholder="IR theory or concept" className="w-full border border-line bg-ink px-3 py-2 text-xs text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />
              <input value={glossaryForm.category} onChange={(event) => setGlossaryForm((current) => ({ ...current, category: event.target.value }))} placeholder="Category: e.g. Theory / Security / Economy" className="w-full border border-line bg-ink px-3 py-2 text-xs text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />
              <textarea value={glossaryForm.definition} onChange={(event) => setGlossaryForm((current) => ({ ...current, definition: event.target.value }))} placeholder="Definition used in international relations" className="min-h-20 w-full resize-y border border-line bg-ink px-3 py-2 text-xs leading-5 text-paper outline-none placeholder:text-muted/60 focus:border-mint/50" />
              <button onClick={handleAddGlossaryTerm} className="inline-flex items-center gap-2 border border-mint/40 bg-mint/10 px-3 py-2 text-[11px] font-semibold text-mint">Add glossary entry</button>
            </div>
          </div>
          <div className="mb-3 mt-8 flex items-center gap-2"><NotebookPen size={16} className="text-mint" /><h2 className="font-semibold">Personal notes</h2><span className="ml-auto text-[10px] text-muted">Saved on this device</span></div>
          <textarea aria-label="Personal study notes" value={notes} onChange={(event) => { setNotes(event.target.value); localStorage.setItem("gaa-notes", event.target.value); }} placeholder="Write a concept in your own words, or note a question to revisit…" className="min-h-44 w-full resize-y border border-line bg-panel p-4 text-sm leading-6 text-paper outline-none placeholder:text-muted/65 focus:border-mint/50" />
        </section></div>
      </>;
    }

    return <><SectionHeading eyebrow="Your reading list" title="Saved reading" detail="Articles you bookmarked are kept in this browser for later review." />{renderArticleList(savedArticles)}</>;
  }

  return <div className="min-h-screen lg:flex">
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-[#121917]/95 lg:sticky lg:top-0 lg:flex lg:h-screen">
      <div className="flex h-[76px] items-center gap-3 border-b border-line px-6"><div className="grid h-9 w-9 place-items-center border border-mint/30 bg-mint/10 text-mint"><Globe2 size={18} /></div><div><p className="text-[13px] font-semibold tracking-wide">GLOBAL AFFAIRS</p><p className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted">Study desk</p></div></div>
      <div className="px-4 pt-7"><p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">Your workspace</p>{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setView(id)} className={`mb-1 flex h-10 w-full items-center gap-3 px-3 text-left text-xs transition-colors ${view === id ? "border-l-2 border-mint bg-mint/[0.07] text-paper" : "border-l-2 border-transparent text-muted hover:bg-white/[0.035] hover:text-paper"}`}><Icon size={15} className={view === id ? "text-mint" : ""} />{label}{id === "saved" && <span className="ml-auto text-[10px]">{saved.length || ""}</span>}</button>)}<button onClick={() => setView("saved")} className={`mb-1 flex h-10 w-full items-center gap-3 border-l-2 px-3 text-left text-xs transition-colors ${view === "saved" ? "border-mint bg-mint/[0.07] text-paper" : "border-transparent text-muted hover:bg-white/[0.035] hover:text-paper"}`}><Bookmark size={15} className={view === "saved" ? "text-mint" : ""} />Saved reading<span className="ml-auto text-[10px]">{saved.length || ""}</span></button></div>
      <div className="mt-auto border-t border-line p-5"><div className="flex items-center justify-between text-[10px] text-muted"><span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${news ? "bg-mint" : loadingNews ? "animate-pulse bg-amber-300" : "bg-rose-300"}`} />{news ? "Publishers connected" : loadingNews ? "Checking publishers" : "Feed unavailable"}</span><button title="Refresh news" onClick={() => void refreshNews()} aria-label="Refresh news" className="text-muted hover:text-mint"><RefreshCw size={12} /></button></div><p className="mt-3 text-[10px] leading-5 text-muted/70">Independent reporting, IR frameworks, and a better question to ask next.</p></div>
    </aside>

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-line bg-ink/95 px-4 backdrop-blur-md sm:px-7 lg:px-9"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center border border-mint/30 bg-mint/10 text-mint lg:hidden"><Globe2 size={16} /></div><span className="text-xs font-medium text-paper/85">{titleMap[view]}</span><span className="hidden text-[10px] text-muted sm:inline">/</span><span className="hidden text-[10px] text-muted sm:inline">International relations study desk</span></div><div className="hidden h-7 w-7 place-items-center border border-line text-muted sm:grid"><GraduationCap size={14} /></div></header>
      <nav aria-label="Main navigation" className="scrollbar-hidden sticky top-[62px] z-10 flex overflow-x-auto border-b border-line bg-[#121917] px-3 py-1 lg:hidden">{[...navItems, { id: "saved" as View, label: "Saved", icon: Bookmark }].map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setView(id)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[10px] ${view === id ? "border-mint text-mint" : "border-transparent text-muted"}`}><Icon size={13} />{label}</button>)}</nav>
      <main key={view} className="fade-in mx-auto max-w-[1480px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-9">{renderMain()}<footer className="mt-12 flex flex-col gap-2 border-t border-line pt-4 text-[10px] leading-5 text-muted sm:flex-row sm:items-center sm:justify-between"><span>Reporting belongs to its publishers. Headlines and automated tags are not independent verification.</span><span className="inline-flex items-center gap-1.5"><Clock3 size={11} />Feeds refresh every 5 minutes</span></footer></main>
    </div>

  </div>;
}