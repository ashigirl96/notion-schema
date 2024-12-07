import path from 'node:path'

// Bunの直接インポートを利用してTypeScriptファイルを読み込み
export async function loadConfig() {
  const configPath = path.resolve(process.cwd(), 'notion.config.ts')
  const config = await import(configPath)
  return config.default
}
