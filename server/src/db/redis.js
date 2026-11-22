/**
 * Redis 客户端封装
 * 用途：frontendId / DEK / signKey / nonce（均带 TTL）
 */
import Redis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { redisConfig } from "../config/redis.config.js";

/** ioredis 客户端实例（全局单例） */
let redisClient = null;

/** embedded 模式下的内存 Redis 进程句柄 */
let memoryServer = null;

/** 实际连上的 host/port，方便 /health 展示 */
let runtimeInfo = {
  mode: redisConfig.mode,
  host: null,
  port: null,
  ready: false,
};

/**
 * 初始化 Redis
 * 必须在 Express listen 之前 await 调用。
 */
export async function initRedis() {
  if (redisClient) {
    return redisClient;
  }

  let host = redisConfig.host;
  let port = redisConfig.port;

  if (redisConfig.mode === "embedded") {
    /**
     * embedded：自动下载/启动一个临时 Redis
     * 第一次启动可能稍慢（下载二进制），之后会缓存。
     */
    console.log("[redis] 模式=embedded，正在启动内置 Redis ...");
    memoryServer = new RedisMemoryServer();
    host = await memoryServer.getHost();
    port = await memoryServer.getPort();
    console.log(`[redis] 内置 Redis 已就绪 ${host}:${port}`);
  } else {
    console.log(`[redis] 模式=standalone，连接 ${host}:${port} ...`);
  }

  /**
   * lazyConnect: true —— 创建后不立刻连，等我们手动 connect
   * keyPrefix —— 所有命令自动加前缀，业务侧写 "frontendId:xx" 即可
   * maxRetriesPerRequest —— 命令失败重试次数
   */
  redisClient = new Redis({
    host,
    port,
    password: redisConfig.password,
    keyPrefix: redisConfig.keyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  // 便于排查：连接成功/失败打日志
  redisClient.on("connect", () => {
    console.log("[redis] TCP 已连接");
  });
  redisClient.on("ready", () => {
    runtimeInfo.ready = true;
    console.log("[redis] 客户端就绪，可执行命令");
  });
  redisClient.on("error", (err) => {
    runtimeInfo.ready = false;
    console.error("[redis] 错误:", err.message);
  });

  await redisClient.connect();
  // PING 是 Redis 最基础的探活命令，返回 "PONG"
  const pong = await redisClient.ping();
  if (pong !== "PONG") {
    throw new Error(`Redis PING 异常: ${pong}`);
  }

  runtimeInfo = {
    mode: redisConfig.mode,
    host,
    port,
    ready: true,
  };

  console.log(`[redis] PING => ${pong}（前缀=${redisConfig.keyPrefix}）`);
  return redisClient;
}

/**
 * 获取已初始化的 Redis 客户端
 * 业务代码里不要自己 new Redis，统一走这里。
 */
export function getRedis() {
  if (!redisClient) {
    throw new Error("Redis 尚未 initRedis()，请先在 server.js 启动时初始化");
  }
  return redisClient;
}

/** 给 /health 用的运行时信息 */
export function getRedisRuntimeInfo() {
  return { ...runtimeInfo, keyPrefix: redisConfig.keyPrefix };
}

/**
 * 优雅关闭：停掉 ioredis，并在 embedded 模式下关掉内存 Redis 进程
 */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  runtimeInfo.ready = false;
  console.log("[redis] 已关闭");
}
