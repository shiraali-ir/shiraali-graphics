import http from "node:http";

const ALLOW = new Set([
  "en.wikipedia.org", "fa.wikipedia.org",
  "api.open-meteo.com", "geocoding-api.open-meteo.com",
  "api.nal.usda.gov", "translate.googleapis.com", "date.nager.at"
]);
const ORIGINS = ["https://shiraali.ir", "https://www.shiraali.ir"];
const cache = new Map();
const TTL = 10 * 60 * 1000;

http.createServer(async (req, res) => {
  const origin = ORIGINS.includes(req.headers.origin) ? req.headers.origin : ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  try {
    const u = new URL(req.url, "http://x");
    const raw = u.searchParams.get("url");
    if (!raw) { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }

    const target = new URL(raw);
    if (target.protocol !== "https:" || !ALLOW.has(target.hostname)) {
      res.writeHead(403); return res.end("blocked");
    }

    const key = target.href;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL) {
      res.writeHead(200, { "Content-Type": hit.type });
      return res.end(hit.body);
    }

    const r = await fetch(key, {
      headers: { "User-Agent": "ShiraaliSearch/1.0 (https://shiraali.ir)", Accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    });
    const body = await r.text();
    const type = r.headers.get("content-type") || "application/json";

    if (r.ok) {
      if (cache.size > 500) cache.clear();
      cache.set(key, { t: Date.now(), type, body });
    }
    res.writeHead(r.status, { "Content-Type": type });
    res.end(body);
  } catch {
    res.writeHead(502);
    res.end("proxy error");
  }
}).listen(process.env.PORT || 3000);
