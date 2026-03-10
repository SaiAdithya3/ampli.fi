import { Router, Request, Response } from "express";

export function createProxyRouter(): Router {
  const router = Router();

  // Proxy mempool.space requests (used by Atomiq SDK on frontend)
  router.all("/mempool/*", async (req: Request, res: Response) => {
    const targetPath = req.params[0];
    const targetUrl = `https://mempool.space/${targetPath}`;
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          "Content-Type": req.headers["content-type"] ?? "application/json",
          Accept: req.headers.accept ?? "application/json",
        },
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
      });
      const contentType = response.headers.get("content-type") ?? "application/json";
      res.status(response.status).set("Content-Type", contentType);
      const text = await response.text();
      return res.send(text);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Proxy request failed";
      return res.status(502).json({ error: msg });
    }
  });

  // Proxy okx.com requests (used by Atomiq SDK on frontend)
  router.all("/okx/*", async (req: Request, res: Response) => {
    const targetPath = req.params[0];
    const targetUrl = `https://www.okx.com/${targetPath}`;
    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          "Content-Type": req.headers["content-type"] ?? "application/json",
          Accept: req.headers.accept ?? "application/json",
        },
        body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
      });
      const contentType = response.headers.get("content-type") ?? "application/json";
      res.status(response.status).set("Content-Type", contentType);
      const text = await response.text();
      return res.send(text);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Proxy request failed";
      return res.status(502).json({ error: msg });
    }
  });

  // Proxy Atomiq intermediary nodes (nodes.atomiq.exchange)
  // These return HTML error pages when hit directly from the browser; proxying avoids CORS/HTML issues
  router.all("/atomiq-nodes", async (req: Request, res: Response) => {
    const targetUrl = typeof req.query.url === "string" ? req.query.url : null;
    if (!targetUrl || !targetUrl.includes("nodes.atomiq.exchange")) {
      return res.status(400).json({ error: "Missing or invalid url query parameter" });
    }
    try {
      const headers: Record<string, string> = {
        Accept: req.headers.accept ?? "application/json",
      };
      if (req.headers["content-type"]) {
        headers["Content-Type"] = req.headers["content-type"];
      }
      const body = req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined;
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      });
      const contentType = response.headers.get("content-type") ?? "application/json";
      res.status(response.status).set("Content-Type", contentType);
      const text = await response.text();
      return res.send(text);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Proxy request failed";
      return res.status(502).json({ error: msg });
    }
  });

  return router;
}
