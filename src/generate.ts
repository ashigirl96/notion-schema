import * as fs from 'node:fs'
import * as path from 'node:path'
import { Client } from '@notionhq/client'
import { compile } from 'json-schema-to-typescript'
import { loadConfig } from './config'

async function generateType(client: Client, databaseId: string, name: string, outputDir: string) {
  const response = await client.databases.retrieve({ database_id: databaseId })

  const schema = {
    title: name,
    type: 'object',
    properties: {} as Record<string, object>,
  }

  for (const [key, property] of Object.entries(response.properties)) {
    if (property.type === 'select') {
      schema.properties[key] = {
        type: 'string',
        enum: property.select.options.map((option) => option.name),
      }
    } else {
      schema.properties[key] = { type: 'string' } // 他の型も適宜対応
    }
  }

  const types = await compile(schema, name)
  const outputPath = path.resolve(outputDir, `${name}.d.ts`)
  fs.writeFileSync(outputPath, types)
  console.log(`Generated type for ${name}: ${outputPath}`)
}

export async function generateTypes(configPath: string) {
  const config = await loadConfig(configPath)
  const { databases, outputDir, apiKey } = config

  const client = new Client({ auth: apiKey })

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const entries: [string, string][] = Object.entries(databases)
  for (const [name, databaseId] of entries) {
    await generateType(client, databaseId, name, outputDir)
  }
}
