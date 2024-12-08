import path from 'node:path'
import { builders as b } from 'ast-types'
import recast from 'recast'
import { Project, ts } from 'ts-morph'

const { SyntaxKind } = ts

const UNION_PROPERTIES = 'PropertiesUnion'
export function createUnionPropertyDefinition(propertyNames: string[]): string {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  })

  const sourceFile = project.createSourceFile(
    'UnionProperties.ts',
    `export type ${UNION_PROPERTIES} = ${propertyNames.join(' | ')};`,
  )
  return sourceFile.getFullText()
}

/**
 * Notion APIの型定義に対して、`properties`フィールドをジェネリック化し、
 * propertyNamesのリテラルユニオンをTとしてTypeAliasに付与します。
 */
export function createNotionDefinitions(): string {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  })

  const notionApiEndpointsFile = project.addSourceFileAtPath(
    path.resolve(__dirname, '../node_modules/@notionhq/client/build/src/api-endpoints.d.ts'),
  )

  const propertyGenericTypeAliases = new Set<string>()

  for (const typeAlias of notionApiEndpointsFile.getTypeAliases()) {
    const typeNode = typeAlias.getTypeNode()
    if (!typeNode || typeNode.getKind() !== SyntaxKind.TypeLiteral) continue

    const typeLiteral = typeNode.asKind(SyntaxKind.TypeLiteral)
    if (!typeLiteral) continue

    // `properties` メンバーを探す
    const propertiesSignature = typeLiteral
      .getMembers()
      .find((member) => member.getName?.() === 'properties')
    if (propertiesSignature) {
      propertyGenericTypeAliases.add(typeAlias.getName())
      // TODO: ResponseのときだけPartialにしないけど、大丈夫そ？
      if (typeAlias.getName().includes('Response')) {
        propertiesSignature.replaceWithText('properties: T')
      } else {
        propertiesSignature.replaceWithText('properties: Partial<T>')
      }
      typeAlias.addTypeParameter({
        name: 'T',
        constraint: UNION_PROPERTIES,
      })
    }
  }

  // 追加したGenericTypeを使用するTypeAliasにTを渡す
  for (const typeAlias of notionApiEndpointsFile.getTypeAliases()) {
    const typeNode = typeAlias.getTypeNode()
    if (!typeNode) continue

    const applyGenericsIfNeeded = (node: import('ts-morph').TypeNode) => {
      if (propertyGenericTypeAliases.has(node.getText())) {
        node.replaceWithText(`${node.getText()}<T>`)
        if (typeAlias.getTypeParameters().length === 0) {
          typeAlias.addTypeParameter({ name: 'T', constraint: UNION_PROPERTIES })
        }
      }
    }

    // 直接のTypeNode
    applyGenericsIfNeeded(typeNode)

    // Unionタイプ
    if (typeNode.isKind(SyntaxKind.UnionType)) {
      const union = typeNode.asKind(SyntaxKind.UnionType)
      if (union) {
        for (const unionTypeNode of union.getTypeNodes()) {
          applyGenericsIfNeeded(unionTypeNode)
        }
      }
    }

    // Intersectionタイプ
    if (typeNode.isKind(SyntaxKind.IntersectionType)) {
      const intersection = typeNode.asKind(SyntaxKind.IntersectionType)
      if (intersection) {
        for (const intersectionTypeNode of intersection.getTypeNodes()) {
          applyGenericsIfNeeded(intersectionTypeNode)
        }
      }
    }
  }

  return notionApiEndpointsFile.getFullText()
}

/**
 * レスポンスから新たな型定義ファイルを生成します。
 * NotionDatabaseを解析し、`name`を元にしたProperties型やenum定義を作成します。
 */
