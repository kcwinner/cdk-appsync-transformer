export interface CdkTransformerTableKey {
  readonly name: string;
  readonly type: string;
}

export interface CdkTransformerGlobalSecondaryIndex {
  readonly indexName: string;
  readonly projection: any;
  readonly partitionKey: CdkTransformerTableKey;
  readonly sortKey: CdkTransformerTableKey;
}

export interface CdkTransformerTable {
  readonly tableName: string;
  readonly partitionKey: CdkTransformerTableKey;
  readonly sortKey?: CdkTransformerTableKey;
  readonly ttl?: any; // TODO: Figure this out
  readonly globalSecondaryIndexes: CdkTransformerGlobalSecondaryIndex[];
  readonly resolvers: string[];
  readonly gsiResolvers: string[];
}

export interface CdkTransformerResolver {
  readonly typeName: string;
  readonly fieldName: string;
}

export interface CdkTransformerFunctionResolver extends CdkTransformerResolver {
  readonly defaultRequestMappingTemplate: string;
  readonly defaultResponseMappingTemplate: string;
}

export interface SchemaTransformerOutputs {
  readonly cdkTables?: { [name: string]: CdkTransformerTable };
  readonly noneResolvers?: { [name: string]: CdkTransformerResolver };
  readonly functionResolvers?: { [name: string]: CdkTransformerResolver[] };
  readonly queries?: { [name: string]: string };
  readonly mutations?: { [name: string]: CdkTransformerResolver };
  readonly subscriptions?: { [name: string]: CdkTransformerResolver };
}