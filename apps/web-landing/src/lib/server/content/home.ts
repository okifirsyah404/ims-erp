import {
  aboutChecks,
  featuredProductSlugs,
  featuredProject,
  heroCopy,
  heroStats,
  homeHeadings,
  industries,
  mobileFeaturedSlugs,
  secondaryProjects,
  trustedClients,
  whyItems,
  type HomeHeading,
} from "@/data/home";
import { projects, type Project } from "@/data/projects";
import type { IconName } from "@/lib/icons";
import { getContentEntry, pick } from ".";
import { getProjects, getTestimonials, type Testimonial } from "./projects";

/**
 * The home page (ERP-0071 stage 2): the ERP's `home` page merged over the built-in content
 * of `data/home.ts`, field by field, so anything the ERP leaves empty keeps today's copy.
 */
type ErpHeading = { eyebrow?: string; title?: string; description?: string };
type ErpIconCard = { icon?: string; title: string; mobileTitle?: string; description?: string; mobileDescription?: string };
type ErpHome = {
  hero: Partial<typeof heroCopy>;
  heroStats: { value: string; label: string; shortLabel?: string }[];
  trustedHeading: ErpHeading;
  trustedClients: { name: string }[];
  productsHeading: ErpHeading;
  featuredProductSlugs: string[];
  softwareHeading: ErpHeading;
  whyHeading: ErpHeading;
  whyItems: ErpIconCard[];
  industriesHeading: ErpHeading;
  industries: { icon?: string; name: string; description?: string; image?: string }[];
  projectsHeading: ErpHeading;
  featuredProjectSlugs: string[];
  testimonialsHeading: ErpHeading;
  aboutHeading: ErpHeading;
  aboutChecks: string[];
  contactHeading: ErpHeading;
};

export type FeaturedProjectCard = {
  slug: string;
  image: string;
  title: string;
  tags: string[];
  mobileEyebrow: string;
  metrics: { value: string; label: string; shortLabel: string }[];
};
export type SecondaryProjectCard = { slug: string; image: string; eyebrow: string; title: string; description: string };

const FALLBACK_ICON: IconName = "layers";

/** A heading the ERP has set replaces the built-in one whole (its mobile variants included). */
function heading(erp: ErpHeading | undefined, fallback: HomeHeading): HomeHeading {
  if (!erp?.title) return fallback;
  return { eyebrow: erp.eyebrow ?? fallback.eyebrow, title: erp.title, description: erp.description };
}

const featuredFromProject = (project: Project): FeaturedProjectCard => ({
  slug: project.slug,
  image: project.image,
  title: project.title,
  tags: [project.eyebrow.split(" · ")[0] ?? project.eyebrow, project.location, String(project.year)],
  mobileEyebrow: project.eyebrow,
  metrics: project.metrics.map((metric) => ({ ...metric, shortLabel: metric.label })),
});

const secondaryFromProject = (project: Project): SecondaryProjectCard => ({
  slug: project.slug,
  image: project.image,
  eyebrow: project.eyebrow,
  title: project.title,
  description: project.summary,
});

export async function getHomeContent() {
  const [entry, projectList, testimonials] = await Promise.all([getContentEntry<ErpHome>("home"), getProjects(), getTestimonials()]);
  const home = entry?.content ?? {};
  const hero = { ...heroCopy, ...Object.fromEntries(Object.entries(home.hero ?? {}).filter(([, value]) => value)) } as typeof heroCopy;

  // Featured projects: the built-in home cards keep their design copy; other slugs come from the projects.
  const bySlug = new Map<string, Project>([...projects, ...projectList].map((project) => [project.slug, project]));
  const slugs = home.featuredProjectSlugs?.length ? home.featuredProjectSlugs : [featuredProject.slug, ...secondaryProjects.map((project) => project.slug)];
  const [leadSlug, ...restSlugs] = slugs;
  const lead: FeaturedProjectCard | null =
    leadSlug === featuredProject.slug ? featuredProject : bySlug.has(leadSlug!) ? featuredFromProject(bySlug.get(leadSlug!)!) : null;
  const rest = restSlugs.flatMap((slug) => {
    const builtIn = secondaryProjects.find((project) => project.slug === slug);
    if (builtIn) return [builtIn as SecondaryProjectCard];
    const project = bySlug.get(slug);
    return project ? [secondaryFromProject(project)] : [];
  });

  const products = pick(home.featuredProductSlugs, [...featuredProductSlugs]);
  return {
    seo: { title: entry?.seoTitle ?? null, description: entry?.seoDescription ?? null },
    hero,
    heroStats: pick(home.heroStats, [...heroStats]).map((stat) => ({ ...stat, shortLabel: stat.shortLabel || stat.label })),
    trustedHeading: heading(home.trustedHeading, homeHeadings.trusted),
    trustedClients: home.trustedClients?.length
      ? home.trustedClients.map((client, index) => ({ name: client.name, className: trustedClients[index % trustedClients.length]!.className }))
      : [...trustedClients],
    productsHeading: heading(home.productsHeading, homeHeadings.products),
    featuredProductSlugs: products,
    mobileFeaturedSlugs: home.featuredProductSlugs?.length ? products : [...mobileFeaturedSlugs],
    softwareHeading: heading(home.softwareHeading, homeHeadings.software),
    whyHeading: heading(home.whyHeading, homeHeadings.why),
    whyItems: (home.whyItems?.length ? home.whyItems : whyItems).map((item) => ({
      icon: (item.icon ?? FALLBACK_ICON) as IconName,
      title: item.title,
      mobileTitle: ("mobileTitle" in item && item.mobileTitle) || item.title,
      description: item.description ?? "",
      mobileDescription: ("mobileDescription" in item && item.mobileDescription) || item.description || "",
    })),
    industriesHeading: heading(home.industriesHeading, homeHeadings.industries),
    industries: (home.industries?.length ? home.industries : industries).map((industry, index) => ({
      icon: (industry.icon ?? FALLBACK_ICON) as IconName,
      name: industry.name,
      description: industry.description ?? "",
      image: industry.image || industries[index % industries.length]!.image,
    })),
    projectsHeading: heading(home.projectsHeading, homeHeadings.projects),
    featuredProject: lead ?? featuredProject,
    secondaryProjects: lead ? rest : [...secondaryProjects],
    testimonialsHeading: heading(home.testimonialsHeading, homeHeadings.testimonials),
    testimonials: testimonials.slice(0, 3) as Testimonial[],
    aboutHeading: heading(home.aboutHeading, homeHeadings.about),
    aboutChecks: pick(home.aboutChecks, [...aboutChecks]),
    contactHeading: heading(home.contactHeading, homeHeadings.contact),
  };
}

export type HomeContent = Awaited<ReturnType<typeof getHomeContent>>;
