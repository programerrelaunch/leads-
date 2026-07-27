const STORAGE_KEY = "apply-hub-v1";

const DEFAULT_COVER_LETTER = `Dear Sir/Madam,

With a proven track record of successful achievements, I am pleased to submit my application for your consideration as a fullstack / Web Developer.

I have several years of experience in the industry and have worked extensively with a U.S.-based company, giving me a strong understanding of industry standards and best practices. By leveraging cutting-edge development tools like Cursor AI and Claude, I am able to significantly streamline my workflow, optimize code efficiency, and accelerate project delivery. I am confident that this blend of foundational experience and modern AI-assisted development will allow me to make an immediate, significant contribution to your team.

My web development expertise includes:

Core Development: Extensive knowledge of WordPress CMS, PHP, HTML5, CSS3, jQuery, and MySQL, Vue, React JS, Gatsby, Next.js.

AI-Driven Workflows: Advanced proficiency in utilizing Cursor AI and Claude for rapid prototyping, intelligent code refactoring, and efficient troubleshooting.

E-Commerce & Scale: Designing, building, and maintaining robust eCommerce websites.

Client & Project Management: Communicating directly with clients to gather complex requirements and deliver tailored digital solutions.

You can view my resume through my online portfolio:
https://ryan-digital.vercel.app

My OnlineJobs.ph profile:
https://www.onlinejobs.ph/jobseekers/info/166491

GitHub Link:
https://github.com/ryanhandsome200-glitch

Here are some recent projects I've built or contributed to:
sweetspotbaseball.com
wau.edu
olivetreeviews.org
store.olivetreeviews.org
teamallied.co
brazosfp.com
blackbeards.com
cascadecustomrx.com
centralmusicii.com
deschutesdentalcenter.com
cmxtravel.com
ham-engr.com

DIVI Theme Conversions:
https://accelptme.com/
ogreading.percdigital.com
ksiswiss.com

I possess excellent communication skills and can collaborate effectively with both clients and teammates. I'm highly adaptable, self-motivated, and able to manage multiple projects under pressure while meeting tight deadlines.

Thank you for your time and consideration. I look forward to the opportunity to discuss how my technical skills and modern development approach can benefit your team.

Sincerely,
Ryan Barroga`;

const SOURCE_LABELS = {
  onlinejobs: "OnlineJobs.ph",
  indeed: "Indeed",
  jobstreet: "JobStreet",
  other: "Other",
};

const TAG_LABELS = {
  wordpress: "WordPress",
  "web-developer": "Web Developer",
  fullstack: "Fullstack",
  other: "Other",
};

const STATUS_LABELS = {
  saved: "Saved",
  applied: "Applied",
  replied: "Replied",
  closed: "Closed",
};

const PRESET_QUERIES = [
  "wordpress developer",
  "web developer",
  "fullstack developer",
  "wordpress",
];

const state = {
  coverLetter: DEFAULT_COVER_LETTER,
  jobs: [],
  panel: "search",
  query: "",
  filterSource: "all",
  filterTag: "all",
  filterStatus: "all",
  toast: null,
  searchQuery: "wordpress developer",
  searchSources: {
    onlinejobs: true,
    indeed: true,
    jobstreet: true,
  },
  searchResults: [],
  searchErrors: {},
  searchLoading: false,
  searchMeta: null,
  autoRefresh: true,
  lastSearchedAt: null,
  autoSaveFeed: true,
  skipApplied: true,
  appliedUrls: [],
  accounts: {
    onlinejobs: { email: "", password: "" },
  },
  syncLoading: false,
  lastAppliedSync: null,
};

let autoTimer = null;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeJobUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "v2.onlinejobs.ph") host = "onlinejobs.ph";
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return String(url || "").trim().toLowerCase();
  }
}

function isAlreadyApplied(url) {
  const key = normalizeJobUrl(url);
  if (state.appliedUrls.some((u) => normalizeJobUrl(u) === key)) return true;
  return state.jobs.some(
    (j) =>
      normalizeJobUrl(j.url) === key &&
      ["applied", "replied", "closed"].includes(j.status),
  );
}

function markAppliedUrls(urls) {
  const set = new Set(state.appliedUrls.map(normalizeJobUrl));
  let added = 0;
  for (const url of urls) {
    const key = normalizeJobUrl(url);
    if (!key || set.has(key)) continue;
    set.add(key);
    state.appliedUrls.push(url);
    added += 1;
  }

  for (const url of urls) {
    const existing = state.jobs.find(
      (j) => normalizeJobUrl(j.url) === normalizeJobUrl(url),
    );
    if (existing) {
      if (existing.status === "saved") existing.status = "applied";
      existing.appliedAt = existing.appliedAt || new Date().toISOString();
    }
  }
  save();
  return added;
}

