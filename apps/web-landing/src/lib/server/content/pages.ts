import * as about from "@/data/about";
import { careerPerks, newsArticles, openRoles, type NewsArticle } from "@/data/company-pages";
import * as knowledge from "@/data/knowledge";
import type { IconName } from "@/lib/icons";
import { images } from "@/lib/images";
import { getContentEntry, getContentList, pick } from ".";

/**
 * Content pages (ERP-0071 stage 4): about, careers and open roles, news, the help centre
 * (topics, articles, FAQ, documents, videos, training), legal pages, warranty and
 * installation. Each loader returns the website's built-in shapes: single pages are merged
 * field by field over `src/data/*`; a collection the ERP publishes anything for replaces
 * the built-in list (in ERP order).
 */

type Entries<T> = Awaited<ReturnType<typeof getContentList<T>>>;
const list = async <T, R>(type: string, builtIn: R[], map: (entry: NonNullable<Entries<T>>[number]) => R): Promise<R[]> => {
  const entries = await getContentList<T>(type);
  return entries ? entries.map(map) : builtIn;
};
const digits = (value: string) => value.replace(/[^\d]/g, "");
const tel = (phone: string) => `tel:+${digits(phone).replace(/^0/, "62")}`;

/* About ---------------------------------------------------------------- */

type Member = { name: string; title?: string; bio?: string; portrait?: string };
type Group = { title?: string; description?: string; members?: Member[] };
type ErpAbout = {
  stats: { value: string; label: string; mobileLabel?: string }[];
  companyFacts: { label: string; value: string; mobileValue?: string }[];
  vision: Partial<typeof about.vision>;
  missions: { text: string; mobileText?: string }[];
  pillars: { icon?: string; title: string; description?: string; mobileDescription?: string; bullets?: string[] }[];
  technologies: { icon?: string; title: string; description?: string; mobileDescription?: string }[];
  values: { icon?: string; title: string; description?: string; mobileDescription?: string }[];
  portfolio: { tag?: string; title: string; mobileTitle?: string; image?: string; meta?: string; mobileMeta?: string }[];
  brandChips: string[];
  leadership: Group;
  teamGroups: Group[];
  offices: { title: string; address?: string; phone?: string; email?: string; primary?: boolean }[];
};

const team = (group: Group, fallback?: about.TeamGroup): about.TeamGroup => ({
  title: group.title || fallback?.title || "",
  description: group.description || fallback?.description || "",
  members: (group.members?.length ? group.members : (fallback?.members ?? [])).map((member) => ({
    name: member.name,
    title: member.title ?? "",
    bio: member.bio ?? "",
    portrait: member.portrait,
  })),
});
const card = <T extends { icon?: string; title: string; description?: string; mobileDescription?: string }>(item: T) => ({
  icon: (item.icon ?? "layers") as IconName,
  title: item.title,
  description: item.description ?? "",
  mobileDescription: item.mobileDescription || item.description || "",
});

export async function getAbout() {
  const content: Partial<ErpAbout> = (await getContentEntry<ErpAbout>("about"))?.content ?? {};
  return {
    aboutStats: pick(content.stats, about.aboutStats as ErpAbout["stats"]),
    companyFacts: pick(content.companyFacts, about.companyFacts as ErpAbout["companyFacts"]),
    vision: { ...about.vision, ...Object.fromEntries(Object.entries(content.vision ?? {}).filter(([, value]) => value)) },
    missions: content.missions?.length ? content.missions.map((mission) => ({ text: mission.text, mobileText: mission.mobileText || mission.text })) : about.missions,
    pillars: content.pillars?.length ? content.pillars.map((pillar) => ({ ...card(pillar), bullets: pillar.bullets ?? [] })) : about.pillars,
    technologies: content.technologies?.length ? content.technologies.map(card) : about.technologies,
    values: content.values?.length ? content.values.map(card) : about.values,
    portfolio: content.portfolio?.length
      ? content.portfolio.map((item, index) => ({
          tag: item.tag ?? "",
          title: item.title,
          mobileTitle: item.mobileTitle,
          image: item.image || about.portfolio[index % about.portfolio.length]!.image,
          meta: item.meta ?? "",
          mobileMeta: item.mobileMeta || item.meta || "",
        }))
      : about.portfolio,
    brandChips: pick(content.brandChips, about.brandChips),
    leadership: content.leadership ? team(content.leadership, about.leadership) : about.leadership,
    teamGroups: content.teamGroups?.length ? content.teamGroups.map((group) => team(group)) : about.teamGroups,
    offices: content.offices?.length
      ? content.offices.map((office) => ({
          title: office.title,
          address: office.address ?? "",
          phone: office.phone ?? "",
          phoneHref: office.phone ? tel(office.phone) : "",
          email: office.email ?? "",
          primary: office.primary ?? false,
        }))
      : about.offices,
  };
}

/* Careers -------------------------------------------------------------- */

type ErpCareers = { heading: { eyebrow?: string; title?: string; description?: string }; perks: { icon?: string; title: string; description?: string }[] };
type ErpRole = { team: string; location: string; type: string; description?: string; applyUrl?: string };
export type OpenRole = { title: string; team: string; location: string; type: string; description?: string; applyUrl?: string };

