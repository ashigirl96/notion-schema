import * as fs from 'node:fs'
import * as path from 'node:path'
import { Command } from 'commander'
import { generateTypes } from './generate'

const program = new Command()

program.name('notion-schema').version('1.0.0')

let configPath = 'notion.config.ts' // デフォルトの設定ファイル名

// --config オプションを追加
program.option('-c, --config <path>', 'Path to the configuration file', (value) => {
  configPath = value
})

// init コマンド: 設定ファイルを生成
program
  .command('init')
  .description('Initialize the configuration file for notion-schema')
  .action(() => {
    const resolvedConfigPath = path.resolve(process.cwd(), configPath)
    if (fs.existsSync(resolvedConfigPath)) {
      console.error(`Config file already exists: ${resolvedConfigPath}`)
      process.exit(1)
    }

    const fileContent = `
export interface NotionConfig {
  databases: Record<string, string>;
  outputDir: string;
  apiKey: string;
}

const config: NotionConfig = {
  databases: {},
  outputDir: './generated',
  apiKey: 'your-notion-api-key-here',
};

export default config;
`.trim()

    fs.writeFileSync(resolvedConfigPath, fileContent)
    console.log(`Created configuration file at: ${resolvedConfigPath}`)
  })

// generate コマンド: 型生成
program
  .command('generate')
  .description('Generate TypeScript types from Notion databases')
  .action(async () => {
    try {
      await generateTypes(configPath)
    } catch (err) {
      console.error(err.message)
    }
  })

program.parse(process.argv)