function filterNewJobs(jobs) {
  if (!state.skipApplied) return jobs || [];
  return (jobs || []).filter((j) => !isAlreadyApplied(j.url));
}

function detectSource(url) {
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

function suggestTags(title) {
  if (window.ApplyHubScraper?.suggestTags) {
    return window.ApplyHubScraper.suggestTags(title);
  }
  const t = title.toLowerCase();
  const tags = [];
  if (/wordpress|wp\b|divi|woocommerce/.test(t)) tags.push("wordpress");
  if (/web\s*dev|frontend|front-end|backend|back-end|full\s*stack|fullstack/.test(t)) {
    tags.push("web-developer");
  }
  if (/full\s*stack|fullstack/.test(t)) tags.push("fullstack");
  if (!tags.length) tags.push("other");
  return [...new Set(tags)];
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.coverLetter = parsed.coverLetter || DEFAULT_COVER_LETTER;
    state.jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    if (parsed.searchQuery) state.searchQuery = parsed.searchQuery;
    if (parsed.searchSources) {
      state.searchSources = { ...state.searchSources, ...parsed.searchSources };
    }
    if (typeof parsed.autoRefresh === "boolean") state.autoRefresh = parsed.autoRefresh;
    if (typeof parsed.autoSaveFeed === "boolean") state.autoSaveFeed = parsed.autoSaveFeed;
    if (typeof parsed.skipApplied === "boolean") state.skipApplied = parsed.skipApplied;
    if (parsed.lastSearchedAt) state.lastSearchedAt = parsed.lastSearchedAt;
    if (parsed.lastAppliedSync) state.lastAppliedSync = parsed.lastAppliedSync;
    if (Array.isArray(parsed.searchResults)) state.searchResults = parsed.searchResults;
    if (Array.isArray(parsed.appliedUrls)) state.appliedUrls = parsed.appliedUrls;
    if (parsed.accounts?.onlinejobs) {
      state.accounts.onlinejobs = {
        email: parsed.accounts.onlinejobs.email || "",
        password: parsed.accounts.onlinejobs.password || "",
      };
    }
  } catch {
    /* ignore */
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      coverLetter: state.coverLetter,
      jobs: state.jobs,
      searchQuery: state.searchQuery,
      searchSources: state.searchSources,
      autoRefresh: state.autoRefresh,
      autoSaveFeed: state.autoSaveFeed,
      skipApplied: state.skipApplied,
      lastSearchedAt: state.lastSearchedAt,
      lastAppliedSync: state.lastAppliedSync,
      searchResults: state.searchResults,
      appliedUrls: state.appliedUrls,
      accounts: {
        onlinejobs: {
          email: state.accounts.onlinejobs.email || "",
          password: state.accounts.onlinejobs.password || "",
        },
      },
      savedAt: new Date().toISOString(),
    }),
  );
}

function showToast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => {
    state.toast = null;
    render();
  }, 2400);
}

function filteredJobs() {
  const q = state.query.trim().toLowerCase();
  return state.jobs
    .filter((j) => (state.filterSource === "all" ? true : j.source === state.filterSource))
    .filter((j) => {
      if (state.filterStatus === "all") {
        // When skipping applied, only show open (Saved) jobs in the main list
        if (state.skipApplied) return j.status === "saved";
        return true;
      }
      return j.status === state.filterStatus;
    })
    .filter((j) => (state.filterTag === "all" ? true : j.tags.includes(state.filterTag)))
    .filter((j) => {
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.url.toLowerCase().includes(q)
      );
    })
    .filter((j) => (state.skipApplied ? !isAlreadyApplied(j.url) || state.filterStatus === "applied" : true))
    .sort((a, b) =>
      (b.scrapedAt || b.createdAt || "").localeCompare(a.scrapedAt || a.createdAt || ""),
    );
}

function isSaved(url) {
  return state.jobs.some((j) => j.url === url);
}

