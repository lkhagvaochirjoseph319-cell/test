export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  region: string;
  country: string;
  topics: string[];
  status: "Official statement" | "Allegation" | "Developing report" | "News report";
};

export type NewsResponse = {
  articles: NewsArticle[];
  sources: string[];
  fetchedAt: string;
  errors: string[];
};