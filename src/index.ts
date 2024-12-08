import fs from 'node:fs'
import path from 'node:path'
import { Client as NotionClient } from '@notionhq/client'

const TYPE_FILE_PATH = path.resolve(__dirname, 'types.d.ts')

// 型ファイルの存在を確認
if (!fs.existsSync(TYPE_FILE_PATH)) {
  throw new Error(
    `Type definitions file not found. Please run the CLI to generate 'src/types.d.ts'.`,
  )
}

import type {
  AppendBlockChildrenParameters,
  AppendBlockChildrenResponse,
  CreateDatabaseParameters,
  CreateDatabaseResponse,
  CreatePageParameters,
  CreatePageResponse,
  DeleteBlockParameters,
  DeleteBlockResponse,
  GetBlockParameters,
  GetBlockResponse,
  GetPageParameters,
  GetPagePropertyParameters,
  GetPagePropertyResponse,
  GetPageResponse,
  ListBlockChildrenParameters,
  ListBlockChildrenResponse,
  ListDatabasesParameters,
  ListDatabasesResponse,
  PropertiesUnion,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
  SearchParameters,
  SearchResponse,
  UpdateBlockParameters,
  UpdateBlockResponse,
  UpdateDatabaseParameters,
  UpdateDatabaseResponse,
  UpdatePageParameters,
  UpdatePageResponse,
} from './types'

type options = ConstructorParameters<typeof NotionClient>[0]

type WithAuth<P> = P & {
  auth?: string
}

export class Client {
  private readonly client: NotionClient
  private blocks: {
    retrieve: (args: WithAuth<GetBlockParameters>) => Promise<GetBlockResponse>
    update: (args: WithAuth<UpdateBlockParameters>) => Promise<UpdateBlockResponse>
    delete: (args: WithAuth<DeleteBlockParameters>) => Promise<DeleteBlockResponse>
    children: {
      append: (
        args: WithAuth<AppendBlockChildrenParameters>,
      ) => Promise<AppendBlockChildrenResponse>
      list: (args: WithAuth<ListBlockChildrenParameters>) => Promise<ListBlockChildrenResponse>
    }
  }
  private search: (args: WithAuth<SearchParameters>) => Promise<SearchResponse>
  constructor(options?: options) {
    this.client = new NotionClient(options)
    this.blocks = this.client.blocks
    this.search = this.client.search
  }

  public databases = {
    list: (args: WithAuth<ListDatabasesParameters>): Promise<ListDatabasesResponse> => {
      return this.client.databases.list(args)
    },
    retrieve: <T extends PropertiesUnion>(
      args: WithAuth<GetPageParameters>,
    ): Promise<GetPageResponse<T>> => {
      return this.client.pages.retrieve(args)
    },
    query: (args: WithAuth<QueryDatabaseParameters>): Promise<QueryDatabaseResponse> => {
      return this.client.databases.query(args)
    },
    create: <T extends PropertiesUnion>(
      args: WithAuth<CreateDatabaseParameters<T>>,
    ): Promise<CreateDatabaseResponse<T>> => {
      return this.client.databases.create(args)
    },
    update: <T extends PropertiesUnion>(
      args: WithAuth<UpdateDatabaseParameters<T>>,
    ): Promise<UpdateDatabaseResponse<T>> => {
      return this.client.databases.update(args)
    },
  }

  public pages = {
    create: <T extends PropertiesUnion>(
      args: WithAuth<CreatePageParameters<T>>,
    ): Promise<CreatePageResponse<T>> => {
      return this.client.pages.create(args)
    },
    retrieve: <T extends PropertiesUnion>(
      args: WithAuth<GetPageParameters>,
    ): Promise<GetPageResponse<T>> => {
      return this.client.pages.retrieve(args)
    },
    update: <T extends PropertiesUnion>(
      args: WithAuth<UpdatePageParameters<T>>,
    ): Promise<UpdatePageResponse<T>> => {
      return this.client.pages.update(args)
    },
    properties: {
      retrieve: (args: WithAuth<GetPagePropertyParameters>): Promise<GetPagePropertyResponse> => {
        return this.client.pages.properties.retrieve(args)
      },
    },
  }
}
