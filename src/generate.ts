import * as fs from 'node:fs'
import * as path from 'node:path'
import { createTypeDefinition } from '@/recast'
import { Client } from '@notionhq/client'
import { loadConfig } from './config'

async function generateType(client: Client, databaseId: string, _name: string, _outputDir: string) {
  const response = await client.databases.retrieve({ database_id: databaseId })
  return createTypeDefinition(response)
}

export async function generateTypes(configPath: string) {
  const config = await loadConfig(configPath)
  const { databases, outputDir, apiKey } = config

  const client = new Client({ auth: apiKey })

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const entries: [string, string][] = Object.entries(databases)
  const types = await Promise.all(
    entries.map(([name, databaseId]) => {
      return generateType(client, databaseId, name, outputDir)
    }),
  )
  const outputPath = path.resolve(outputDir, 'index.d.ts')
  fs.writeFileSync(outputPath, types.join('\n'))
}

// function notionDefinitions() {
//   const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
//   const project = new Project({
//     tsConfigFilePath: tsconfigPath,
//   })
//
//   // `@notionhq/client/build/src/api-endpoints` の型ファイルを追加
//   const notionApiEndpointsFile = project.addSourceFileAtPath(
//     path.resolve(__dirname, '../node_modules/@notionhq/client/build/src/api-endpoints.d.ts'),
//   )
//   return notionApiEndpointsFile.getFullText()
// }
