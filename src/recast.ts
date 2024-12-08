import path from 'node:path'
import { builders as b } from 'ast-types'
import recast from 'recast'
import { Project, ts } from 'ts-morph'
import SyntaxKind = ts.SyntaxKind

export function createNotionDefinitions(propertyNames: string[]) {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  })

  const notionApiEndpointsFile = project.addSourceFileAtPath(
    path.resolve(__dirname, '../node_modules/@notionhq/client/build/src/api-endpoints.d.ts'),
  )

  const genericTypes = new Set<string>()

  for (const typeAlias of notionApiEndpointsFile.getTypeAliases()) {
    const typeNode = typeAlias.getTypeNode()

    if (typeNode && typeNode.getKind() === SyntaxKind.TypeLiteral) {
      const typeLiteral = typeNode.asKind(SyntaxKind.TypeLiteral) // 型リテラルとしてキャスト
      if (typeLiteral) {
        const propertiesMember = typeLiteral
          .getMembers()
          // @ts-expect-error
          .find((member) => member.getName() === 'properties')
        if (propertiesMember) {
          genericTypes.add(typeAlias.getName())

          propertiesMember.replaceWithText('properties: T')
          typeAlias.addTypeParameter({
            name: 'T',
            constraint: propertyNames.join(' | '),
          })
        }
      }
    }
  }

  // TODO: more smart...
  for (const typeAlias of notionApiEndpointsFile.getTypeAliases()) {
    const type = typeAlias.getTypeNode()
    if (type && genericTypes.has(type.getText())) {
      type.replaceWithText(`${type.getText()}<T>`)
      const typeParams = typeAlias.getTypeParameters()
      if (typeParams.length === 0) {
        typeAlias.addTypeParameter({ name: 'T', constraint: propertyNames.join(' | ') })
      }
    }
    const typeNode = typeAlias.getTypeNode()
    if (typeNode?.isKind(SyntaxKind.UnionType)) {
      const typeUnion = typeNode.asKind(SyntaxKind.UnionType)
      if (typeUnion) {
        for (const type of typeUnion.getTypeNodes()) {
          if (genericTypes.has(type.getText())) {
            type.replaceWithText(`${type.getText()}<T>`)
            const typeParams = typeAlias.getTypeParameters()
            if (typeParams.length === 0) {
              typeAlias.addTypeParameter({ name: 'T', constraint: propertyNames.join(' | ') })
            }
          }
        }
      }
    }
    if (typeNode?.isKind(SyntaxKind.IntersectionType)) {
      const typeIntersection = typeNode.asKind(SyntaxKind.IntersectionType)
      if (typeIntersection) {
        for (const type of typeIntersection.getTypeNodes()) {
          if (genericTypes.has(type.getText())) {
            type.replaceWithText(`${type.getText()}<T>`)
            const typeParams = typeAlias.getTypeParameters()
            if (typeParams.length === 0) {
              typeAlias.addTypeParameter({ name: 'T', constraint: propertyNames.join(' | ') })
            }
          }
        }
      }
    }
  }

  return notionApiEndpointsFile.getFullText()
}

export function createTypeDefinition(response: any, name: string) {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  })
  const typeDefinition = _createTypeDefinition(response)

  const sourceFile = project.createSourceFile('NotionDatabase.ts', typeDefinition)

  // 型解析結果を文字列として出力
  const outputFileName = 'ExpandedNotionDatabase.ts'

  const typeAlias = sourceFile.getTypeAliasOrThrow('NotionDatabase')
  const notionDatabaseType = typeAlias.getType()

  // 各プロパティの型を解析
  const properties = notionDatabaseType.getProperties()

  const expandedDefinitions: string[] = []
  const propertyName = `${name}Properties`
  expandedDefinitions.push(`export type ${propertyName} = {`)
  for (const property of properties) {
    const propName = property.getName()
    const propType = property.getTypeAtLocation(typeAlias).getText()
    expandedDefinitions.push(`  ${propName}: ${propType};`)
  }
  expandedDefinitions.push('};')

  // 新しいソースファイルを作成
  const expandedSource = expandedDefinitions.join('\n')
  const expandedFile = project.createSourceFile(outputFileName, expandedSource)

  const propertyTypeAlias = expandedFile.getTypeAliasOrThrow(propertyName)
  const propertyTypeLiteral = propertyTypeAlias
    .getTypeNodeOrThrow()
    .asKindOrThrow(SyntaxKind.TypeLiteral)

  // TODO: enumの型を解析
  for (const [propertyKey, value] of Object.entries(response.properties)) {
    // _keyの最初の文字を大文字に変換
    // @ts-expect-error
    if (value.type === 'select' || value.type === 'multi_select') {
      const _key = propertyKey.charAt(0).toUpperCase() + propertyKey.slice(1)
      const enumName = `${name}${_key}Enum`
      expandedFile.addEnum({
        name: enumName,
        // @ts-expect-error
        members: value[value.type].options.map((option) => ({
          name: option.name,
          initializer: `"${option.name}"`,
        })),
      })

      for (const property of propertyTypeLiteral.getProperties()) {
        if (property.getName() === propertyKey) {
          const propertyTypeNode = property.getTypeNodeOrThrow()
          propertyTypeNode
            .getDescendantsOfKind(SyntaxKind.PropertySignature)
            .forEach((descendant) => {
              if (descendant.getName() === value.type) {
                const unionTypeNode = descendant.getTypeNodeOrThrow()
                unionTypeNode
                  .getDescendantsOfKind(SyntaxKind.TypeLiteral)
                  .forEach((_typeLiteral) => {
                    _typeLiteral.getProperties().forEach((selectProperty) => {
                      if (selectProperty.getName() === 'name') {
                        selectProperty.setType(enumName)
                      }
                    })
                  })
              }
            })
        }
      }
    }
  }

  return {
    name: propertyName,
    type: expandedFile.getFullText(),
  }
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
