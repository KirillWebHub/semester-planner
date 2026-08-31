import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { persistencePlugin } from "./server/persistence.js";
import { isuCurriculumPlugin } from "./server/isuCurriculum.js";
import { itmoSchedulePlugin } from "./server/itmoSchedule.js";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react(),
    persistencePlugin(),
    isuCurriculumPlugin(),
    itmoSchedulePlugin(),
  ],
});
