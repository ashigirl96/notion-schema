import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  outDir: 'dist',
  target: 'node16',
  format: ['esm'],
  sourcemap: false,
  dts: true, // 型定義ファイルを出力
  clean: true,
  onSuccess: 'cp src/default dist',
})
