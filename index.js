const http = require("http");
const crypto = require("crypto");
const qs = require("querystring");
const { createReadStream } = require("fs");

const subscribers = {};
let lastMessages = [];

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const [route, query] = req.url.split("?");

  const params = qs.parse(query);

  switch (route) {
    case "/": {
      // TODO: use as static file
      const stream = createReadStream("./public/index.html");
      res.writeHead(200, {
        "content-type": "text/html",
      });
      stream.pipe(res).on("close", () => res.end());
      return;
    }
    case "/events/subscribe": {
      const id = crypto.randomUUID();
      console.log(`Subscribed ${id}`);

      res.writeHead(200, {
        "content-type": "text/event-stream",
        connection: "keep-alive",
        "cache-control": "no-cache",
      });

      res.write(`data: ${JSON.stringify({ id })}\n\n`);

      subscribers[id] = res;

      // send prev messages
      lastMessages.forEach((message) => {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
      });

      req.on("close", () => {
        delete subscribers[id];
        console.log(`Unsubscribed ${id}`);
      });

      return;
    }

    case "/events/fire": {
      const { target = "all", nick = "anonymous", message = "" } = params;
      const payload = { nick, message };
      const targets =
        target === "all" ? Object.values(subscribers) : [subscribers[target]];

      targets.filter(Boolean).forEach((subscriber) => {
        subscriber.write(`data: ${JSON.stringify(payload)}\n\n`);
      });

      lastMessages.push(payload);
      lastMessages = lastMessages.slice(-5);

      res.writeHead(200);
      res.write(`OK: sent to ${Object.keys(subscribers).length} subscribers`);

      break;
    }

    case "/status": {
      res.writeHead(200);
      res.write(
        JSON.stringify({
          ids: Object.keys(subscribers),
          total: Object.keys(subscribers).length,
        })
      );

      break;
    }
  }

  res.end();
});

server.listen(parseInt(process.env.PORT) || 8080);
