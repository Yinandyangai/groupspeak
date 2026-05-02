const http = require("http");

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("realtime alive");
});

server.listen(4000, () => {
  console.log("realtime server listening on 4000");
});
