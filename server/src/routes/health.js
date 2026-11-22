/** 健康检查：进程存活 + Redis PING */
import { Router } from "express";
import { getRedis, getRedisRuntimeInfo } from "../db/redis.js";

const router = Router();

/**
 * GET /health
 */
router.get("/", async (_req, res) => {
  const redisInfo = getRedisRuntimeInfo();
  let redisPing = null;
  let redisOk = false;

  try {
    // 能 PONG 说明 Redis 客户端工作正常
    redisPing = await getRedis().ping();
    redisOk = redisPing === "PONG";
  } catch (err) {
    redisPing = err.message;
    redisOk = false;
  }

  res.json({
    code: 0,
    msg: "ok",
    data: {
      service: "securelink-server",
      uptime: process.uptime(),
      timestamp: Date.now(),
      redis: {
        ok: redisOk,
        ping: redisPing,
        ...redisInfo,
      },
    },
  });
});

export default router;
