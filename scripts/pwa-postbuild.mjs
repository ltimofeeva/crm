// Постобработка веб-сборки для установки «на экран Домой» (PWA).
// 1) генерирует иконки-PNG (буква «П» на фирменном зелёном фоне),
// 2) пишет manifest.json,
// 3) вставляет в index.html манифест и Apple-теги (для iPhone Safari).
//
// Запуск: node scripts/pwa-postbuild.mjs <папка_сборки>
// Иконки рисуются без внешних библиотек (свой мини-энкодер PNG).

import fs from "fs";
import path from "path";
import zlib from "zlib";

const PUBLIC_DIR = process.argv[2];
if (!PUBLIC_DIR) {
  console.error("Укажите папку сборки: node scripts/pwa-postbuild.mjs <dir>");
  process.exit(1);
}

// Фирменные цвета (совпадают с src/theme.js).
const BG = [0x33, 0x60, 0x4f];   // primary
const FG = [0xf3, 0xf5, 0xf2];   // cream

// ---- Мини-энкодер PNG (RGBA, 8 бит) ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  // строки с фильтром 0
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// Рисуем иконку размера size: скруглённый фон + буква «П».
function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const inRounded = (x, y) => {
    // скругление углов
    const r = radius;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r || (x >= r && x <= size - r) || (y >= r && y <= size - r);
  };

  // Геометрия буквы «П»: две вертикальные стойки + верхняя перекладина.
  const m = size * 0.30;          // поля слева/справа/сверху
  const barW = size * 0.12;       // толщина штрихов
  const left = m, right = size - m;
  const top = m, bottom = size - m * 0.9;
  const isP = (x, y) => {
    if (y >= top && y <= top + barW && x >= left && x <= right) return true;      // перекладина
    if (x >= left && x <= left + barW && y >= top && y <= bottom) return true;    // левая стойка
    if (x >= right - barW && x <= right && y >= top && y <= bottom) return true;  // правая стойка
    return false;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = inRounded(x, y);
      if (!inside) { px[i + 3] = 0; continue; } // прозрачные углы
      const letter = isP(x, y);
      const c = letter ? FG : BG;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  }
  return encodePNG(size, px);
}

const iconsDir = path.join(PUBLIC_DIR, "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180 };
for (const [name, size] of Object.entries(sizes)) {
  fs.writeFileSync(path.join(iconsDir, name), drawIcon(size));
}
// favicon
fs.writeFileSync(path.join(PUBLIC_DIR, "favicon.png"), drawIcon(64));

// ---- manifest.json ----
const manifest = {
  name: "Практика",
  short_name: "Практика",
  description: "CRM для помогающих специалистов",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#F3F5F2",
  theme_color: "#33604F",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
};
fs.writeFileSync(path.join(PUBLIC_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

// ---- патчим index.html ----
const htmlPath = path.join(PUBLIC_DIR, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
const head = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#33604F" />
    <link rel="icon" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Практика" />
  `;
if (!html.includes("apple-mobile-web-app-title")) {
  html = html.replace("</head>", `${head}</head>`);
  fs.writeFileSync(htmlPath, html);
}

console.log("PWA-постобработка готова:", PUBLIC_DIR);
