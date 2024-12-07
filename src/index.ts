import path from 'node:path'
import { Project } from 'ts-morph'

function notionDefinitions() {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  })

  // `@notionhq/client/build/src/api-endpoints` の型ファイルを追加
  const notionApiEndpointsFile = project.addSourceFileAtPath(
    path.resolve(__dirname, '../node_modules/@notionhq/client/build/src/api-endpoints.d.ts'),
  )
  return notionApiEndpointsFile.getTypeAliases()
}

console.log(notionDefinitions())
