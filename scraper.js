/* Standalone browser scraper for OnlineJobs.ph, Indeed, JobStreet */
(function (global) {
  const UA_HINT = "ApplyHubStandalone/1.0";

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

  function decodeHtml(html = "") {
    return html
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
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

  async function fetchText(url) {
    const proxies = [
      (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    ];

    let lastError = null;
    for (const make of proxies) {
      const candidate = make(url);
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 18000);
        const res = await fetch(candidate, {
          signal: controller.signal,
          headers: { Accept: "text/html,*/*", "X-Requested-With": UA_HINT },
        });
        clearTimeout(timer);
        if (!res.ok) {
          lastError = new Error(`Proxy ${res.status}`);
          continue;
        }
        const text = await res.text();
        if (text && text.length > 800) return text;
        lastError = new Error("Empty proxy response");
      } catch (err) {
        lastError =
          err.name === "AbortError" ? new Error("Proxy timeout") : err;
      }
    }
    throw lastError || new Error(`Could not fetch ${url}`);
  }

  function parseOnlineJobs(html, query) {
    const jobs = [];
    const applied = [];
    const seen = new Set();
    const re =
      /href="(\/jobseekers\/job\/[^"]+)"[\s\S]{0,120}?jobpost-cat-box([\s\S]{0,3500}?)(?=<a href="\/jobseekers\/job\/|$)/gi;
    let m;
    while ((m = re.exec(html)) && jobs.length + applied.length < 50) {
      const href = decodeHtml(m[1]);
      if (seen.has(href)) continue;
      seen.add(href);
      const block = m[2] || "";
      const titleMatch = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
      const title = clean(titleMatch ? titleMatch[1] : "") || query;
      const job = {
        title,
        company: "OnlineJobs.ph employer",
        url: `https://www.onlinejobs.ph${href}`,
        source: "onlinejobs",
        tags: suggestTags(title),
        siteApplied: looksApplied(block),
      };
      if (job.siteApplied) applied.push(job);
      else jobs.push(job);
    }
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

  async function searchSource(source, query) {
    const q = encodeURIComponent(query);
    try {
      if (source === "onlinejobs") {
        const html = await fetchText(
          `https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=${q}`,
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
            if (html.includes('data-automation="jobTitle"') || html.includes("/job/")) {
              break;
            }
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
            error: "No JobStreet listings parsed",
          };
        }
        return { source, ...parsed, error: null };
      }
      return { source, jobs: [], applied: [], error: "Unknown source" };
    } catch (err) {
      return { source, jobs: [], applied: [], error: err.message || String(err) };
    }
  }

  async function scrapeViaApi({
    query,
    sources,
    email,
    password,
    knownAppliedUrls,
    skipApplied,
  }) {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: query,
        sources: sources.join(","),
        email: email || "",
        password: password || "",
        knownAppliedUrls: knownAppliedUrls || [],
        skipApplied: skipApplied !== false,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Search API failed (${res.status})`);
    }
    return res.json();
  }

  async function scrapeJobs({
    query,
    sources,
    email,
    password,
    knownAppliedUrls,
    skipApplied,
  }) {
    const list = sources.length
      ? sources
      : ["onlinejobs", "indeed", "jobstreet"];

    // Always scrape via server first (direct fetches, no flaky CORS proxies).
    try {
      const data = await scrapeViaApi({
        query,
        sources: list,
        email,
        password,
        knownAppliedUrls,
        skipApplied,
      });
      return {
        query,
        count: data.count || (data.jobs || []).length,
        jobs: (data.jobs || []).map((j) => ({
          ...j,
          scrapedAt: new Date().toISOString(),
        })),
        appliedDetected: data.appliedDetected || [],
        skippedApplied: data.skippedApplied || 0,
        errors: data.errors || {},
        authenticated: Boolean(data.authenticated),
        searchedAt: data.searchedAt || new Date().toISOString(),
        via: "server",
      };
    } catch (err) {
      var serverError = err.message || String(err);
    }

    // Browser fallback only if server search failed
    const results = await Promise.all(list.map((s) => searchSource(s, query)));
    const jobs = [];
    const appliedDetected = [];
    const seen = new Set();
    const errors = { server: serverError };

    for (const result of results) {
      if (result.error) errors[result.source] = result.error;
      for (const job of result.applied || []) {
        appliedDetected.push(job);
      }
      for (const job of result.jobs) {
        if (seen.has(job.url)) continue;
        seen.add(job.url);
        if (job.siteApplied) {
          appliedDetected.push(job);
          continue;
        }
        jobs.push({
          ...job,
          scrapedAt: new Date().toISOString(),
        });
      }
    }

    return {
      query,
      count: jobs.length,
      jobs,
      appliedDetected,
      skippedApplied: appliedDetected.length,
      errors,
      authenticated: false,
      searchedAt: new Date().toISOString(),
      via: "browser",
    };
  }

  global.ApplyHubScraper = {
    scrapeJobs,
    suggestTags,
    looksApplied,
  };
})(window);