export function createTypeDefinition(response: any, name: string) {
  const tsconfigPath = path.resolve(__dirname, '../tsconfig.json')
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  })

  const generatedTypeDefinition = _createTypeDefinition(response)
  const sourceFile = project.createSourceFile('NotionDatabase.ts', generatedTypeDefinition)

  const expandedTypeFileName = 'ExpandedNotionDatabase.ts'
  const typeAlias = sourceFile.getTypeAliasOrThrow('NotionDatabase')
  const notionDatabaseType = typeAlias.getType()

  const databaseProperties = notionDatabaseType.getProperties()
  const expandedPropertyTypeName = `${name}Properties`

  const expandedTypeDefinitions: string[] = []
  expandedTypeDefinitions.push(`export type ${expandedPropertyTypeName} = {`)
  for (const property of databaseProperties) {
    const propName = property.getName()
    const propType = property.getTypeAtLocation(typeAlias).getText()
    expandedTypeDefinitions.push(`  ${propName}: ${propType};`)
  }
  expandedTypeDefinitions.push('};')

  const expandedSource = expandedTypeDefinitions.join('\n')
  const expandedFile = project.createSourceFile(expandedTypeFileName, expandedSource)

  const propertyTypeAlias = expandedFile.getTypeAliasOrThrow(expandedPropertyTypeName)
  const propertyTypeLiteral = propertyTypeAlias
    .getTypeNodeOrThrow()
    .asKindOrThrow(SyntaxKind.TypeLiteral)

  // enum定義生成
  for (const [propertyKey, value] of Object.entries(response.properties)) {
    // @ts-expect-error
    if (value.type === 'select' || value.type === 'multi_select') {
      const capitalizedPropertyKey = propertyKey.charAt(0).toUpperCase() + propertyKey.slice(1)
      const enumName = `${name}${capitalizedPropertyKey}Enum`
      // @ts-expect-error
      const enumOptions = value[value.type]?.options || []

      expandedFile.addEnum({
        isExported: true,
        name: enumName,
        members: enumOptions.map((option: any) => ({
          name: option.name,
          initializer: `"${option.name}"`,
        })),
      })

      // プロパティの型定義をenumに差し替え
      for (const prop of propertyTypeLiteral.getProperties()) {
        if (prop.getName() !== propertyKey) continue
        const propertyTypeNode = prop.getTypeNodeOrThrow()
        propertyTypeNode
          .getDescendantsOfKind(SyntaxKind.PropertySignature)
          .forEach((descendant) => {
            // @ts-expect-error
            if (descendant.getName() !== value.type) return
            descendant
              .getTypeNodeOrThrow()
              .getDescendantsOfKind(SyntaxKind.TypeLiteral)
              .forEach((literal) => {
                literal.getProperties().forEach((selectProp) => {
                  if (selectProp.getName() === 'name') {
                    selectProp.setType(enumName)
                  }
                })
              })
          })
      }
    }
  }

  return {
    name: expandedPropertyTypeName,
    type: expandedFile.getFullText(),
  }
}

/**
 * 指定された`response`オブジェクトからNotionDatabase型を生成します。
 * Notionのプロパティタイプは`PropertyType<"type">`で表現します。
 */
export function _createTypeDefinition(response: any): string {
  const typeDefinitionHeader = `
    import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
    
    type PropertyUnion = CreatePageParameters['properties'][string];
    type PropertyType<T extends string> = Extract<PropertyUnion, { type?: T }>;
  `

  const typeDefsAst = recast.parse(typeDefinitionHeader, {
    parser: require('recast/parsers/typescript'),
  })

  const notionPropertySignatures = Object.entries(response.properties).map(
    ([key, value]: [string, any]) => {
      const mappedPropertyType = mapNotionPropertyTypeToTSType(value.type)
      return b.tsPropertySignature(b.identifier(key), b.tsTypeAnnotation(mappedPropertyType))
    },
  )

  const typeLiteral = b.tsTypeLiteral(notionPropertySignatures)
  const notionDatabaseAlias = b.tsTypeAliasDeclaration(b.identifier('NotionDatabase'), typeLiteral)
  const notionDatabaseExport = b.exportNamedDeclaration(notionDatabaseAlias)

  const ast = b.file(b.program([...typeDefsAst.program.body, notionDatabaseExport]))
  return recast.print(ast).code
}

/**
 * NotionのプロパティタイプをTS型定義にマッピングします。
 * `PropertyType<"notionType">`という形で返します。
 */
function mapNotionPropertyTypeToTSType(notionType: string) {
  const createPropertyTypeReference = (key: string) =>
    b.tsTypeReference(
      b.identifier('PropertyType'),
      b.tsTypeParameterInstantiation([b.tsLiteralType(b.stringLiteral(key))]),
    )

  return createPropertyTypeReference(notionType)
}
