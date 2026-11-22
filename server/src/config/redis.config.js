/**
 * Redis 配置（.env）
 *
 * REDIS_MODE：
 * - embedded  ：进程内临时 Redis（本地开发无外部 Redis 时）
 * - standalone：连接独立 Redis 实例（预发/生产）
 */
export const redisConfig = {
  mode: process.env.REDIS_MODE || "embedded",
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  keyPrefix: process.env.REDIS_KEY_PREFIX || "securelink:",
};
