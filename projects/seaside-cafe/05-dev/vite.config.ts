import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect } from "vite";
import { defineConfig, type Plugin } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsRoot = path.resolve(root, "../assets");

function isImage(name: string): boolean {
  return /\.(png|jpg|jpeg|webp)$/i.test(name);
}

function copyAssets(outDir: string) {
  const walk = (from: string, to: string) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;
      const source = path.join(from, entry.name);
      const target = path.join(to, entry.name);
      if (entry.isDirectory()) walk(source, target);
      else if (isImage(entry.name)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
      }
    }
  };
  walk(assetsRoot, path.join(outDir, "assets"));
}

function serveAssets(): Plugin {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use("/assets", (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body?: Buffer | string) => void }, next: () => void) => {
      const raw = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const parts = raw.split("/").filter(Boolean);
      if (parts.some((part) => part.startsWith("_") || part === "." || part === "..")) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const file = path.resolve(assetsRoot, ...parts);
      if (!file.startsWith(assetsRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !isImage(file)) {
        next();
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.setHeader("Content-Type", ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg");
      res.end(fs.readFileSync(file));
    });
  };
  return {
    name: "seaside-assets",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
    closeBundle() {
      const outDir = path.resolve(root, "dist");
      if (!fs.existsSync(outDir)) return;
      copyAssets(outDir);
      const assetsDir = path.join(outDir, "assets");
      const fonts = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).filter((name) => name.endsWith(".woff2")) : [];
      if (fonts.length !== 1) throw new Error(`字体应该只打进一份，实际 ${fonts.length} 份`);
      const ofl = path.resolve(root, "../06-ui-design/mock/fonts/OFL.txt");
      fs.copyFileSync(ofl, path.join(assetsDir, "OFL.txt"));
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [serveAssets()],
  server: { host: "127.0.0.1", port: 5173, fs: { allow: [path.resolve(root, "..")] } },
  preview: { host: "127.0.0.1", port: 4173 },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
