import path from 'node:path'

export async function loadConfig(configPath: string) {
  const resolvedPath = path.resolve(process.cwd(), configPath)
  const config = await import(resolvedPath)

  if (!config.default.apiKey) {
    throw new Error('NOTION_API_KEY is missing in the configuration file.')
  }

  return config.default
}