function mergeFeedIntoBrowser(results) {
  let added = 0;
  const byUrl = new Map(state.jobs.map((j) => [j.url, j]));

  for (const result of results) {
    const existing = byUrl.get(result.url);
    if (existing) {
      existing.title = result.title || existing.title;
      existing.company = result.company || existing.company;
      existing.tags = result.tags?.length ? result.tags : existing.tags;
      existing.source = result.source || existing.source;
      existing.scrapedAt = result.scrapedAt || new Date().toISOString();
    } else {
      const job = {
        id: uid(),
        title: result.title,
        company: result.company || "Unknown",
        url: result.url,
        source: result.source || detectSource(result.url),
        tags: result.tags?.length ? result.tags : suggestTags(result.title),
        status: "saved",
        notes: "",
        createdAt: new Date().toISOString(),
        scrapedAt: result.scrapedAt || new Date().toISOString(),
      };
      state.jobs.unshift(job);
      byUrl.set(job.url, job);
      added += 1;
    }
  }

  save();
  return { added };
}

function saveJobFromResult(result, silent = false) {
  const before = state.jobs.length;
  mergeFeedIntoBrowser([result]);
  const added = state.jobs.length > before;
  if (!silent) showToast(added ? "Saved to browser" : "Already in browser data");
  return added;
}

async function applyPrep(job, { quiet = false } = {}) {
  try {
    if (!quiet) {
      await navigator.clipboard.writeText(state.coverLetter);
    }
    window.open(job.url, "_blank", "noopener,noreferrer");
    state.jobs = state.jobs.map((j) =>
      j.id === job.id
        ? {
            ...j,
            status: j.status === "saved" ? "applied" : j.status,
            appliedAt: j.appliedAt || new Date().toISOString(),
          }
        : j,
    );
    save();
    if (!quiet) showToast("Cover letter copied — job opened");
    markAppliedUrls([job.url]);
  } catch {
    if (!quiet) showToast("Could not copy — check clipboard permission");
  }
}

async function applyPrepFromResult(result) {
  mergeFeedIntoBrowser([result]);
  const job = state.jobs.find((j) => j.url === result.url);
  if (job) await applyPrep(job);
}

function getApplyAllCandidates(from = "saved") {
  if (from === "results") {
    // Use what's on screen, but skip already-applied
    return (state.searchResults || []).filter((j) => j?.url && !isAlreadyApplied(j.url));
  }
  // Same rule as the "ready to apply" counter: status Saved in current filters
  return filteredJobs().filter((j) => j.status === "saved");
}

/**
 * One-click apply prep for many jobs: copies the same cover letter once,
 * opens each listing, and marks them applied in browser storage.
 * (You still paste/submit on each site — boards block true auto-submit.)
 */
async function applyToAll(jobs, { confirmLarge = true } = {}) {
  const list = (jobs || []).filter((j) => j && j.url);
  if (!list.length) {
    const savedCount = filteredJobs().filter((j) => j.status === "saved").length;
    const resultsCount = (state.searchResults || []).length;
    const appliedTracked = state.appliedUrls.length;
    if (resultsCount > 0 || savedCount === 0) {
      showToast(
        appliedTracked
          ? "Nothing left to apply — these jobs are already marked applied. Scrape again or clear Applied filter."
          : "No jobs ready to apply. Scrape live jobs first (status must be Saved).",
      );
    } else {
      showToast("No Saved jobs in the current filter to apply to");
    }
    return;
  }

  if (confirmLarge && list.length > 12) {
    const ok = window.confirm(
      `Apply prep to ${list.length} jobs with the same cover letter?\n\nThis will copy your letter once and open ${list.length} tabs. Paste the letter on each application form.`,
    );
    if (!ok) return;
  }

  try {
    await navigator.clipboard.writeText(state.coverLetter);
  } catch {
    showToast("Could not copy cover letter — check clipboard permission");
    return;
  }

  // Ensure scrape results exist in browser storage first
  mergeFeedIntoBrowser(
    list.map((j) => ({
      title: j.title,
      company: j.company,
      url: j.url,
      source: j.source,
      tags: j.tags,
      scrapedAt: j.scrapedAt || new Date().toISOString(),
    })),
  );

  const urls = [...new Set(list.map((j) => j.url))];
  let opened = 0;
  for (const url of urls) {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) opened += 1;
  }

  const now = new Date().toISOString();
  state.jobs = state.jobs.map((j) =>
    urls.some((url) => normalizeJobUrl(url) === normalizeJobUrl(j.url))
      ? {
          ...j,
          status: "applied",
          appliedAt: j.appliedAt || now,
        }
      : j,
  );
  markAppliedUrls(urls);
  // Keep results list in sync so Apply to all doesn't target stale rows
  state.searchResults = filterNewJobs(state.searchResults);
  save();
  showToast(
    opened
      ? `Cover letter copied · opened ${opened}/${urls.length} jobs — paste the same letter on each form`
      : `Cover letter copied · ${urls.length} marked applied, but the browser blocked pop-ups. Allow pop-ups and try again.`,
  );
  render();
}

