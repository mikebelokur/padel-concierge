import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const e = err as { message?: string; statusCode?: number; status?: number };
  const status = typeof e?.statusCode === "number" ? e.statusCode
    : typeof e?.status === "number" ? e.status
    : 500;
  req.log?.error({ err, url: req.url, method: req.method }, "unhandled route error");
  if (res.headersSent) return;
  res.status(status).json({
    error: status >= 500 ? "Internal error" : (e?.message ?? "Request failed"),
    code: status,
  });
});

export default app;
