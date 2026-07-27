const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

async function fetchText(url) {
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const tryUrls = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  let lastError = null;
  for (const candidate of tryUrls) {
    try {
      const res = await fetch(candidate, {
        headers,
        redirect: "follow",
      });
      if (!res.ok) {
        lastError = new Error(`Fetch failed ${res.status} for ${candidate}`);
        continue;
      }
      const text = await res.text();
      if (text && text.length > 500) return text;
      lastError = new Error(`Empty response for ${candidate}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Fetch failed for ${url}`);
}

function parseOnlineJobs(html, query) {
  const jobs = [];
  const seen = new Set();
  const re =
    /href="(\/jobseekers\/job\/[^"]+)"[\s\S]{0,120}?jobpost-cat-box[\s\S]{0,2500}?<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  let m;
  while ((m = re.exec(html)) && jobs.length < 40) {
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
    });
  }
  return jobs;
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
        nearby.match(/title="([^"]+job[^"]*)"/i) ||
        nearby.match(/<h2[^>]*>[\s\S]*?<span[^>]*title="([^"]+)"/i);
      if (titleMatch) title = clean(titleMatch[1]);
    }

    if (!title) title = `Indeed role: ${query}`;

    jobs.push({
      title,
      company,
      url: `https://ph.indeed.com/viewjob?jk=${jk}`,
      source: "indeed",
      tags: suggestTags(title),
    });
  }
  return jobs;
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
    });
  }
  return jobs;
}

async function searchSource(source, query) {
  const q = encodeURIComponent(query);
  try {
    if (source === "onlinejobs") {
      const html = await fetchText(
        `https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=${q}`,
      );
      return { source, jobs: parseOnlineJobs(html, query), error: null };
    }
    if (source === "indeed") {
      const html = await fetchText(
        `https://ph.indeed.com/jobs?q=${q}&l=Philippines`,
      );
      return { source, jobs: parseIndeed(html, query), error: null };
    }
    if (source === "jobstreet") {
      const slug = query
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const candidates = [
        `https://ph.jobstreet.com/${slug}-jobs`,
        `https://ph.jobstreet.com/${encodeURIComponent(query)}-jobs`,
        "https://ph.jobstreet.com/wordpress-jobs",
        "https://ph.jobstreet.com/web-developer-jobs",
      ];
      let html = "";
      let lastError = null;
      for (const url of candidates) {
        try {
          html = await fetchText(url);
          if (html.includes('data-automation="jobTitle"')) break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!html) throw lastError || new Error("JobStreet fetch failed");
      return { source, jobs: parseJobStreet(html, query), error: null };
    }
    return { source, jobs: [], error: "Unknown source" };
  } catch (err) {
    return { source, jobs: [], error: err.message || String(err) };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  let query = (url.searchParams.get("q") || "wordpress developer").trim();
  try {
    query = decodeURIComponent(query.replace(/\+/g, " ")).trim();
  } catch {
    /* already decoded */
  }
  const sourcesParam = (url.searchParams.get("sources") || "onlinejobs,indeed,jobstreet")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const allowed = ["onlinejobs", "indeed", "jobstreet"];
  const sources = sourcesParam.filter((s) => allowed.includes(s));
  if (!query) {
    res.status(400).json({ error: "Missing q" });
    return;
  }

  const results = await Promise.all(sources.map((s) => searchSource(s, query)));
  const jobs = [];
  const seen = new Set();
  const errors = {};

  for (const result of results) {
    if (result.error) errors[result.source] = result.error;
    for (const job of result.jobs) {
      const key = job.url;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(job);
    }
  }

  res.status(200).json({
    query,
    count: jobs.length,
    jobs,
    errors,
    searchedAt: new Date().toISOString(),
  });
};
