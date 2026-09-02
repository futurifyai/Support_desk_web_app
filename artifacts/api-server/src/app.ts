import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getTrustedProxyHops } from "./config";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", getTrustedProxyHops());
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});
// Attachment payloads are base64-encoded, so a 5 MB file can be roughly
// 6.7 MB in JSON. Keep headroom for metadata while the route enforces the
// actual 5 MB decoded-file limit.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use("/api", router);

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ success: false, message: "Invalid request body" });
    return;
  }
  req.log.error({ err }, "Unhandled request error");
  res.status(500).json({ success: false, message: "Something went wrong" });
});

export default app;
