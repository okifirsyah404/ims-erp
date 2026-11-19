import { projects as builtInProjects, type Industry, type Project } from "@/data/projects";
import { images } from "@/lib/images";
import { getContentList } from ".";

/**
 * Projects and testimonials (ERP-0071). Once the ERP publishes any project, the ERP's list
 * replaces the built-in sample portfolio (`data/projects.ts`); likewise testimonials. With
 * nothing published, the website keeps its built-in content.
 */
type ErpProject = Omit<Project, "slug" | "title" | "quote">;
type ErpTestimonial = { quote: string; author: string; role?: string; company?: string; projectSlug?: string; photo?: string };

export type Testimonial = { slug: string; quote: string; author: string; role: string; company: string; projectSlug: string | null; photo: string | null };

const INDUSTRIES = new Set<Industry>(["office", "parking", "education", "fitness", "venues", "government"]);

export async function getProjects(): Promise<Project[]> {
  const list = await getContentList<ErpProject>("project");
  if (!list) return builtInProjects;
  return list.map(({ slug, title, content }) => ({
    slug,
    title,
    industry: content.industry && INDUSTRIES.has(content.industry) ? content.industry : "office",
    eyebrow: content.eyebrow ?? "",
    client: content.client ?? "",
    location: content.location ?? "",
    year: content.year ?? new Date().getFullYear(),
    meta: content.meta ?? "",
    summary: content.summary ?? "",
    image: content.image ?? images.officeLobby,
    gallery: content.gallery ?? [],
    metrics: content.metrics ?? [],
    challenge: content.challenge ?? "",
    solution: content.solution ?? "",
    outcome: content.outcome ?? "",
    scope: content.scope ?? [],
    products: content.products ?? [],
    solutions: content.solutions ?? [],
    featured: content.featured ?? false,
  }));
}

export async function getProject(slug: string): Promise<Project | null> {
  return (await getProjects()).find((project) => project.slug === slug) ?? null;
}

/** Built-in testimonials: the quotes of the sample portfolio. */
const builtInTestimonials: Testimonial[] = builtInProjects.flatMap((project) =>
  project.quote
    ? [{ slug: `${project.slug}-quote`, quote: project.quote.text, author: project.quote.author, role: project.quote.role, company: project.client, projectSlug: project.slug, photo: null }]
    : [],
);

export async function getTestimonials(): Promise<Testimonial[]> {
  const list = await getContentList<ErpTestimonial>("testimonial");
  if (!list) return builtInTestimonials;
  return list.flatMap(({ slug, content }) =>
    content.quote && content.author
      ? [
          {
            slug,
            quote: content.quote,
            author: content.author,
            role: content.role ?? "",
            company: content.company ?? "",
            projectSlug: content.projectSlug ?? null,
            photo: content.photo ?? null,
          },
        ]
      : [],
  );
}

/** The testimonials about one project (shown on its case study). */
export async function getProjectTestimonials(slug: string): Promise<Testimonial[]> {
  return (await getTestimonials()).filter((testimonial) => testimonial.projectSlug === slug);
}
