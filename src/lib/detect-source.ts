import type { JobSource, JobTag } from "./types";

export function detectSource(url: string): JobSource {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("onlinejobs.ph")) return "onlinejobs";
    if (host.includes("indeed.")) return "indeed";
    if (host.includes("jobstreet.") || host.includes("seek.com")) return "jobstreet";
    return "other";
  } catch {
    return "other";
  }
}

export function suggestTags(title: string): JobTag[] {
  const t = title.toLowerCase();
  const tags: JobTag[] = [];
  if (/wordpress|wp\b|divi|woocommerce/.test(t)) tags.push("wordpress");
  if (/web\s*dev|frontend|front-end|backend|back-end|full\s*stack|fullstack/.test(t)) {
    tags.push("web-developer");
  }
  if (/full\s*stack|fullstack/.test(t)) tags.push("fullstack");
  if (tags.length === 0) tags.push("other");
  return [...new Set(tags)];
}

export const SOURCE_LABELS: Record<JobSource, string> = {
  onlinejobs: "OnlineJobs.ph",
  indeed: "Indeed",
  jobstreet: "JobStreet",
  other: "Other",
};

export const STATUS_LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  replied: "Replied",
  closed: "Closed",
};

export const TAG_LABELS: Record<JobTag, string> = {
  wordpress: "WordPress",
  "web-developer": "Web Developer",
  fullstack: "Fullstack",
  other: "Other",
};
