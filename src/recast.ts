import path from 'node:path'
import { builders as b } from 'ast-types'
import recast from 'recast'
import { Project } from 'ts-morph'
// import {CreatePageParameters} from "@notionhq/client/build/src/api-endpoints";

// type Hoge = CreatePageParameters

export function createTypeDefinition(response: any) {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  })
  const notionClientTypeFile = path.resolve(
    __dirname,
    '../node_modules/@notionhq/client/build/src/api-endpoints.d.ts',
  )
  project.addSourceFileAtPath(notionClientTypeFile)

  const typeDefinition = _createTypeDefinition(response)

  const sourceFile = project.createSourceFile('NotionDatabase.ts', typeDefinition)

  // 型解析結果を文字列として出力
  const outputFileName = 'ExpandedNotionDatabase.ts'

  const typeAlias = sourceFile.getTypeAliasOrThrow('NotionDatabase')
  const notionDatabaseType = typeAlias.getType()

  // 各プロパティの型を解析
  const properties = notionDatabaseType.getProperties()

  const expandedDefinitions: string[] = []
  expandedDefinitions.push('export type ExpandedNotionDatabase = {')
  for (const property of properties) {
    const propName = property.getName()
    const propType = property.getTypeAtLocation(typeAlias).getText()
    console.log(propName, propType)
    expandedDefinitions.push(`  ${propName}: ${propType};`)
  }
  expandedDefinitions.push('};')

  // 新しいソースファイルを作成
  const expandedSource = expandedDefinitions.join('\n')
  const expandedFile = project.createSourceFile(outputFileName, expandedSource)

  return expandedFile.getFullText()
}

export function _createTypeDefinition(response: any): string {
  // 文字列でtype aliasを定義
  const typeDefinitions = `
    import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
    
    type PropertyUnion = CreatePageParameters['properties'][string];
    type PropertyType<T extends string> = Extract<PropertyUnion, { type?: T }>
  `

  // 上記のtype定義文字列をASTにパース
  const typeDefsAst = recast.parse(typeDefinitions, {
    parser: require('recast/parsers/typescript'),
  })

  // メインとなるNotionDatabase型のASTを生成
  const fields = Object.entries(response.properties).map(([key, value]: [string, any]) => {
    const tsType = mapNotionTypeToTSType(value.type)
    return b.tsPropertySignature(b.identifier(key), b.tsTypeAnnotation(tsType))
  })

  const typeLiteral = b.tsTypeLiteral(fields)
  const notionDatabaseAlias = b.tsTypeAliasDeclaration(b.identifier('NotionDatabase'), typeLiteral)
  const notionDatabaseExport = b.exportNamedDeclaration(notionDatabaseAlias)

  // 全体のASTを構築
  const ast = b.file(b.program([...typeDefsAst.program.body, notionDatabaseExport]))

  return recast.print(ast).code
}

function mapNotionTypeToTSType(notionType: string) {
  // PropertyType<'xxx'> を返すためにtsTypeReference＋tsTypeParameterInstantiationを利用
  const propTypeRef = (key: string) =>
    b.tsTypeReference(
      b.identifier('PropertyType'),
      b.tsTypeParameterInstantiation([b.tsLiteralType(b.stringLiteral(key))]),
    )
  return propTypeRef(notionType)
}
