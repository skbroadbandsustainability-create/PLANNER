import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 배포 서버 없이도 태블릿에서 바로 열 수 있는 '한 개짜리 HTML 파일'을 만드는 빌드 설정.
// (npm run build:artifact) -> dist-artifact/index.html
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: 'dist-artifact',
    rollupOptions: {
      input: 'index.artifact.html',
    },
  },
})
