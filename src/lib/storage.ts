import { DEFAULT_COVER_LETTER } from "./default-cover-letter";
import type { AppData } from "./types";

const STORAGE_KEY = "apply-hub-v1";

export function loadAppData(): AppData {
  if (typeof window === "undefined") {
    return { coverLetter: DEFAULT_COVER_LETTER, jobs: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { coverLetter: DEFAULT_COVER_LETTER, jobs: [] };
    }
    const parsed = JSON.parse(raw) as AppData;
    return {
      coverLetter: parsed.coverLetter || DEFAULT_COVER_LETTER,
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    };
  } catch {
    return { coverLetter: DEFAULT_COVER_LETTER, jobs: [] };
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
