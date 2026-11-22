/**
 * Express 应用实例（配置中间件与路由；端口监听见 server.js）
 */
import express from "express";
import cors from "cors";
import morgan from "morgan";
import healthRouter from "./routes/health.js";
import securityRouter from "./routes/security.js";
import secureEchoRouter from "./routes/secureEcho.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/health", healthRouter);
app.use("/client/security", securityRouter);
app.use("/client/secure", secureEchoRouter);

app.get("/", (_req, res) => {
  res.json({
    name: "securelink-server",
    message: "SecureLink API ready",
    apis: {
      health: "GET /health",
      genFrontendId: "GET|POST /client/security/genFrontendId",
      genSecurityParam: "POST /client/security/genSecurityParam",
      secureEcho: "POST /client/secure/echo",
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    msg: `接口不存在: ${req.method} ${req.path}`,
  });
});

app.use((err, _req, res, _next) => {
  console.error("[server-error]", err);
  res.status(err.status || 500).json({
    code: err.status || 500,
    msg: err.message || "服务器内部错误",
  });
});

export default app;
