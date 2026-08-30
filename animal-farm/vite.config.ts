import { defineConfig } from 'vite'

// 이 게임은 PLANNER 저장소 안의 독립된 서브 프로젝트입니다.
// (기존 "공부 계획표" 앱과는 별개로 이 폴더 안에서 직접 개발/빌드합니다)
export default defineConfig({
  base: './',
})
