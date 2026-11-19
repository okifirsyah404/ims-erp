import { getProjects } from "./server/content/projects";
import { documents, helpArticles } from "../data/knowledge";
import { newsArticles } from "../data/company-pages";
import { routes, solutionHref } from "../data/site";
import { formatRupiah } from "./format";
import { catalogSource } from "./server/catalog";

/**
 * Site search used by `/search` and the command palette (`/api/search.json`).
 * Products, categories and software come from the catalog source (sample data or ERP);
 * projects, help, documents and news are site content.
 */

export type SearchGroupKey = "products" | "categories" | "solutions" | "projects" | "help" | "documents" | "news" | "pages";
export type SearchItem = { title: string; meta: string; href: string; image?: string };
export type SearchGroup = { key: SearchGroupKey; title: string; items: SearchItem[] };
export type SearchResponse = { q: string; groups: SearchGroup[]; total: number; catalogAvailable: boolean };

const quickPages: SearchItem[] = [
  { title: "Track an order", meta: "Order number or AWB · no sign-in", href: routes.track },
  { title: "Request a quotation", meta: "Business pricing within 1 working day", href: routes.quote },
  { title: "Build your solution", meta: "5-step configurator", href: routes.build },
  { title: "Compare products", meta: "Up to 4 products side by side", href: routes.compare },
  { title: "Book a software demo", meta: "Online, on-site or showroom", href: routes.demo },
  { title: "Contact sales & support", meta: "WhatsApp, phone, email or form", href: routes.contact },
  { title: "Warranty", meta: "Coverage and claims", href: routes.warranty },
  { title: "Installation services", meta: "Nationwide certified technicians", href: routes.installation },
  { title: "Help center", meta: "Guides, FAQ and troubleshooting", href: routes.help },
  { title: "Cart", meta: "Review items and check out", href: routes.cart },
];

export async function searchSite(rawQuery: string, limit = 50): Promise<SearchResponse> {
  const q = rawQuery.trim().slice(0, 100);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return { q, groups: [], total: 0, catalogAvailable: true };
  const hit = (...fields: (string | undefined)[]) => terms.every((t) => fields.join(" ").toLowerCase().includes(t));

  const projects = await getProjects();
  let catalogAvailable = true;
  // `.then` so a missing ERP configuration (thrown while creating the source) is caught too.
  const catalog = await Promise.resolve()
    .then(() => catalogSource.search(q, limit))
    .catch((error) => {
      console.error("[search] catalog search failed", error);
      catalogAvailable = false;
      return { products: [], categories: [], solutions: [] };
    });

  const all: SearchGroup[] = [
    {
      key: "products",
      title: "Products",
      items: catalog.products.map((p) => ({
        title: p.name,
        meta: `${p.category} · ${p.price === null ? "Project pricing" : formatRupiah(p.price)}`,
        href: `${routes.products}/${p.slug}`,
        image: p.image,
      })),
    },
    {
      key: "categories",
      title: "Categories",
      items: catalog.categories.map((c) => ({ title: c.name, meta: `${c.productCount} products`, href: `${routes.products}?category=${c.slug}` })),
    },
    {
      key: "solutions",
      title: "Software solutions",
      items: catalog.solutions.map((s) => ({ title: s.name, meta: s.tags.join(" · "), href: solutionHref(s.slug) })),
    },
    {
      key: "pages",
      title: "Pages",
      items: quickPages.filter((p) => hit(p.title, p.meta)),
    },
    {
      key: "projects",
      title: "Projects",
      items: projects.filter((p) => hit(p.title, p.client, p.summary, p.eyebrow)).map((p) => ({ href: `${routes.projects}/${p.slug}`, title: p.title, meta: p.meta, image: p.image })),
    },
    {
      key: "help",
      title: "Help articles",
      items: helpArticles.filter((a) => hit(a.title, a.summary)).map((a) => ({ href: `${routes.help}/articles/${a.slug}`, title: a.title, meta: a.summary })),
    },
    {
      key: "documents",
      title: "Documents",
      items: documents.filter((d) => hit(d.title, d.product)).map((d) => ({ href: `${routes.documents}?q=${encodeURIComponent(d.title)}`, title: d.title, meta: `${d.product} · ${d.version}` })),
    },
    {
      key: "news",
      title: "News",
      items: newsArticles.filter((n) => hit(n.title, n.excerpt)).map((n) => ({ href: `${routes.news}/${n.slug}`, title: n.title, meta: n.excerpt, image: n.image })),
    },
  ];
  const groups = all.map((g) => ({ ...g, items: g.items.slice(0, limit) })).filter((g) => g.items.length > 0);

  return { q, groups, total: groups.reduce((n, g) => n + g.items.length, 0), catalogAvailable };
}
