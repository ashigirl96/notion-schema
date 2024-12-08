export interface NotionConfig {
  databases: Record<string, string>
  outputDir: string
  apiKey: string
}

const config: NotionConfig = {
  databases: {
    Tasks: process.env.DATABASE1_ID ?? '',
    Projects: process.env.DATABASE2_ID ?? '',
  },
  outputDir: './generated',
  apiKey: process.env.NOTION_TOKEN ?? '',
}

export default config
