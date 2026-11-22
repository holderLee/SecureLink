/**
 * 服务启动入口
 * 1. 加载 .env
 * 2. initRedis()
 * 3. app.listen()
 */
import "dotenv/config";
import app from "./app.js";
import { initRedis, closeRedis } from "./db/redis.js";

const PORT = Number(process.env.PORT) || 8989;

async function bootstrap() {
  // 先连 Redis；失败则直接退出，避免「HTTP 通了但存不了 frontendId」
  await initRedis();

  const server = app.listen(PORT, () => {
    console.log("========================================");
  console.log(" SecureLink server started");
  console.log(` URL: http://localhost:${PORT}`);
  console.log(` Health: http://localhost:${PORT}/health`);
  console.log(` Secure echo: http://localhost:${PORT}/client/secure/echo`);
  console.log("========================================");
  });

  /**
   * 进程退出时关掉 Redis，避免 embedded 模式残留子进程
   * Ctrl+C 会触发 SIGINT
   */
  const shutdown = async (signal) => {
    console.log(`\n[server] 收到 ${signal}，正在关闭...`);
    server.close(async () => {
      await closeRedis();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("[server] 启动失败:", err);
  process.exit(1);
});
