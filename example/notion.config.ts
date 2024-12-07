export interface NotionConfig {
  databases: Record<string, string>
  outputDir: string
}

const config: NotionConfig = {
  databases: {
    Tasks: 'abc123def456',
    Projects: 'xyz789ghi012',
  },
  outputDir: './generated',
}

export default config
