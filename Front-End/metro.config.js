const http = require("node:http");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_PUBLIC_DISA_PREMIUM_TEST_API_URL) {
  const servicePorts = { iam: 15195, aitour: 15289, task: 15020 };
  const enhanceMiddleware = config.server.enhanceMiddleware;

  config.server.enhanceMiddleware = (middleware, server) => {
    const next = enhanceMiddleware?.(middleware, server) ?? middleware;

    return (request, response, done) => {
      const route = /^\/__disa-test\/(iam|aitour|task)(\/api\/.*)$/.exec(request.url);
      if (!route) return next(request, response, done);

      const upstream = http.request({
        hostname: "127.0.0.1",
        port: servicePorts[route[1]],
        method: request.method,
        path: route[2],
        headers: request.headers,
      }, (result) => {
        response.writeHead(result.statusCode, result.headers);
        result.pipe(response);
      });

      upstream.on("error", () => {
        if (response.headersSent) return response.destroy();
        response.writeHead(502, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ message: "The local Premium test service is unavailable." }));
      });
      response.on("close", () => {
        if (!response.writableEnded) upstream.destroy();
      });
      request.pipe(upstream);
    };
  };
}

module.exports = config;
