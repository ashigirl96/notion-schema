import * as fs from 'node:fs'
import * as path from 'node:path'
import { Client } from '@notionhq/client'
import { compile } from 'json-schema-to-typescript'
import { loadConfig } from './config'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

async function generateType(databaseId: string, name: string, outputDir: string) {
  const response = await notion.databases.retrieve({ database_id: databaseId })

  const schema = {
    title: name,
    type: 'object',
    properties: {},
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
  const { databases, outputDir } = config

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const entries: [string, string][] = Object.entries(databases)
  for (const [name, databaseId] of entries) {
    await generateType(databaseId, name, outputDir)
  }
}
