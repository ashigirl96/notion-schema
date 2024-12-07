import * as fs from 'node:fs'
import * as path from 'node:path'
import { Client } from '@notionhq/client'
import type { JSONSchema4 } from 'json-schema'
import { loadConfig } from './config'

async function generateType(client: Client, databaseId: string, name: string, _outputDir: string) {
  const response = await client.databases.retrieve({ database_id: databaseId })

  const schema: JSONSchema4 = {
    title: name,
    type: 'object',
    properties: {} as Record<string, object>,
  }

  for (const [key, property] of Object.entries(response.properties)) {
    if (property.type === 'select') {
      // @ts-expect-error
      schema.properties[key] = {
        type: 'string',
        enum: property.select.options.map((option) => option.name),
      }
    } else {
      // @ts-expect-error
      schema.properties[key] = { type: 'st' } // 他の型も適宜対応
    }
  }
  return ''
}

export async function generateTypes(configPath: string) {
  const config = await loadConfig(configPath)
  const { databases, outputDir, apiKey } = config

  const client = new Client({ auth: apiKey })

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const entries: [string, string][] = Object.entries(databases)
  const types = (
    await Promise.all(
      entries.map(([name, databaseId]) => {
        return generateType(client, databaseId, name, outputDir)
      }),
    )
  ).join('\n')
  const outputPath = path.resolve(outputDir, 'index.d.ts')
  fs.writeFileSync(outputPath, types)
}
