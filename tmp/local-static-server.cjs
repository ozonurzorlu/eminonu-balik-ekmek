const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.STATIC_PORT || 8010);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
};

http
  .createServer((req, res) => {
    let requestPath = decodeURIComponent(req.url.split("?")[0]);
    if (requestPath === "/") requestPath = "/index.html";

    const file = path.resolve(root, requestPath.replace(/^\/+/, ""));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.stat(file, (error, stats) => {
      if (error || !stats.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const contentType = contentTypes[path.extname(file).toLowerCase()] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(file).pipe(res);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`http://localhost:${port}/`);
  });
