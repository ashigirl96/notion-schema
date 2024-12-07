import * as fs from 'node:fs'
import * as path from 'node:path'
import { Command } from 'commander'
import { generateTypes } from './generate'

const program = new Command()

program.name('notion-schema').version('1.0.0')

// 共通オプション: --config を受け取る
let configPath = 'notion.config.ts' // デフォルトの設定ファイル名

program.option('-c, --config <path>', 'Path to the configuration file', (value) => {
  configPath = value
})

program
  .command('init')
  .description('Initialize the configuration file for notion-schema')
  .action(() => {
    const resolvedConfigPath = path.resolve(process.cwd(), configPath)
    if (fs.existsSync(resolvedConfigPath)) {
      console.error(`Config file already exists: ${resolvedConfigPath}`)
      process.exit(1)
    }
    fs.writeFileSync(
      resolvedConfigPath,
      `export interface NotionConfig {
  databases: Record<string, string>;
  outputDir: string;
}

const config: NotionConfig = {
  databases: {},
  outputDir: './generated',
};

export default config;`,
    )
    console.log(`Created configuration file at: ${resolvedConfigPath}`)
  })

program
  .command('generate')
  .description('Generate TypeScript types from Notion databases')
  .action(async () => {
    try {
      await generateTypes(configPath) // configPathを渡す
    } catch (err) {
      console.error(err.message)
    }
  })

program.parse(process.argv)
