const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const API_BASE = "https://api.onlinejobs.ph";

function clean(text = "") {
  return String(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function suggestTags(title = "") {
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

function decodeHtml(html = "") {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

function looksApplied(block = "") {
  const text = String(block);
  return (
    /Date\s*Applied/i.test(text) ||
    /Already\s+Applied/i.test(text) ||
    />\s*Applied\s*</i.test(text) ||
    /class="[^"]*applied[^"]*"/i.test(text) ||
    /btn[^>]*>\s*Applied\s*</i.test(text)
  );
}

async function fetchText(url, extraHeaders = {}) {
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    ...extraHeaders,
  };

  const tryUrls = [
    url,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  let lastError = null;
  for (const candidate of tryUrls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(candidate, {
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = new Error(`Fetch failed ${res.status} for ${candidate}`);
        continue;
      }
      const text = await res.text();
      if (text && text.length > 800) return text;
      lastError = new Error(`Empty response for ${candidate}`);
    } catch (err) {
      lastError = err.name === "AbortError" ? new Error(`Timeout for ${candidate}`) : err;
    }
  }
  throw lastError || new Error(`Fetch failed for ${url}`);
}

function parseOnlineJobs(html, query) {
  const jobs = [];
  const applied = [];
  const seen = new Set();
  const re =
    /href="(\/jobseekers\/job\/[^"]+)"[\s\S]{0,120}?jobpost-cat-box([\s\S]{0,3500}?)(?=<a href="\/jobseekers\/job\/|<\/div>\s*<\/div>\s*<a href="\/jobseekers\/job\/|$)/gi;
  let m;
  while ((m = re.exec(html)) && jobs.length + applied.length < 50) {
    const href = decodeHtml(m[1]);
    if (seen.has(href)) continue;
    seen.add(href);
    const block = m[2] || "";
    const titleMatch = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const title = clean(titleMatch ? titleMatch[1] : "") || query;
    const url = `https://www.onlinejobs.ph${href}`;
    const job = {
      title,
      company: "OnlineJobs.ph employer",
      url,
      source: "onlinejobs",
      tags: suggestTags(title),
      siteApplied: looksApplied(block),
    };
    if (job.siteApplied) applied.push(job);
    else jobs.push(job);
  }

  // Fallback simpler parser if card split failed
  if (!jobs.length && !applied.length) {
    const simple =
      /href="(\/jobseekers\/job\/[^"]+)"[\s\S]{0,120}?jobpost-cat-box[\s\S]{0,2500}?<h4[^>]*>([\s\S]*?)<\/h4>/gi;
    while ((m = simple.exec(html)) && jobs.length < 40) {
      const href = decodeHtml(m[1]);
      if (seen.has(href)) continue;
      seen.add(href);
      const title = clean(m[2]) || query;
      jobs.push({
        title,
        company: "OnlineJobs.ph employer",
        url: `https://www.onlinejobs.ph${href}`,
        source: "onlinejobs",
        tags: suggestTags(title),
        siteApplied: false,
      });
    }
  }

  return { jobs, applied };
}

function parseIndeed(html, query) {
  const jobs = [];
  const seen = new Set();
  const re = /href="(\/rc\/clk\?[^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) && jobs.length < 40) {
    const href = decodeHtml(m[1]);
    let params;
    try {
      params = new URL(href, "https://ph.indeed.com").searchParams;
    } catch {
      continue;
    }
    const jk = params.get("jk");
    if (!jk || seen.has(jk) || jk === "cdef0123456789ab") continue;
    seen.add(jk);
    let title = clean((params.get("ti") || "").replace(/\+/g, " "));
    const company =
      clean((params.get("cmp") || "").replace(/\+/g, " ")) || "Indeed employer";
    if (!title) {
      const nearby = html.slice(Math.max(0, m.index - 800), m.index + 400);
      const titleMatch =
        nearby.match(/aria-label="([^"]+)"/i) ||
        nearby.match(/title="([^"]+job[^"]*)"/i);
      if (titleMatch) title = clean(titleMatch[1]);
    }
    if (!title) title = `Indeed role: ${query}`;
    jobs.push({
      title,
      company,
      url: `https://ph.indeed.com/viewjob?jk=${jk}`,
      source: "indeed",
      tags: suggestTags(title),
      siteApplied: false,
    });
  }
  return { jobs, applied: [] };
}

