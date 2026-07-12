// Сборка веб-приложения для размещения на сервере (иконка «на экран Домой»).
// Делает экспорт Expo в backend/public и добавляет PWA-обвязку (иконки,
// манифест, Apple-теги). Кроссплатформенно (Windows/Mac/Linux).
//
// Запуск: npm run build:web

import { execSync } from "child_process";
import fs from "fs";

fs.rmSync("backend/public", { recursive: true, force: true });
execSync("npx expo export --platform web --output-dir backend/public", { stdio: "inherit" });
execSync("node scripts/pwa-postbuild.mjs backend/public", { stdio: "inherit" });
console.log("\nГотово. Закоммитьте изменения и запушьте — Render обновит сайт.");
