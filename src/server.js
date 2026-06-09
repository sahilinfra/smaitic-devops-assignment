const http = require("http");

const port = Number(process.env.PORT || 3000);
const startedAt = Date.now();
let requestCount = 0;

function sendJson(res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...extraHeaders
  });

  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, body, contentType = "text/plain") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });

  res.end(body);
}

const server = http.createServer((req, res) => {
  requestCount += 1;

  if (req.method !== "GET") {
    sendJson(
      res,
      405,
      { error: "Method not allowed" },
      { Allow: "GET" }
    );
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/healthz") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (url.pathname === "/readyz") {
    sendJson(res, 200, { status: "ready" });
    return;
  }

  if (url.pathname === "/metrics") {
    const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

    const metrics = [
      "# HELP app_up Whether the application is running.",
      "# TYPE app_up gauge",
      "app_up 1",
      "# HELP app_uptime_seconds Application uptime in seconds.",
      "# TYPE app_uptime_seconds counter",
      `app_uptime_seconds ${uptimeSeconds}`,
      "# HELP app_requests_total Total HTTP requests handled by this process.",
      "# TYPE app_requests_total counter",
      `app_requests_total ${requestCount}`
    ].join("\n");

    sendText(res, 200, `${metrics}\n`, "text/plain; version=0.0.4; charset=utf-8");
    return;
  }

  if (url.pathname === "/") {
    sendJson(res, 200, {
      message: "Simple Node.js API is running",
      endpoints: ["/", "/healthz", "/readyz", "/metrics"]
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

function shutdown() {
  console.log("Shutting down API server");

  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});