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

const state = {
  coverLetter: DEFAULT_COVER_LETTER,
  jobs: [],
  panel: "jobs",
  query: "",
  filterSource: "all",
  filterTag: "all",
  filterStatus: "all",
  toast: null,
};

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
  } catch {
    /* ignore */
  }
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ coverLetter: state.coverLetter, jobs: state.jobs }),
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

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  const stats = {
    total: state.jobs.length,
    applied: state.jobs.filter((j) => j.status === "applied").length,
    replied: state.jobs.filter((j) => j.status === "replied").length,
  };
  const jobs = filteredJobs();

  const app = document.getElementById("app");
  app.innerHTML = `
    <header>
      <div class="header-inner">
        <div>
          <p class="brand font-display">Apply Hub</p>
          <p class="lede">
            Save openings from OnlineJobs.ph, Indeed, and JobStreet. One click
            copies your cover letter and opens the job page so you can apply yourself.
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
          <button type="button" data-panel="jobs" class="${state.panel === "jobs" ? "active" : ""}">Add jobs</button>
          <button type="button" data-panel="letter" class="${state.panel === "letter" ? "active" : ""}">Cover letter</button>
        </div>
        ${
          state.panel === "jobs"
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
          </form>
        `
            : `
          <div class="panel">
            <div class="row-between">
              <h2 class="font-display">Cover letter</h2>
              <button type="button" class="btn-ghost" id="reset-letter">Reset</button>
            </div>
            <textarea class="field" id="cover-letter">${escapeHtml(state.coverLetter)}</textarea>
            <div style="height:0.75rem"></div>
            <button type="button" class="btn-secondary" id="copy-letter">Copy letter only</button>
          </div>
        `
        }
        <div class="panel links">
          <h3>Quick search links</h3>
          <ul>
            <li><a href="https://v2.onlinejobs.ph/jobs?q=wordpress" target="_blank" rel="noopener noreferrer">OnlineJobs · WordPress</a></li>
            <li><a href="https://v2.onlinejobs.ph/jobs?q=web+developer" target="_blank" rel="noopener noreferrer">OnlineJobs · Web Developer</a></li>
            <li><a href="https://ph.indeed.com/jobs?q=wordpress+developer" target="_blank" rel="noopener noreferrer">Indeed · WordPress</a></li>
            <li><a href="https://www.jobstreet.com.ph/wordpress-jobs" target="_blank" rel="noopener noreferrer">JobStreet · WordPress</a></li>
          </ul>
        </div>
      </aside>
      <section>
        <div class="filters">
          <input class="field" id="query" placeholder="Search title, company, URL…" value="${escapeHtml(state.query)}" />
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
            <h2 class="font-display">No jobs yet</h2>
            <p>Open a search link, copy a job URL, paste it on the left, then use Apply prep to copy your letter and jump to the application form.</p>
          </div>
        `
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
              </li>
            `,
              )
              .join("")}
          </ul>
        `
        }
      </section>
    </main>
    ${state.toast ? `<div class="toast" role="status">${escapeHtml(state.toast)}</div>` : ""}
  `;

  document.getElementById("filter-source").value = state.filterSource;
  document.getElementById("filter-tag").value = state.filterTag;
  document.getElementById("filter-status").value = state.filterStatus;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.panel = btn.getAttribute("data-panel");
      render();
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

  const reset = document.getElementById("reset-letter");
  if (reset) {
    reset.addEventListener("click", () => {
      state.coverLetter = DEFAULT_COVER_LETTER;
      save();
      showToast("Cover letter reset");
    });
  }

  const copy = document.getElementById("copy-letter");
  if (copy) {
    copy.addEventListener("click", async () => {
      const value = document.getElementById("cover-letter")?.value ?? state.coverLetter;
      state.coverLetter = value;
      save();
      await navigator.clipboard.writeText(value);
      showToast("Cover letter copied");
    });
  }

  document.getElementById("query").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });
  document.getElementById("filter-source").addEventListener("change", (e) => {
    state.filterSource = e.target.value;
    render();
  });
  document.getElementById("filter-tag").addEventListener("change", (e) => {
    state.filterTag = e.target.value;
    render();
  });
  document.getElementById("filter-status").addEventListener("change", (e) => {
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