export async function getCareers() {
  const [page, roles] = await Promise.all([
    getContentEntry<ErpCareers>("careers"),
    list<ErpRole, OpenRole>("career_role", openRoles, ({ title, content }) => ({
      title,
      team: content.team ?? "",
      location: content.location ?? "",
      type: content.type ?? "",
      description: content.description,
      applyUrl: content.applyUrl,
    })),
  ]);
  const content = page?.content ?? {};
  return {
    heading: content.heading?.title ? content.heading : null,
    perks: content.perks?.length
      ? content.perks.map((perk) => ({ icon: (perk.icon ?? "layers") as IconName, title: perk.title, description: perk.description ?? "" }))
      : careerPerks,
    roles,
  };
}

/* News ------------------------------------------------------------------ */

type ErpNews = Omit<NewsArticle, "slug" | "title">;

export function getNews(): Promise<NewsArticle[]> {
  return list<ErpNews, NewsArticle>("news", newsArticles, ({ slug, title, content }) => ({
    slug,
    title,
    category: content.category ?? "",
    excerpt: content.excerpt ?? "",
    date: content.date ?? "",
    minutes: content.minutes ?? 3,
    image: content.image ?? images.officeLobby,
    body: content.body ?? [],
  }));
}

/* Help centre ----------------------------------------------------------- */

type ErpTopic = { mobileTitle?: string; description: string; icon?: string };
type ErpArticle = { topic: string; summary: string; minutes?: number; updated?: string; body?: string[] };
type ErpFaq = { mobileLabel?: string; items: { question: string; answer: string }[] };
type ErpDocument = Omit<knowledge.DocumentRecord, "id" | "title">;
type ErpVideo = { duration?: string; topic?: string; image?: string; url?: string };
type ErpCourse = { level?: string; duration?: string; description?: string; icon?: string };

export type VideoGuide = { title: string; duration: string; topic: string; image: string; url?: string };
export type TrainingCourse = { title: string; level: string; duration: string; description: string; icon: IconName };

export async function getKnowledge() {
  const [helpTopics, helpArticles, faqGroups, documents, videoGuides, trainingCourses] = await Promise.all([
    list<ErpTopic, knowledge.HelpTopic>("help_topic", knowledge.helpTopics, ({ slug, title, content }) => ({
      slug,
      title,
      mobileTitle: content.mobileTitle,
      description: content.description ?? "",
      icon: (content.icon ?? "book-open") as IconName,
    })),
    list<ErpArticle, knowledge.HelpArticle>("help_article", knowledge.helpArticles, ({ slug, title, content }) => ({
      slug,
      title,
      topic: content.topic ?? "",
      summary: content.summary ?? "",
      minutes: content.minutes ?? 3,
      updated: content.updated ?? "",
      body: content.body ?? [],
    })),
    list<ErpFaq, knowledge.FaqGroup>("faq_group", knowledge.faqGroups, ({ slug, title, content }) => ({
      key: slug,
      label: title,
      mobileLabel: content.mobileLabel || title,
      items: content.items ?? [],
    })),
    list<ErpDocument, knowledge.DocumentRecord>("help_document", knowledge.documents, ({ slug, title, content }) => ({
      id: slug,
      title,
      product: content.product ?? "",
      category: content.category ?? "",
      languages: (content.languages ?? ["en"]) as knowledge.DocumentRecord["languages"],
      type: (content.type ?? "manual") as knowledge.DocType,
      version: content.version ?? "",
      size: content.size ?? "",
      format: (content.format ?? "pdf") as knowledge.DocFormat,
      updated: content.updated ?? "",
      partner: content.partner,
      url: content.url,
    })),
    list<ErpVideo, VideoGuide>("help_video", knowledge.videoGuides, ({ title, content }) => ({
      title,
      duration: content.duration ?? "",
      topic: content.topic ?? "",
      image: content.image ?? images.officeLobby,
      url: content.url,
    })),
    list<ErpCourse, TrainingCourse>("training_course", knowledge.trainingCourses, ({ title, content }) => ({
      title,
      level: content.level ?? "",
      duration: content.duration ?? "",
      description: content.description ?? "",
      icon: (content.icon ?? "graduation-cap") as IconName,
    })),
  ]);
  return { helpTopics, helpArticles, faqGroups, documents, videoGuides, trainingCourses };
}

/* Legal, warranty, installation ------------------------------------------ */

export type LegalContent = { title: string; description: string; updated: string; sections: { title: string; body: string[] }[] };
type ErpLegal = { description?: string; updated?: string; sections?: { title: string; body?: string[] }[] };

/** A legal page (`privacy`, `terms`) merged over its built-in text. */
export async function getLegal(slug: string, builtIn: LegalContent): Promise<LegalContent> {
  const entry = await getContentEntry<ErpLegal>("legal", slug);
  if (!entry) return builtIn;
  const content = entry.content;
  return {
    title: entry.title || builtIn.title,
    description: content.description || builtIn.description,
    updated: content.updated || builtIn.updated,
    sections: content.sections?.length ? content.sections.map((section) => ({ title: section.title, body: section.body ?? [] })) : builtIn.sections,
  };
}

/** A single page's ERP content (warranty, installation), or `{}`; the page merges it. */
export async function getSinglePage<T>(type: "warranty" | "installation"): Promise<Partial<T>> {
  return (await getContentEntry<T>(type))?.content ?? {};
}
