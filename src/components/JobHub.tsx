"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  detectSource,
  SOURCE_LABELS,
  STATUS_LABELS,
  suggestTags,
  TAG_LABELS,
} from "@/lib/detect-source";
import { DEFAULT_COVER_LETTER } from "@/lib/default-cover-letter";
import { loadAppData, saveAppData } from "@/lib/storage";
import type { Job, JobSource, JobStatus, JobTag } from "@/lib/types";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function JobHub() {
  const [ready, setReady] = useState(false);
  const [coverLetter, setCoverLetter] = useState(DEFAULT_COVER_LETTER);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [panel, setPanel] = useState<"jobs" | "letter">("jobs");

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [filterSource, setFilterSource] = useState<JobSource | "all">("all");
  const [filterStatus, setFilterStatus] = useState<JobStatus | "all">("all");
  const [filterTag, setFilterTag] = useState<JobTag | "all">("all");

  useEffect(() => {
    const data = loadAppData();
    setCoverLetter(data.coverLetter);
    setJobs(data.jobs);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveAppData({ coverLetter, jobs });
  }, [ready, coverLetter, jobs]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs
      .filter((j) => (filterSource === "all" ? true : j.source === filterSource))
      .filter((j) => (filterStatus === "all" ? true : j.status === filterStatus))
      .filter((j) => (filterTag === "all" ? true : j.tags.includes(filterTag)))
      .filter((j) => {
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.url.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [jobs, query, filterSource, filterStatus, filterTag]);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      saved: jobs.filter((j) => j.status === "saved").length,
      applied: jobs.filter((j) => j.status === "applied").length,
      replied: jobs.filter((j) => j.status === "replied").length,
    };
  }, [jobs]);

  function addJob(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl || !title.trim()) {
      showToast("Title and URL are required");
      return;
    }

    const job: Job = {
      id: uid(),
      title: title.trim(),
      company: company.trim() || "Unknown",
      url: trimmedUrl,
      source: detectSource(trimmedUrl),
      tags: suggestTags(title),
      status: "saved",
      notes: "",
      createdAt: new Date().toISOString(),
    };

    setJobs((prev) => [job, ...prev]);
    setTitle("");
    setCompany("");
    setUrl("");
    showToast("Job saved");
  }

  async function applyPrep(job: Job) {
    try {
      await navigator.clipboard.writeText(coverLetter);
      window.open(job.url, "_blank", "noopener,noreferrer");
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: j.status === "saved" ? "applied" : j.status,
                appliedAt: j.appliedAt || new Date().toISOString(),
              }
            : j,
        ),
      );
      showToast("Cover letter copied — job opened");
    } catch {
      showToast("Could not copy — check clipboard permission");
    }
  }

  function updateStatus(id: string, status: JobStatus) {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? {
              ...j,
              status,
              appliedAt:
                status === "applied" && !j.appliedAt
                  ? new Date().toISOString()
                  : j.appliedAt,
            }
          : j,
      ),
    );
  }

  function removeJob(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    showToast("Job removed");
  }

  function resetLetter() {
    setCoverLetter(DEFAULT_COVER_LETTER);
    showToast("Cover letter reset");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-mesh" aria-hidden />

      <header className="relative border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 py-7 sm:px-8">
          <div>
            <p className="font-display text-4xl tracking-tight text-[var(--ink)] sm:text-5xl">
              Apply Hub
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              Save openings from OnlineJobs.ph, Indeed, and JobStreet. One click
              copies your cover letter and opens the job page so you can apply
              yourself.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
            <span className="rounded-sm bg-[var(--chip)] px-3 py-2 text-[var(--ink)]">
              {stats.total} saved
            </span>
            <span className="rounded-sm bg-[var(--chip)] px-3 py-2">
              {stats.applied} applied
            </span>
            <span className="rounded-sm bg-[var(--accent-soft)] px-3 py-2 text-[var(--accent)]">
              {stats.replied} replied
            </span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <nav className="flex gap-1 rounded-sm bg-[var(--chip)] p-1">
            <button
              type="button"
              onClick={() => setPanel("jobs")}
              className={`flex-1 rounded-sm px-3 py-2 text-sm font-medium transition ${
                panel === "jobs"
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Add jobs
            </button>
            <button
              type="button"
              onClick={() => setPanel("letter")}
              className={`flex-1 rounded-sm px-3 py-2 text-sm font-medium transition ${
                panel === "letter"
                  ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              Cover letter
            </button>
          </nav>

          {panel === "jobs" ? (
            <form
              onSubmit={addJob}
              className="space-y-3 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <h2 className="font-display text-xl text-[var(--ink)]">New opening</h2>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Job title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="WordPress Developer"
                  className="field"
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Company
                </span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Optional"
                  className="field"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Job URL
                </span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://v2.onlinejobs.ph/job/..."
                  className="field"
                  type="url"
                  required
                />
              </label>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                Source and tags are detected from the URL and title. Paste any
                listing link from OnlineJobs, Indeed, or JobStreet.
              </p>
              <button type="submit" className="btn-primary w-full">
                Save job
              </button>
            </form>
          ) : (
            <div className="space-y-3 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl text-[var(--ink)]">
                  Cover letter
                </h2>
                <button type="button" onClick={resetLetter} className="btn-ghost text-xs">
                  Reset
                </button>
              </div>
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={18}
                className="field min-h-[280px] resize-y font-mono text-[12px] leading-relaxed"
              />
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(coverLetter);
                  showToast("Cover letter copied");
                }}
              >
                Copy letter only
              </button>
            </div>
          )}

          <div className="rounded-sm border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--ink)]">Quick search links</p>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  className="link"
                  href="https://v2.onlinejobs.ph/jobs?q=wordpress"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OnlineJobs · WordPress
                </a>
              </li>
              <li>
                <a
                  className="link"
                  href="https://v2.onlinejobs.ph/jobs?q=web+developer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OnlineJobs · Web Developer
                </a>
              </li>
              <li>
                <a
                  className="link"
                  href="https://ph.indeed.com/jobs?q=wordpress+developer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Indeed · WordPress
                </a>
              </li>
              <li>
                <a
                  className="link"
                  href="https://www.jobstreet.com.ph/wordpress-jobs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  JobStreet · WordPress
                </a>
              </li>
            </ul>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-sm border border-[var(--line)] bg-[var(--surface)] p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, company, URL…"
              className="field min-w-[180px] flex-1"
            />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as JobSource | "all")}
              className="field w-auto"
            >
              <option value="all">All sources</option>
              <option value="onlinejobs">OnlineJobs.ph</option>
              <option value="indeed">Indeed</option>
              <option value="jobstreet">JobStreet</option>
              <option value="other">Other</option>
            </select>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value as JobTag | "all")}
              className="field w-auto"
            >
              <option value="all">All tags</option>
              <option value="wordpress">WordPress</option>
              <option value="web-developer">Web Developer</option>
              <option value="fullstack">Fullstack</option>
              <option value="other">Other</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as JobStatus | "all")}
              className="field w-auto"
            >
              <option value="all">All statuses</option>
              <option value="saved">Saved</option>
              <option value="applied">Applied</option>
              <option value="replied">Replied</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-sm border border-dashed border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)] px-6 py-16 text-center">
              <p className="font-display text-2xl text-[var(--ink)]">No jobs yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
                Open a search link, copy a job URL, paste it on the left, then use
                Apply prep to copy your letter and jump to the application form.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((job) => (
                <li
                  key={job.id}
                  className="job-row group rounded-sm border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="source-pill">{SOURCE_LABELS[job.source]}</span>
                        {job.tags.map((tag) => (
                          <span key={tag} className="tag-pill">
                            {TAG_LABELS[tag]}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-2 font-display text-xl leading-snug text-[var(--ink)]">
                        {job.title}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">{job.company}</p>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block max-w-full truncate text-xs text-[var(--accent)] hover:underline"
                      >
                        {job.url}
                      </a>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end">
                      <select
                        value={job.status}
                        onChange={(e) =>
                          updateStatus(job.id, e.target.value as JobStatus)
                        }
                        className="field w-auto text-sm"
                        aria-label="Status"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => applyPrep(job)}
                        className="btn-primary"
                      >
                        Apply prep
                      </button>
                      <button
                        type="button"
                        onClick={() => removeJob(job.id)}
                        className="btn-ghost text-xs text-[var(--danger)]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-sm bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--surface)] shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
