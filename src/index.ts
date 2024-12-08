import { Project, SyntaxKind } from 'ts-morph'

// プロジェクトを作成
const project = new Project()

// ソースファイルを作成
const sourceFile = project.createSourceFile(
  'example.ts',
  `
  type B = string;
type A = B | C;
type D = E | F;
type G = H | I;
`,
)

// 指定した型が他の型エイリアスに含まれているかを探す関数
function findAndModifyType(targetType: string, sourceFile: typeof sourceFile) {
  const typeAliases = sourceFile.getTypeAliases()

  for (const typeAlias of typeAliases) {
    const typeNode = typeAlias.getTypeNode()

    // UnionTypeNode を持つ場合
    if (typeNode.isKind(SyntaxKind.UnionType)) {
      const typeNodes = typeNode.getTypeNodes()
      const targetNode = typeNodes.find((node) => node.getText() === targetType)

      if (targetNode) {
        // B に T を追加
        targetNode.replaceWithText(`${targetType}<T>`)

        // A にジェネリックを追加
        const typeParams = typeAlias.getTypeParameters()
        if (typeParams.length === 0) {
          typeAlias.addTypeParameter({ name: 'T' })
        }

        console.log(`Modified type alias: ${typeAlias.getName()}`)
        console.log(sourceFile.getFullText())
        return
      }
    }

    // if (typeNode && typeNode.getKind() === SyntaxKind.TypeReference) {
    //   const typeRef = typeNode.asKind(SyntaxKind.TypeReference)
    //   console.log(typeRef)
    //   if (typeRef) {
    //     const typeName = typeRef.getTypeName().getText()
    //     if (typeName === targetType) {
    //       // B に T を追加
    //       for (const arg of typeRef.getTypeArguments()) {
    //         arg.replaceWithText(`${targetType}<T>`)
    //       }
    //
    //       // A にジェネリックを追加
    //       const typeParams = typeAlias.getTypeParameters()
    //       if (typeParams.length === 0) {
    //         typeAlias.addTypeParameter({ name: 'T' })
    //       }
    //
    //       console.log(`Modified type alias: ${typeAlias.getName()}`)
    //       console.log(sourceFile.getFullText())
    //       return
    //     }
    //   }
    // }
  }

  console.log(`Type ${targetType} is not found in any type alias`)
}

// B を含む型エイリアスを探し、修正
findAndModifyType('B', sourceFile)