async function syncOnlineJobsApplied() {
  const email = state.accounts.onlinejobs.email.trim();
  const password = state.accounts.onlinejobs.password;
  if (!email || !password) {
    showToast("Enter OnlineJobs email and password first");
    return;
  }

  state.syncLoading = true;
  render();
  try {
    const res = await fetch("/api/applied", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "onlinejobs",
        email,
        password,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Sync failed (${res.status})`);
    }
    const urls = (data.applied || []).map((j) => j.url).filter(Boolean);
    const added = markAppliedUrls(urls);

    // Upsert applied jobs into browser list
    for (const job of data.applied || []) {
      if (!job.url) continue;
      const existing = state.jobs.find(
        (j) => normalizeJobUrl(j.url) === normalizeJobUrl(job.url),
      );
      if (existing) {
        existing.status = "applied";
        existing.appliedAt = existing.appliedAt || new Date().toISOString();
        existing.title = job.title || existing.title;
      } else {
        state.jobs.unshift({
          id: uid(),
          title: job.title || "Applied OnlineJobs role",
          company: "OnlineJobs.ph employer",
          url: job.url,
          source: "onlinejobs",
          tags: suggestTags(job.title || ""),
          status: "applied",
          notes: "Synced from OnlineJobs account",
          createdAt: new Date().toISOString(),
          appliedAt: new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
        });
      }
    }
    state.lastAppliedSync = data.syncedAt || new Date().toISOString();
    state.searchResults = filterNewJobs(state.searchResults);
    save();
    showToast(
      `Synced ${urls.length} applied OnlineJobs posts · ${added} new marked applied`,
    );
  } catch (err) {
    showToast(err.message || "Applied sync failed");
  } finally {
    state.syncLoading = false;
    render();
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function selectedSources() {
  return Object.entries(state.searchSources)
    .filter(([, on]) => on)
    .map(([key]) => key);
}

async function runAutoSearch({ silent = false } = {}) {
  const q = state.searchQuery.trim();
  const sources = selectedSources();
  if (!q) {
    if (!silent) showToast("Enter a search keyword");
    return;
  }
  if (!sources.length) {
    if (!silent) showToast("Select at least one source");
    return;
  }
  if (!window.ApplyHubScraper?.scrapeJobs) {
    if (!silent) showToast("Scraper failed to load");
    return;
  }

  state.searchLoading = true;
  state.panel = "search";
  render();

  try {
    const data = await window.ApplyHubScraper.scrapeJobs({
      query: q,
      sources,
      email: state.accounts.onlinejobs.email || "",
      password: state.accounts.onlinejobs.password || "",
      knownAppliedUrls: state.appliedUrls || [],
      skipApplied: state.skipApplied,
    });
    const rawJobs = Array.isArray(data.jobs) ? data.jobs : [];
    const siteApplied = Array.isArray(data.appliedDetected) ? data.appliedDetected : [];
    if (siteApplied.length) {
      markAppliedUrls(siteApplied.map((j) => j.url).filter(Boolean));
    }
    const skipped =
      (data.skippedApplied || siteApplied.length || 0) +
      rawJobs.filter((j) => isAlreadyApplied(j.url)).length;
    state.searchResults = filterNewJobs(rawJobs);
    state.searchErrors = data.errors || {};
    state.searchMeta = {
      count: state.searchResults.length,
      scraped: rawJobs.length + siteApplied.length,
      skippedApplied: skipped,
      authenticated: Boolean(data.authenticated),
      searchedAt: data.searchedAt || new Date().toISOString(),
    };
    state.lastSearchedAt = state.searchMeta.searchedAt;

    let merged = { added: 0 };
    if (state.autoSaveFeed && state.searchResults.length) {
      merged = mergeFeedIntoBrowser(state.searchResults);
    } else {
      save();
    }

    if (!silent) {
      const authNote = data.authenticated ? " · logged into OnlineJobs" : "";
      showToast(
        `Found ${state.searchResults.length} open jobs · skipped ${skipped} already applied${authNote}`,
      );
    } else {
      render();
    }
  } catch (err) {
    state.searchErrors = { all: err.message || String(err) };
    if (!silent) showToast("Scrape failed — try again");
    else render();
  } finally {
    state.searchLoading = false;
    render();
  }
}

function syncAutoRefresh() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  if (state.autoRefresh) {
    autoTimer = setInterval(() => {
      runAutoSearch({ silent: true });
    }, 10 * 60 * 1000);
  }
}

function renderAccountsPanel() {
  const email = state.accounts.onlinejobs.email || "";
  const password = state.accounts.onlinejobs.password || "";
  return `
    <form class="panel" id="accounts-form">
      <h2 class="font-display" style="margin:0 0 0.75rem;font-size:1.25rem">Account sync</h2>
      <p class="hint">
        Save OnlineJobs.ph login, then sync or scrape. The app detects jobs marked
        <strong>Applied</strong> / <strong>Date Applied</strong> on the listing site and hides them from open results.
      </p>
      <label>
        <span>OnlineJobs email</span>
        <input class="field" name="email" type="email" value="${escapeHtml(email)}" placeholder="you@email.com" required />
      </label>
      <label>
        <span>OnlineJobs password</span>
        <input class="field" name="password" type="password" value="${escapeHtml(password)}" placeholder="••••••••" required />
      </label>
      <p class="hint">Indeed / JobStreet applied detection uses this app’s local Applied status (Apply prep / Apply to all).</p>
      <button class="btn-primary" type="submit" ${state.syncLoading ? "disabled" : ""}>
        ${state.syncLoading ? "Syncing applied jobs…" : "Login & sync applied jobs"}
      </button>
      <button class="btn-secondary" type="button" id="clear-credentials" style="margin-top:0.5rem">
        Clear saved credentials
      </button>
      ${
        state.lastAppliedSync
          ? `<p class="hint" style="margin-top:0.75rem;margin-bottom:0">Last sync: ${escapeHtml(
              new Date(state.lastAppliedSync).toLocaleString(),
            )} · ${state.appliedUrls.length} applied URLs tracked</p>`
          : `<p class="hint" style="margin-top:0.75rem;margin-bottom:0">${state.appliedUrls.length} applied URLs tracked locally</p>`
      }
    </form>
  `;
}

function renderSearchPanel() {
  const errors = Object.entries(state.searchErrors || {});
  return `
    <form class="panel" id="search-form">
      <h2 class="font-display" style="margin:0 0 0.75rem;font-size:1.25rem">Live scrape</h2>
      <p class="hint">Standalone scraper pulls live posts from OnlineJobs.ph, Indeed, and JobStreet. With your OnlineJobs account saved, it detects the site’s <strong>Applied / Date Applied</strong> status and only shows jobs you haven’t applied to yet.</p>
      <label>
        <span>Keywords</span>
        <input class="field" name="q" value="${escapeHtml(state.searchQuery)}" placeholder="wordpress developer" required />
      </label>
      <div class="preset-row">
        ${PRESET_QUERIES.map(
          (p) =>
            `<button type="button" class="chip-btn preset-btn" data-preset="${escapeHtml(p)}">${escapeHtml(p)}</button>`,
        ).join("")}
      </div>
      <div class="source-checks">
        ${Object.keys(SOURCE_LABELS)
          .filter((k) => k !== "other")
          .map(
            (key) => `
          <label class="check">
            <input type="checkbox" data-source="${key}" ${state.searchSources[key] ? "checked" : ""} />
            <span>${SOURCE_LABELS[key]}</span>
          </label>`,
          )
          .join("")}
      </div>
      <label class="check auto-refresh">
        <input type="checkbox" id="auto-save-feed" ${state.autoSaveFeed ? "checked" : ""} />
        <span>Auto-save scraped jobs to browser storage</span>
      </label>
      <label class="check auto-refresh">
        <input type="checkbox" id="skip-applied" ${state.skipApplied ? "checked" : ""} />
        <span>Only show jobs I haven’t applied to yet (hide Applied / Date Applied)</span>
      </label>
      <label class="check auto-refresh">
        <input type="checkbox" id="auto-refresh" ${state.autoRefresh ? "checked" : ""} />
        <span>Auto-scrape every 10 minutes</span>
      </label>
      <button class="btn-primary" type="submit" ${state.searchLoading ? "disabled" : ""}>
        ${state.searchLoading ? "Scraping live feeds…" : "Scrape live jobs"}
      </button>
      ${
        state.searchMeta
          ? `<p class="hint" style="margin-top:0.75rem;margin-bottom:0">Last scrape: ${escapeHtml(
              new Date(state.searchMeta.searchedAt).toLocaleString(),
            )} · ${state.searchMeta.count} open · skipped ${state.searchMeta.skippedApplied || 0} already applied${
              state.searchMeta.authenticated ? " · OnlineJobs logged in" : ""
            } · ${state.jobs.filter((j) => j.status === "saved").length} saved open</p>`
          : ""
      }
      ${
        errors.length
          ? `<ul class="error-list">${errors
              .map(
                ([src, msg]) =>
                  `<li><strong>${escapeHtml(SOURCE_LABELS[src] || src)}</strong>: ${escapeHtml(msg)}</li>`,
              )
              .join("")}</ul>`
          : ""
      }
    </form>
  `;
}

function renderResults() {
  if (state.searchLoading && !state.searchResults.length) {
    return `
      <div class="empty">
        <h2 class="font-display">Scraping live feeds…</h2>
        <p>Fetching OnlineJobs.ph, Indeed, and JobStreet, then writing matches into browser storage.</p>
      </div>`;
  }

  if (!state.searchResults.length) {
    return `
      <div class="empty">
        <h2 class="font-display">No scrape results yet</h2>
        <p>Click <strong>Scrape live jobs</strong> to pull WordPress / web developer posts and save them locally in this browser.</p>
      </div>`;
  }

  return `
    <div class="results-toolbar">
      <p class="font-display" style="margin:0;font-size:1.25rem">${state.searchResults.length} live posts</p>
      <div class="toolbar-actions">
        <button type="button" class="btn-secondary" id="save-all-results" style="width:auto">Save all to browser</button>
        <button type="button" class="btn-primary" id="apply-all-results" style="width:auto">
          Apply to all (${getApplyAllCandidates("results").length})
        </button>
      </div>
    </div>
    <ul class="job-list">
      ${state.searchResults
        .map((job, idx) => {
          const saved = isSaved(job.url);
          return `
          <li class="card job">
            <div style="min-width:0;flex:1">
              <div class="pills">
                <span class="source-pill">${SOURCE_LABELS[job.source] || job.source}</span>
                ${(job.tags || [])
                  .map((t) => `<span class="tag-pill">${TAG_LABELS[t] || t}</span>`)
                  .join("")}
                ${saved ? `<span class="tag-pill">In browser</span>` : ""}
              </div>
              <h3 class="font-display">${escapeHtml(job.title)}</h3>
              <p class="company">${escapeHtml(job.company || "Unknown")}</p>
              <a class="job-url" href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(job.url)}</a>
            </div>
            <div class="actions">
              <button type="button" class="btn-primary result-apply" data-idx="${idx}">Apply prep</button>
              <button type="button" class="btn-secondary result-save" data-idx="${idx}" ${saved ? "disabled" : ""} style="width:auto">
                ${saved ? "Saved" : "Save"}
              </button>
            </div>
          </li>`;
        })
        .join("")}
    </ul>`;
}

function renderSavedSection() {
  const jobs = filteredJobs();
  const pending = getApplyAllCandidates("saved");
  return `
    <div class="results-toolbar saved-toolbar">
      <p class="hint" style="margin:0">${pending.length} ready to apply (status: Saved)</p>
      <button type="button" class="btn-primary" id="apply-all-saved" style="width:auto">
        Apply to all (${pending.length})
      </button>
    </div>
    <div class="filters">
      <input class="field" id="query" placeholder="Filter browser-saved jobs…" value="${escapeHtml(state.query)}" />
      <select class="field" id="filter-source">
        <option value="all">All sources</option>
        <option value="onlinejobs">OnlineJobs.ph</option>
        <option value="indeed">Indeed</option>
        <option value="jobstreet">JobStreet</option>
        <option value="other">Other</option>
      </select>
      <select class="field" id="filter-tag">
        <option value="all">All tags</option>
        <option value="wordpress">WordPress</option>
        <option value="web-developer">Web Developer</option>
        <option value="fullstack">Fullstack</option>
        <option value="other">Other</option>
      </select>
      <select class="field" id="filter-status">
        <option value="all">All statuses</option>
        <option value="saved">Saved</option>
        <option value="applied">Applied</option>
        <option value="replied">Replied</option>
        <option value="closed">Closed</option>
      </select>
    </div>
    ${
      jobs.length === 0
        ? `
      <div class="empty">
        <h2 class="font-display">Browser storage is empty</h2>
        <p>Run a live scrape — results are stored in localStorage on this device.</p>
      </div>`
        : `
      <ul class="job-list">
        ${jobs
          .map(
            (job) => `
          <li class="card job" data-id="${job.id}">
            <div style="min-width:0;flex:1">
              <div class="pills">
                <span class="source-pill">${SOURCE_LABELS[job.source]}</span>
                ${job.tags.map((t) => `<span class="tag-pill">${TAG_LABELS[t]}</span>`).join("")}
              </div>
              <h3 class="font-display">${escapeHtml(job.title)}</h3>
              <p class="company">${escapeHtml(job.company)}</p>
              <a class="job-url" href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(job.url)}</a>
            </div>
            <div class="actions">
              <select class="field status-select" data-id="${job.id}">
                ${Object.entries(STATUS_LABELS)
                  .map(
                    ([value, label]) =>
                      `<option value="${value}" ${job.status === value ? "selected" : ""}>${label}</option>`,
                  )
                  .join("")}
              </select>
              <button type="button" class="btn-primary apply-btn" data-id="${job.id}">Apply prep</button>
              <button type="button" class="btn-ghost danger remove-btn" data-id="${job.id}">Remove</button>
            </div>
          </li>`,
          )
          .join("")}
      </ul>`
    }`;
}

function render() {
  const stats = {
    total: state.jobs.length,
    applied: state.jobs.filter((j) => j.status === "applied").length,
    replied: state.jobs.filter((j) => j.status === "replied").length,
  };

  const app = document.getElementById("app");
  app.innerHTML = `
    <header>
      <div class="header-inner">
        <div>
          <p class="brand font-display">Apply Hub</p>
          <p class="lede">
            Standalone web app: scrape live WordPress / web developer feeds from
            OnlineJobs.ph, Indeed, and JobStreet, store them in your browser, then Apply prep in one click.
          </p>
        </div>
        <div class="stats">
          <span class="stat ink">${stats.total} in browser</span>
          <span class="stat">${stats.applied} applied</span>
          <span class="stat accent">${stats.replied} replied</span>
        </div>
      </div>
    </header>
    <main>
      <aside>
        <div class="tabs">
          <button type="button" data-panel="search" class="${state.panel === "search" ? "active" : ""}">Live scrape</button>
          <button type="button" data-panel="accounts" class="${state.panel === "accounts" ? "active" : ""}">Account</button>
          <button type="button" data-panel="jobs" class="${state.panel === "jobs" ? "active" : ""}">Manual add</button>
          <button type="button" data-panel="letter" class="${state.panel === "letter" ? "active" : ""}">Cover letter</button>
        </div>
        ${
          state.panel === "search"
            ? renderSearchPanel()
            : state.panel === "accounts"
              ? renderAccountsPanel()
            : state.panel === "jobs"
              ? `
          <form class="panel" id="add-form">
            <h2 class="font-display" style="margin:0 0 0.75rem;font-size:1.25rem">New opening</h2>
            <label>
              <span>Job title</span>
              <input class="field" name="title" placeholder="WordPress Developer" required />
            </label>
            <label>
              <span>Company</span>
              <input class="field" name="company" placeholder="Optional" />
            </label>
            <label>
              <span>Job URL</span>
              <input class="field" name="url" type="url" placeholder="https://www.onlinejobs.ph/jobseekers/job/..." required />
            </label>
            <p class="hint">Also stored in this browser’s local data.</p>
            <button class="btn-primary" type="submit">Save job</button>
          </form>`
              : `
          <div class="panel">
            <div class="row-between">
              <h2 class="font-display">Cover letter</h2>
              <button type="button" class="btn-ghost" id="reset-letter">Reset</button>
            </div>
            <textarea class="field" id="cover-letter">${escapeHtml(state.coverLetter)}</textarea>
            <div style="height:0.75rem"></div>
            <button type="button" class="btn-secondary" id="copy-letter">Copy letter only</button>
          </div>`
        }
      </aside>
      <section class="space-y">
        ${state.panel === "search" ? renderResults() : ""}
        <div class="section-label font-display">Browser-saved jobs</div>
        ${renderSavedSection()}
      </section>
    </main>
    ${state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""}
  `;

  const filterSource = document.getElementById("filter-source");
  const filterTag = document.getElementById("filter-tag");
  const filterStatus = document.getElementById("filter-status");
  if (filterSource) filterSource.value = state.filterSource;
  if (filterTag) filterTag.value = state.filterTag;
  if (filterStatus) filterStatus.value = state.filterStatus;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.panel = btn.getAttribute("data-panel");
      render();
    });
  });

  const searchForm = document.getElementById("search-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(searchForm);
      state.searchQuery = String(data.get("q") || "").trim();
      save();
      runAutoSearch();
    });
  }

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.searchQuery = btn.getAttribute("data-preset") || state.searchQuery;
      save();
      render();
      runAutoSearch();
    });
  });

  document.querySelectorAll("[data-source]").forEach((input) => {
    input.addEventListener("change", () => {
      state.searchSources[input.getAttribute("data-source")] = input.checked;
      save();
    });
  });

  const autoSaveFeed = document.getElementById("auto-save-feed");
  if (autoSaveFeed) {
    autoSaveFeed.addEventListener("change", () => {
      state.autoSaveFeed = autoSaveFeed.checked;
      save();
    });
  }

  const skipApplied = document.getElementById("skip-applied");
  if (skipApplied) {
    skipApplied.addEventListener("change", () => {
      state.skipApplied = skipApplied.checked;
      save();
      showToast(
        state.skipApplied
          ? "Will skip already-applied jobs"
          : "Showing all scraped jobs",
      );
    });
  }

  const accountsForm = document.getElementById("accounts-form");
  if (accountsForm) {
    accountsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(accountsForm);
      state.accounts.onlinejobs.email = String(data.get("email") || "").trim();
      state.accounts.onlinejobs.password = String(data.get("password") || "");
      save();
      syncOnlineJobsApplied();
    });
  }

  document.getElementById("clear-credentials")?.addEventListener("click", () => {
    state.accounts.onlinejobs = { email: "", password: "" };
    save();
    showToast("Credentials cleared from this browser");
    render();
  });

  const autoRefresh = document.getElementById("auto-refresh");
  if (autoRefresh) {
    autoRefresh.addEventListener("change", () => {
      state.autoRefresh = autoRefresh.checked;
      save();
      syncAutoRefresh();
      showToast(state.autoRefresh ? "Auto-scrape on" : "Auto-scrape off");
    });
  }

  document.getElementById("save-all-results")?.addEventListener("click", () => {
    const { added } = mergeFeedIntoBrowser(state.searchResults);
    showToast(added ? `Saved ${added} new jobs to browser` : "All results already stored");
    render();
  });

  document.getElementById("apply-all-results")?.addEventListener("click", () => {
    applyToAll(getApplyAllCandidates("results"));
  });

  document.getElementById("apply-all-saved")?.addEventListener("click", () => {
    applyToAll(getApplyAllCandidates("saved"));
  });

  document.querySelectorAll(".result-save").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const result = state.searchResults[idx];
      if (result) saveJobFromResult(result);
    });
  });

  document.querySelectorAll(".result-apply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const result = state.searchResults[idx];
      if (result) applyPrepFromResult(result);
    });
  });

  const form = document.getElementById("add-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const title = String(data.get("title") || "").trim();
      const company = String(data.get("company") || "").trim();
      const url = String(data.get("url") || "").trim();
      if (!title || !url) {
        showToast("Title and URL are required");
        return;
      }
      mergeFeedIntoBrowser([
        {
          title,
          company: company || "Unknown",
          url,
          source: detectSource(url),
          tags: suggestTags(title),
          scrapedAt: new Date().toISOString(),
        },
      ]);
      showToast("Job saved to browser");
      render();
    });
  }

  const letter = document.getElementById("cover-letter");
  if (letter) {
    letter.addEventListener("change", () => {
      state.coverLetter = letter.value;
      save();
    });
    letter.addEventListener("blur", () => {
      state.coverLetter = letter.value;
      save();
    });
  }

  document.getElementById("reset-letter")?.addEventListener("click", () => {
    state.coverLetter = DEFAULT_COVER_LETTER;
    save();
    showToast("Cover letter reset");
  });

  document.getElementById("copy-letter")?.addEventListener("click", async () => {
    const value = document.getElementById("cover-letter")?.value ?? state.coverLetter;
    state.coverLetter = value;
    save();
    await navigator.clipboard.writeText(value);
    showToast("Cover letter copied");
  });

  document.getElementById("query")?.addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });
  document.getElementById("filter-source")?.addEventListener("change", (e) => {
    state.filterSource = e.target.value;
    render();
  });
  document.getElementById("filter-tag")?.addEventListener("change", (e) => {
    state.filterTag = e.target.value;
    render();
  });
  document.getElementById("filter-status")?.addEventListener("change", (e) => {
    state.filterStatus = e.target.value;
    render();
  });

  document.querySelectorAll(".apply-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const job = state.jobs.find((j) => j.id === btn.getAttribute("data-id"));
      if (job) applyPrep(job);
    });
  });

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.jobs = state.jobs.filter((j) => j.id !== btn.getAttribute("data-id"));
      save();
      showToast("Removed from browser storage");
    });
  });

  document.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const id = sel.getAttribute("data-id");
      state.jobs = state.jobs.map((j) =>
        j.id === id
          ? {
              ...j,
              status: sel.value,
              appliedAt:
                sel.value === "applied" && !j.appliedAt
                  ? new Date().toISOString()
                  : j.appliedAt,
            }
          : j,
      );
      save();
      render();
    });
  });
}

load();
render();
syncAutoRefresh();

if (!state.searchResults.length) {
  runAutoSearch({ silent: true });
}
