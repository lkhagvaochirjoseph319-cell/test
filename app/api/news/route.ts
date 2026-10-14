import Parser from "rss-parser";
import { NextResponse } from "next/server";
import type { NewsArticle } from "@/app/lib/types";

export const revalidate = 300;

const feeds = [
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { name: "DW", url: "https://rss.dw.com/rdf/rss-en-world" },
];

const parser = new Parser({ timeout: 9000 });
const countryTerms: [string, string[]][] = [
  ["United States", ["united states", "u.s.", "washington"]],
  ["United Kingdom", ["united kingdom", "britain"]],
  ["South Korea", ["south korea"]], ["North Korea", ["north korea"]],
  ["Democratic Republic of the Congo", ["democratic republic of the congo"]],
  ["United Arab Emirates", ["united arab emirates"]], ["Saudi Arabia", ["saudi arabia"]],
  ["New Zealand", ["new zealand"]], ["South Africa", ["south africa"]],
  ["Sri Lanka", ["sri lanka"]], ["Czechia", ["czechia", "czech republic"]],
  ["Myanmar", ["myanmar", "burma"]], ["Palestine", ["palestine", "palestinian"]],
  ["Nigeria", ["nigeria"]], ["Niger", ["niger"]], ["Ukraine", ["ukraine"]],
  ["Russia", ["russia"]], ["Israel", ["israel"]], ["Iran", ["iran"]],
  ["Syria", ["syria"]], ["Lebanon", ["lebanon"]], ["Yemen", ["yemen"]],
  ["China", ["china"]], ["Taiwan", ["taiwan"]], ["Japan", ["japan"]],
  ["India", ["india"]], ["Pakistan", ["pakistan"]], ["Afghanistan", ["afghanistan"]],
  ["Philippines", ["philippines"]], ["Australia", ["australia"]], ["Sudan", ["sudan"]],
  ["Ethiopia", ["ethiopia"]], ["Somalia", ["somalia"]], ["Mali", ["mali"]],
  ["France", ["france"]], ["Germany", ["germany"]], ["Poland", ["poland"]],
  ["Turkey", ["turkey"]], ["Brazil", ["brazil"]], ["Mexico", ["mexico"]],
  ["Venezuela", ["venezuela"]], ["Canada", ["canada"]], ["Egypt", ["egypt"]],
];

function countryFromText(text: string) {
  return countryTerms.find(([, terms]) => terms.some((term) => text.includes(term)))?.[0]
    || "International / unspecified";
}

function classify(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase();
  const contains = (terms: string[]) => terms.some((term) => text.includes(term));
  let region = "Global";
  if (contains(["ukraine", "russia", "europe", "nato", "eu ", "britain", "france", "germany"])) region = "Europe";
  else if (contains(["gaza", "israel", "iran", "syria", "lebanon", "yemen", "middle east"])) region = "Middle East";
  else if (contains(["china", "taiwan", "japan", "korea", "asia", "philippines", "india"])) region = "Asia Pacific";
  else if (contains(["africa", "sudan", "sahel", "nigeria", "congo", "somalia"])) region = "Africa";
  else if (contains(["united states", "u.s.", "washington", "canada", "americas", "brazil"])) region = "Americas";

  const topics = [
    ["Conflict", ["war", "attack", "strike", "military", "troops", "killed", "missile", "ceasefire", "conflict"]],
    ["Diplomacy", ["talks", "summit", "diplomat", "deal", "agreement", "sanction", "ambassador", "negotiat"]],
    ["Security", ["security", "defence", "defense", "nato", "weapon", "nuclear", "border"]],
    ["Governance", ["election", "government", "parliament", "president", "minister", "court"]],
    ["Climate", ["climate", "carbon", "cop30", "emissions"]],
  ].filter(([, terms]) => contains(terms as string[])).map(([name]) => name as string);

  let status: NewsArticle["status"] = "News report";
  if (contains(["alleged", "accused", "accusation", "claims", "claim that"])) status = "Allegation";
  else if (contains(["breaking", "developing", "live:", "update:"])) status = "Developing report";
  else if (contains(["official statement", "government statement", "ministry statement", "president says", "minister says", "officials say", "government announces"])) status = "Official statement";

  return { region, country: countryFromText(text), topics: topics.length ? topics : ["World affairs"], status };
}

export async function GET() {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const response = await fetch(feed.url, {
        headers: { "User-Agent": "GlobalAffairsAI/1.0 (news reader; RSS feed use)" },
        signal: AbortSignal.timeout(10000),
        next: { revalidate: 300 },
      });
      if (!response.ok) throw new Error(`${feed.name} returned HTTP ${response.status}`);
      const xml = await response.text();
      const parsed = await parser.parseString(xml);
      const articles = parsed.items.flatMap((item): NewsArticle[] => {
        if (!item.title || !item.link) return [];
        try {
          if (new URL(item.link).protocol !== "https:") return [];
        } catch { return []; }
        const summary = (item.contentSnippet || item.content || item.summary || "")
          .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
        return [{
          id: item.guid || item.link,
          title: item.title.trim(),
          summary: summary || "The publisher has not supplied a summary for this story.",
          url: item.link,
          source: feed.name,
          publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
          ...classify(item.title, summary),
        }];
      });
      return { name: feed.name, articles };
    }),
  );

  const articles = results.flatMap((result) => result.status === "fulfilled" ? result.value.articles : []);
  const sources = results.flatMap((result) => result.status === "fulfilled" ? [result.value.name] : []);
  const errors = results.flatMap((result, index) => result.status === "rejected"
    ? [`${feeds[index].name} is unavailable right now.`]
    : []);
  const unique = [...new Map(articles.map((article) => [article.url, article])).values()]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  if (unique.length === 0) {
    return NextResponse.json({ error: "No news feeds could be reached. Please try again shortly.", errors }, { status: 503 });
  }

  return NextResponse.json({ articles: unique.slice(0, 60), sources, fetchedAt: new Date().toISOString(), errors });
}