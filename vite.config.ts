import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages는 https://<user>.github.io/PLANNER/ 처럼 서브 경로에서 서빙되므로
  // GitHub Actions에서 빌드할 때만 base를 저장소 이름으로 맞춰준다.
  base: process.env.GITHUB_PAGES ? '/PLANNER/' : '/',
  plugins: [react(), tailwindcss()],
})
