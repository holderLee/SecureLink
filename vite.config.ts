import vue from "@vitejs/plugin-vue";
import { UserConfig, ConfigEnv, loadEnv, defineConfig } from "vite";
import { createSvgIconsPlugin } from "vite-plugin-svg-icons";
import UnoCSS from "unocss/vite";
import { resolve } from "path";

const pathSrc = resolve(__dirname, "src");
/** https://cn.vitejs.dev/config */
export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  const env = loadEnv(mode, process.cwd());
  return {
    resolve: {
      alias: {
        "@": pathSrc,
      },
    },
    css: {
      /** CSS 预处理器 */
      preprocessorOptions: {
        /** 定义全局 SCSS 变量 */
        scss: {
          javascriptEnabled: true,
          additionalData: `
            @use "@/styles/variables.scss" as *;
          `,
        },
      },
    },
    server: {
      /** 允许IP访问 */
      host: "0.0.0.0",
      /** 应用端口 (默认:3000) */
      port: Number(env.VITE_APP_PORT),
      /** 运行是否自动打开浏览器 */
      open: false,
      proxy: {
        /**
         * 反向代理解决跨域配置
         * http://localhost:3000/dev-api/users (F12可见请求路径) => http://localhost:8989/users (实际请求后端 API 路径)
         *
         * env.VITE_APP_BASE_API: /dev-api
         * env.VITE_APP_API_URL: http://localhost:8989
         */
        [env.VITE_APP_BASE_API]: {
          changeOrigin: true,
          target: env.VITE_APP_API_URL,
          rewrite: (path) =>
            path.replace(new RegExp("^" + env.VITE_APP_BASE_API), ""),
        },
      },
    },
    plugins: [
      vue(),
      UnoCSS({
        hmrTopLevelAwait: false,
      }),
      createSvgIconsPlugin({
        /** 指定需要缓存的图标文件夹 */
        iconDirs: [resolve(pathSrc, "assets/icons")],
        /** 指定symbolId格式 */
        symbolId: "icon-[dir]-[name]",
      }),
    ],
    /** 预加载项目必需的组件 */
    optimizeDeps: {
      include: [
        "vue",
        "vue-router",
        "pinia",
        "axios",
        "@vueuse/core",
        "path-to-regexp",
        "vue-i18n",
      ],
    },
    /** 构建配置 */
    build: {
      chunkSizeWarningLimit: 2000, // 消除打包大小超过500kb警告
      minify: "terser", // Vite 2.6.x 以上需要配置 minify: "terser", terserOptions 才能生效
      terserOptions: {
        compress: {
          keep_infinity: true, // 防止 Infinity 被压缩成 1/0，这可能会导致 Chrome 上的性能问题
          drop_console: true, // 生产环境去除 console
          drop_debugger: true, // 生产环境去除 debugger
        },
        format: {
          comments: false, // 删除注释
        },
      },
      rollupOptions: {
        output: {
          /** 用于从入口点创建的块的打包输出格式[name]表示文件名,[hash]表示该文件内容hash值 */
          entryFileNames: "js/[name].[hash].js",
          /** 用于命名代码拆分时创建的共享块的输出命名 */
          chunkFileNames: "js/[name].[hash].js",
          /** 用于输出静态资源的命名，[ext]表示文件扩展名 */
          assetFileNames: (assetInfo: any) => {
            const info = assetInfo.name.split(".");
            let extType = info[info.length - 1];
            if (
              /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name)
            ) {
              extType = "media";
            } else if (/\.(png|jpe?g|gif|svg)(\?.*)?$/.test(assetInfo.name)) {
              extType = "img";
            } else if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name)) {
              extType = "fonts";
            }
            return `${extType}/[name].[hash].[ext]`;
          },
        },
      },
    },
  };
});
