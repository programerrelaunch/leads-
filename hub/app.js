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
  autoRefresh: false,
  lastSearchedAt: null,
};

let autoTimer = null;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
    if (parsed.searchSources) state.searchSources = { ...state.searchSources, ...parsed.searchSources };
    if (typeof parsed.autoRefresh === "boolean") state.autoRefresh = parsed.autoRefresh;
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
    }),
  );
}

function showToast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => {
    state.toast = null;
    render();
  }, 2200);
}

function filteredJobs() {
  const q = state.query.trim().toLowerCase();
  return state.jobs
    .filter((j) => (state.filterSource === "all" ? true : j.source === state.filterSource))
    .filter((j) => (state.filterStatus === "all" ? true : j.status === state.filterStatus))
    .filter((j) => (state.filterTag === "all" ? true : j.tags.includes(state.filterTag)))
    .filter((j) => {
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.url.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function isSaved(url) {
  return state.jobs.some((j) => j.url === url);
}

function saveJobFromResult(result, silent = false) {
  if (isSaved(result.url)) {
    if (!silent) showToast("Already saved");
    return false;
  }
  state.jobs.unshift({
    id: uid(),
    title: result.title,
    company: result.company || "Unknown",
    url: result.url,
    source: result.source || detectSource(result.url),
    tags: result.tags?.length ? result.tags : suggestTags(result.title),
    status: "saved",
    notes: "",
    createdAt: new Date().toISOString(),
  });
  save();
  if (!silent) showToast("Job saved");
  return true;
}

async function applyPrep(job) {
  try {
    await navigator.clipboard.writeText(state.coverLetter);
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
    showToast("Cover letter copied — job opened");
  } catch {
    showToast("Could not copy — check clipboard permission");
  }
}

async function applyPrepFromResult(result) {
  saveJobFromResult(result, true);
  const job = state.jobs.find((j) => j.url === result.url);
  if (job) await applyPrep(job);
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

  state.searchLoading = true;
  state.panel = "search";
  render();

  try {
    const params = new URLSearchParams({
      q,
      sources: sources.join(","),
    });
    const res = await fetch(`/api/search?${params.toString()}`);
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const data = await res.json();
    state.searchResults = Array.isArray(data.jobs) ? data.jobs : [];
    state.searchErrors = data.errors || {};
    state.searchMeta = {
      count: data.count || state.searchResults.length,
      searchedAt: data.searchedAt || new Date().toISOString(),
    };
    state.lastSearchedAt = state.searchMeta.searchedAt;
    save();
    if (!silent) {
      showToast(`Found ${state.searchResults.length} active posts`);
    } else {
      render();
    }
  } catch (err) {
    state.searchErrors = { all: err.message || String(err) };
    if (!silent) showToast("Auto-search failed — try again");
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

function renderSearchPanel() {
  const errors = Object.entries(state.searchErrors || {});
  return `
    <form class="panel" id="search-form">
      <h2 class="font-display" style="margin:0 0 0.75rem;font-size:1.25rem">Auto search</h2>
      <p class="hint">Pulls active listings from OnlineJobs.ph, Indeed, and JobStreet. Save or Apply prep from the results.</p>
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
        <input type="checkbox" id="auto-refresh" ${state.autoRefresh ? "checked" : ""} />
        <span>Auto-refresh every 10 minutes</span>
      </label>
      <button class="btn-primary" type="submit" ${state.searchLoading ? "disabled" : ""}>
        ${state.searchLoading ? "Searching…" : "Search active jobs"}
      </button>
      ${
        state.searchMeta
          ? `<p class="hint" style="margin-top:0.75rem;margin-bottom:0">Last search: ${escapeHtml(
              new Date(state.searchMeta.searchedAt).toLocaleString(),
            )} · ${state.searchMeta.count} results</p>`
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
        <h2 class="font-display">Searching boards…</h2>
        <p>Checking OnlineJobs.ph, Indeed, and JobStreet for active posts.</p>
      </div>`;
  }

  if (!state.searchResults.length) {
    return `
      <div class="empty">
        <h2 class="font-display">No search results yet</h2>
        <p>Run Auto search for WordPress or web developer roles. New matches appear here so you can save or Apply prep in one click.</p>
      </div>`;
  }

  return `
    <div class="results-toolbar">
      <p class="font-display" style="margin:0;font-size:1.25rem">${state.searchResults.length} active posts</p>
      <button type="button" class="btn-secondary" id="save-all-results" style="width:auto">Save all new</button>
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
                ${(job.tags || []).map((t) => `<span class="tag-pill">${TAG_LABELS[t] || t}</span>`).join("")}
                ${saved ? `<span class="tag-pill">Saved</span>` : ""}
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
  return `
    <div class="filters">
      <input class="field" id="query" placeholder="Filter saved jobs…" value="${escapeHtml(state.query)}" />
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
        <h2 class="font-display">No saved jobs</h2>
        <p>Use Auto search, then Save or Apply prep to track openings here.</p>
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
            Auto-search active WordPress and web developer posts from OnlineJobs.ph,
            Indeed, and JobStreet — then Apply prep in one click.
          </p>
        </div>
        <div class="stats">
          <span class="stat ink">${stats.total} saved</span>
          <span class="stat">${stats.applied} applied</span>
          <span class="stat accent">${stats.replied} replied</span>
        </div>
      </div>
    </header>
    <main>
      <aside>
        <div class="tabs">
          <button type="button" data-panel="search" class="${state.panel === "search" ? "active" : ""}">Auto search</button>
          <button type="button" data-panel="jobs" class="${state.panel === "jobs" ? "active" : ""}">Manual add</button>
          <button type="button" data-panel="letter" class="${state.panel === "letter" ? "active" : ""}">Cover letter</button>
        </div>
        ${
          state.panel === "search"
            ? renderSearchPanel()
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
              <input class="field" name="url" type="url" placeholder="https://v2.onlinejobs.ph/job/..." required />
            </label>
            <p class="hint">Source and tags are detected from the URL and title.</p>
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
        <div class="section-label font-display">Saved applications</div>
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

  const autoRefresh = document.getElementById("auto-refresh");
  if (autoRefresh) {
    autoRefresh.addEventListener("change", () => {
      state.autoRefresh = autoRefresh.checked;
      save();
      syncAutoRefresh();
      showToast(state.autoRefresh ? "Auto-refresh on" : "Auto-refresh off");
    });
  }

  document.getElementById("save-all-results")?.addEventListener("click", () => {
    let added = 0;
    for (const result of state.searchResults) {
      if (saveJobFromResult(result, true)) added += 1;
    }
    showToast(added ? `Saved ${added} new jobs` : "No new jobs to save");
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
      state.jobs.unshift({
        id: uid(),
        title,
        company: company || "Unknown",
        url,
        source: detectSource(url),
        tags: suggestTags(title),
        status: "saved",
        notes: "",
        createdAt: new Date().toISOString(),
      });
      save();
      showToast("Job saved");
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
      showToast("Job removed");
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

// Kick off an initial search so the board isn't empty on first visit.
if (!state.searchResults.length) {
  runAutoSearch({ silent: true });
}
