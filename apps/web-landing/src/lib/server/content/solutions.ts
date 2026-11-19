import { platforms as builtInPlatforms, type Platform, type PlatformKey } from "@/data/solutions";
import { solutionDetails as builtInDetails, type SolutionDetail } from "@/data/solution-details";
import type { IconName } from "@/lib/icons";
import { getContentList } from ".";

/**
 * Software solutions (ERP-0071 stage 3). Once the ERP publishes any solution, its list (in
 * ERP order) replaces the built-in six; each entry's `key` picks the product mockup and the
 * built-in solution with the same key fills every field the ERP left empty.
 */
type ErpSolution = Omit<Platform, "slug" | "name"> & Partial<SolutionDetail>;

export type Solutions = { platforms: Platform[]; details: Record<string, SolutionDetail> };

const EMPTY_DETAIL: SolutionDetail = {
  headline: "",
  intro: "",
  stats: [],
  modules: [],
  workflow: [],
  hardware: [],
  projects: [],
  industries: [],
  faq: [],
  pricingNote: "",
};

const BUILT_IN: Solutions = { platforms: builtInPlatforms, details: builtInDetails };

/** The value, unless missing or empty (then the fallback). */
const or = <T>(value: T | undefined, fallback: T): T =>
  value === undefined || value === "" || (Array.isArray(value) && value.length === 0) ? fallback : value;

export async function getSolutions(): Promise<Solutions> {
  const list = await getContentList<ErpSolution>("solution");
  if (!list) return BUILT_IN;
  const platforms: Platform[] = [];
  const details: Record<string, SolutionDetail> = {};
  for (const { slug, title, content } of list) {
    const base = builtInPlatforms.find((platform) => platform.key === content.key) ?? builtInPlatforms[0]!;
    const baseDetail = builtInDetails[base.slug] ?? EMPTY_DETAIL;
    platforms.push({
      key: (content.key ?? base.key) as PlatformKey,
      slug,
      name: title,
      layerLabel: or(content.layerLabel, base.layerLabel),
      mobileLayerLabel: or(content.mobileLayerLabel, base.mobileLayerLabel),
      chipLabel: or(content.chipLabel, base.chipLabel),
      windowTitle: or(content.windowTitle, base.windowTitle),
      icon: or(content.icon as IconName | undefined, base.icon),
      preview: or(content.preview, base.preview),
      description: or(content.description, base.description),
      mobileDescription: or(content.mobileDescription, content.description ?? base.mobileDescription),
      tags: or(content.tags, base.tags),
      mobileTags: or(content.mobileTags, content.tags ?? base.mobileTags),
      meta: or(content.meta, base.meta),
    });
    details[slug] = {
      headline: or(content.headline, baseDetail.headline),
      intro: or(content.intro, baseDetail.intro),
      stats: or(content.stats, baseDetail.stats),
      modules: or(
        content.modules?.map((module) => ({ icon: (module.icon ?? "layers") as IconName, title: module.title, description: module.description ?? "" })),
        baseDetail.modules,
      ),
      workflow: or(
        content.workflow?.map((step) => ({ title: step.title, description: step.description ?? "" })),
        baseDetail.workflow,
      ),
      hardware: or(content.hardware, baseDetail.hardware),
      projects: or(content.projects, baseDetail.projects),
      industries: or(content.industries, baseDetail.industries),
      faq: or(content.faq, baseDetail.faq),
      pricingNote: or(content.pricingNote, baseDetail.pricingNote),
    };
  }
  return { platforms, details };
}
