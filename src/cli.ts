#!/usr/bin/env bun

import * as fs from 'node:fs'
import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { join } from 'node:path'
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

    const __filename = join(new URL('', import.meta.url).pathname, '..', 'default')
    const fileContent = readFileSync(__filename, 'utf-8')

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
      // @ts-expect-error
      console.error(err.message)
    }
  })

program.parse(process.argv)
