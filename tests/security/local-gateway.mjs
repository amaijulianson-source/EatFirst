/* global console, process */
import { createServer, request } from "node:http";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
export const anon = (() => {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const s = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ role: "anon", iss: "supabase", iat: 1700000000, exp: 2200000000 })}`;
  return `${s}.${createHmac("sha256", "eatfirst-local-testing-jwt-secret-at-least-32-chars").update(s).digest("base64url")}`;
})();
const authPort = Number(process.env.LOCAL_AUTH_PORT || 54325),
  port = Number(process.env.LOCAL_GATEWAY_PORT || 54328),
  origin = process.env.LOCAL_APP_ORIGIN || "http://127.0.0.1:4179";
const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,range,accept-profile,content-profile",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const isAuth = req.url.startsWith("/auth/v1/"),
    isRest = req.url.startsWith("/rest/v1/");
  if (!isAuth && !isRest) {
    res.writeHead(503);
    res.end("Local realtime not started");
    return;
  }
  const path = req.url.replace(isAuth ? "/auth/v1" : "/rest/v1", "");
  const upstream = request(
    {
      hostname: "127.0.0.1",
      port: isAuth ? authPort : 54326,
      path,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${isAuth ? authPort : 54326}`,
      },
    },
    (r) => {
      res.writeHead(r.statusCode, {
        ...r.headers,
        "access-control-allow-origin": origin,
      });
      r.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502);
    res.end("Local upstream unavailable");
  });
  req.pipe(upstream);
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Local GoTrue/PostgREST gateway ready on ${port} (test only).`),
);