function parseJobStreet(html, query) {
  const jobs = [];
  const seen = new Set();
  const titleRe =
    /href="(\/job\/\d+[^"]*)"[^>]*data-automation="jobTitle"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = titleRe.exec(html)) && jobs.length < 40) {
    const path = decodeHtml(m[1]).split("?")[0];
    if (seen.has(path)) continue;
    seen.add(path);
    const title = clean(m[2]) || `JobStreet: ${query}`;
    let company = "JobStreet employer";
    const after = html.slice(m.index, m.index + 900);
    const companyMatch = after.match(
      /data-automation="jobCardCompanyLink"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (companyMatch) company = clean(companyMatch[1]) || company;
    jobs.push({
      title,
      company,
      url: `https://ph.jobstreet.com${path}`,
      source: "jobstreet",
      tags: suggestTags(title),
      siteApplied: false,
    });
  }
  return { jobs, applied: [] };
}

function extractToken(payload) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = [
    payload.token,
    payload.access_token,
    payload.accessToken,
    payload?.data?.token,
    payload?.data?.access_token,
    payload?.data?.accessToken,
    payload?.data?.user?.token,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function collectStrings(value, out = []) {
  if (value == null) return out;
  if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

function normalizeAppliedJobs(payload) {
  const strings = collectStrings(payload);
  const jobs = [];
  const seen = new Set();
  for (const raw of strings) {
    const text = String(raw);
    const urlMatches = text.match(
      /https?:\/\/(?:www\.)?onlinejobs\.ph\/jobseekers\/job\/[a-z0-9\-]+/gi,
    );
    if (urlMatches) {
      for (const url of urlMatches) {
        const cleanUrl = url.split("?")[0];
        const key = normalizeJobUrl(cleanUrl);
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push({
          url: cleanUrl,
          title: cleanUrl.split("/").pop().replace(/-\d+$/, "").replace(/-/g, " "),
          source: "onlinejobs",
        });
      }
    }
    const slugMatch = text.match(/(?:^|\/)jobseekers\/job\/([a-z0-9\-]+)/i);
    if (slugMatch) {
      const url = `https://www.onlinejobs.ph/jobseekers/job/${slugMatch[1]}`;
      const key = normalizeJobUrl(url);
      if (!seen.has(key)) {
        seen.add(key);
        jobs.push({
          url,
          title: slugMatch[1].replace(/-\d+$/, "").replace(/-/g, " "),
          source: "onlinejobs",
        });
      }
    }
  }
  return jobs;
}

async function apiFetch(path, { method = "GET", token, body } = {}) {
  const headers = {
    "User-Agent": UA,
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: "https://v2.onlinejobs.ph",
    Referer: "https://v2.onlinejobs.ph/",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function fetchOnlineJobsApplied(email, password) {
  const login = await apiFetch("/api/v1/login", {
    method: "POST",
    body: { email, password },
  });
  if (!login.ok) {
    throw new Error(
      login.json?.message || "OnlineJobs login failed. Check email/password.",
    );
  }
  const token = extractToken(login.json);
  if (!token) throw new Error("Login succeeded but no API token was returned");

  const chunks = [];
  for (const path of [
    "/api/v1/message/jobs",
    "/api/v1/message/sent",
    "/api/v1/message/inbox",
  ]) {
    const result = await apiFetch(path, { token });
    if (result.ok) chunks.push(result.json);
  }
  return {
    token,
    applied: normalizeAppliedJobs(chunks),
  };
}

async function checkOnlineJobsDetailApplied(jobUrl, token) {
  try {
    const html = await fetchText(jobUrl, token ? { Authorization: `Bearer ${token}` } : {});
    return looksApplied(html);
  } catch {
    return false;
  }
}

async function searchSource(source, query, { token } = {}) {
  const q = encodeURIComponent(query);
  try {
    if (source === "onlinejobs") {
      const html = await fetchText(
        `https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=${q}`,
        token ? { Authorization: `Bearer ${token}` } : {},
      );
      return { source, ...parseOnlineJobs(html, query), error: null };
    }
    if (source === "indeed") {
      const html = await fetchText(
        `https://ph.indeed.com/jobs?q=${q}&l=Philippines`,
      );
      return { source, ...parseIndeed(html, query), error: null };
    }
    if (source === "jobstreet") {
      const slug = query
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const candidates = [];
      if (/wordpress/.test(slug)) candidates.push("https://ph.jobstreet.com/wordpress-jobs");
      if (/web|developer|fullstack|full-stack/.test(slug)) {
        candidates.push("https://ph.jobstreet.com/web-developer-jobs");
      }
      candidates.push(
        `https://ph.jobstreet.com/${slug}-jobs`,
        "https://ph.jobstreet.com/wordpress-jobs",
        "https://ph.jobstreet.com/web-developer-jobs",
      );
      let html = "";
      let lastError = null;
      for (const pageUrl of [...new Set(candidates)]) {
        try {
          html = await fetchText(pageUrl);
          if (html.includes('data-automation="jobTitle"') || html.includes("/job/")) break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!html) throw lastError || new Error("JobStreet fetch failed");
      const parsed = parseJobStreet(html, query);
      if (!parsed.jobs.length) {
        return {
          source,
          jobs: [],
          applied: [],
          error: "No JobStreet listings parsed (site may be blocking bots)",
        };
      }
      return { source, ...parsed, error: null };
    }
    return { source, jobs: [], applied: [], error: "Unknown source" };
  } catch (err) {
    return { source, jobs: [], applied: [], error: err.message || String(err) };
  }
}

function normalizeQuery(raw) {
  let q = String(Array.isArray(raw) ? raw[0] : raw || "wordpress developer").trim();
  q = q.replace(/\+/g, " ");
  for (let i = 0; i < 3; i += 1) {
    if (!/%[0-9a-f]{2}/i.test(q)) break;
    try {
      const next = decodeURIComponent(q);
      if (next === q) break;
      q = next;
    } catch {
      break;
    }
  }
  return q.trim() || "wordpress developer";
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const body = req.method === "POST" ? readBody(req) : {};
  const query = normalizeQuery(
    body.q ||
      (req.query && req.query.q) ||
      url.searchParams.get("q") ||
      "wordpress developer",
  );
  const sourcesRaw =
    body.sources ||
    (req.query && req.query.sources) ||
    url.searchParams.get("sources") ||
    "onlinejobs,indeed,jobstreet";
  const sourcesParam = String(sourcesRaw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const skipApplied =
    body.skipApplied !== false &&
    String(url.searchParams.get("skipApplied") || "1") !== "0";
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const knownApplied = Array.isArray(body.knownAppliedUrls)
    ? body.knownAppliedUrls
    : [];

  const allowed = ["onlinejobs", "indeed", "jobstreet"];
  const sources = sourcesParam.filter((s) => allowed.includes(s));
  if (!query) {
    res.status(400).json({ error: "Missing q" });
    return;
  }

  let token = null;
  let accountApplied = [];
  const errors = {};

  if (email && password && sources.includes("onlinejobs")) {
    try {
      const synced = await fetchOnlineJobsApplied(email, password);
      token = synced.token;
      accountApplied = synced.applied || [];
    } catch (err) {
      errors.onlinejobs_auth = err.message || String(err);
    }
  }

  const appliedSet = new Set(
    [...knownApplied, ...accountApplied.map((j) => j.url)].map(normalizeJobUrl),
  );

  const results = await Promise.all(
    sources.map((s) => searchSource(s, query, { token })),
  );

  const jobs = [];
  const detectedApplied = [...accountApplied];
  const seen = new Set();

  for (const result of results) {
    if (result.error) errors[result.source] = result.error;
    for (const job of result.applied || []) {
      detectedApplied.push(job);
      appliedSet.add(normalizeJobUrl(job.url));
    }
    for (const job of result.jobs || []) {
      const key = normalizeJobUrl(job.url);
      if (seen.has(key)) continue;
      seen.add(key);
      if (skipApplied && appliedSet.has(key)) {
        detectedApplied.push({ ...job, siteApplied: true });
        continue;
      }
      jobs.push(job);
    }
  }

  // Extra verification for OnlineJobs detail pages when logged in
  if (token && skipApplied && jobs.length) {
    const toCheck = jobs.filter((j) => j.source === "onlinejobs").slice(0, 15);
    for (const job of toCheck) {
      const appliedOnSite = await checkOnlineJobsDetailApplied(job.url, token);
      if (appliedOnSite) {
        job.siteApplied = true;
        appliedSet.add(normalizeJobUrl(job.url));
        detectedApplied.push(job);
      }
    }
  }

  const openJobs = skipApplied
    ? jobs.filter((j) => !appliedSet.has(normalizeJobUrl(j.url)) && !j.siteApplied)
    : jobs;

  res.status(200).json({
    query,
    count: openJobs.length,
    jobs: openJobs,
    appliedDetected: detectedApplied.map((j) => ({
      url: j.url,
      title: j.title,
      source: j.source || "onlinejobs",
    })),
    skippedApplied: detectedApplied.length,
    errors,
    authenticated: Boolean(token),
    searchedAt: new Date().toISOString(),
  });
};
