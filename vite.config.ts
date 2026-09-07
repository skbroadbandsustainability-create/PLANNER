import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages는 https://<user>.github.io/PLANNER/ 처럼 서브 경로에서 서빙되므로
  // GitHub Actions에서 빌드할 때만 base를 저장소 이름으로 맞춰준다.
  base: process.env.GITHUB_PAGES ? '/PLANNER/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // 공부 계획표 앱(index.html)과 포켓몬 테니스 게임(tennis.html)을
      // 같은 저장소에서 함께 빌드하기 위한 멀티 페이지 설정.
      input: {
        main: `${rootDir}index.html`,
        tennis: `${rootDir}tennis.html`,
      },
    },
  },
})
