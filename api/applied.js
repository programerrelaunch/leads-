const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const API_BASE = "https://api.onlinejobs.ph";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function collectStrings(value, out = []) {
  if (value == null) return out;
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (typeof value === "number") {
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
    payload?.meta?.token,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
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
        const clean = url.split("?")[0];
        if (seen.has(clean)) continue;
        seen.add(clean);
        jobs.push({
          url: clean,
          title: clean.split("/").pop().replace(/-\d+$/, "").replace(/-/g, " "),
          source: "onlinejobs",
        });
      }
    }

    const slugMatch = text.match(
      /(?:^|\/)jobseekers\/job\/([a-z0-9\-]+)/i,
    );
    if (slugMatch) {
      const url = `https://www.onlinejobs.ph/jobseekers/job/${slugMatch[1]}`;
      if (!seen.has(url)) {
        seen.add(url);
        jobs.push({
          url,
          title: slugMatch[1].replace(/-\d+$/, "").replace(/-/g, " "),
          source: "onlinejobs",
        });
      }
    }
  }

  // Also pick objects that look like job records
  const stack = [payload];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    const slug =
      node.slug ||
      node.job_slug ||
      node.jobSlug ||
      node.permalink ||
      node.url ||
      node.link;
    const id = node.job_id || node.jobId || node.id;
    const title = node.title || node.job_title || node.jobTitle || node.name;
    if (typeof slug === "string" && /jobseekers\/job\//i.test(slug)) {
      const url = slug.startsWith("http")
        ? slug.split("?")[0]
        : `https://www.onlinejobs.ph${slug.startsWith("/") ? "" : "/"}${slug}`;
      if (!seen.has(url)) {
        seen.add(url);
        jobs.push({
          url,
          title: title || url.split("/").pop(),
          source: "onlinejobs",
          id: id || null,
        });
      }
    } else if (typeof slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)+-\d+$/i.test(slug)) {
      const url = `https://www.onlinejobs.ph/jobseekers/job/${slug}`;
      if (!seen.has(url)) {
        seen.add(url);
        jobs.push({
          url,
          title: title || slug.replace(/-\d+$/, "").replace(/-/g, " "),
          source: "onlinejobs",
          id: id || null,
        });
      }
    }
    stack.push(...Object.values(node));
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

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const platform = String(body.platform || "onlinejobs").toLowerCase();

  if (platform !== "onlinejobs") {
    res.status(400).json({
      error:
        "Only OnlineJobs.ph account sync is supported right now. Indeed/JobStreet applied jobs are tracked locally in this app.",
    });
    return;
  }
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const login = await apiFetch("/api/v1/login", {
      method: "POST",
      body: { email, password },
    });
    if (!login.ok) {
      res.status(401).json({
        error:
          login.json?.message ||
          "OnlineJobs login failed. Check email/password.",
        details: login.json,
      });
      return;
    }

    const token = extractToken(login.json);
    if (!token) {
      res.status(502).json({
        error: "Login succeeded but no API token was returned",
        details: login.json,
      });
      return;
    }

    const endpoints = [
      "/api/v1/message/jobs",
      "/api/v1/message/sent",
      "/api/v1/message/inbox",
    ];
    const chunks = [];
    const errors = {};
    for (const path of endpoints) {
      const result = await apiFetch(path, { token });
      if (!result.ok) {
        errors[path] = result.json?.message || `HTTP ${result.status}`;
        continue;
      }
      chunks.push(result.json);
    }

    const applied = normalizeAppliedJobs(chunks);
    res.status(200).json({
      platform: "onlinejobs",
      count: applied.length,
      applied,
      errors,
      syncedAt: new Date().toISOString(),
      note: "Credentials are not stored on the server. Applied jobs are returned to your browser only.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
};
