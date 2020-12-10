import { MappingTemplate } from '@aws-cdk/aws-appsync';
import { Transformer, TransformerContext, getFieldArguments } from 'graphql-transformer-core';

const graphqlTypeStatements = ['Query', 'Mutation', 'Subscription'];

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

export class CdkTransformer extends Transformer {
  tables: { [name: string]: CdkTransformerTable };
  noneDataSources: { [name: string]: CdkTransformerResolver };
  functionResolvers: { [name: string]: CdkTransformerFunctionResolver[] };
  resolverTableMap: { [name: string]: string };
  gsiResolverTableMap: { [name: string]: string };

  constructor() {
    super(
      'CdkTransformer',
      'directive @nullable on FIELD_DEFINITION', // this is unused
    );

    this.tables = {};
    this.noneDataSources = {};
    this.functionResolvers = {};
    this.resolverTableMap = {};
    this.gsiResolverTableMap = {};
  }

  public after = (ctx: TransformerContext): void => {
    this.buildResources(ctx);

    // TODO: Improve this iteration
    Object.keys(this.tables).forEach(tableName => {
      let table = this.tables[tableName];
      Object.keys(this.resolverTableMap).forEach(resolverName => {
        if (this.resolverTableMap[resolverName] === tableName) table.resolvers.push(resolverName);
      });

      Object.keys(this.gsiResolverTableMap).forEach(resolverName => {
        if (this.gsiResolverTableMap[resolverName] === tableName) table.gsiResolvers.push(resolverName);
      });
    });

    // @ts-ignore - we are overloading the use of outputs here...
    ctx.setOutput('cdkTables', this.tables);

    // @ts-ignore - we are overloading the use of outputs here...
    ctx.setOutput('noneResolvers', this.noneDataSources);

    // @ts-ignore - we are overloading the use of outputs here...
    ctx.setOutput('functionResolvers', this.functionResolvers);

    const query = ctx.getQuery();
    if (query) {
      const queryFields = getFieldArguments(query);
      ctx.setOutput('queries', queryFields);
    }

    const mutation = ctx.getMutation();
    if (mutation) {
      const mutationFields = getFieldArguments(mutation);
      ctx.setOutput('mutations', mutationFields);
    }

    const subscription = ctx.getSubscription();
    if (subscription) {
      const subscriptionFields = getFieldArguments(subscription);
      ctx.setOutput('subscriptions', subscriptionFields);
    }
  }

  private buildResources(ctx: TransformerContext): void {
    const templateResources = ctx.template.Resources;
    if (!templateResources) return;

    for (const [resourceName, resource] of Object.entries(templateResources)) {
      if (resource.Type === 'AWS::DynamoDB::Table') {
        this.buildTablesFromResource(resourceName, ctx);
      } else if (resource.Type === 'AWS::AppSync::Resolver') {
        if (resource.Properties?.DataSourceName === 'NONE') {
          this.noneDataSources[resource.Properties.FieldName] = {
            typeName: resource.Properties.TypeName,
            fieldName: resource.Properties.FieldName,
          };
        } else if (resource.Properties?.Kind === 'PIPELINE') {
          // Inspired by:
          // https://github.com/aws-amplify/amplify-cli/blob/master/packages/graphql-function-transformer/src/__tests__/FunctionTransformer.test.ts#L20
          const dependsOn = resource.DependsOn as string ?? '';
          const functionConfiguration = templateResources[dependsOn];
          const functionDependsOn = functionConfiguration.DependsOn as string ?? '';
          const functionDataSource = templateResources[functionDependsOn];
          const functionArn = functionDataSource.Properties?.LambdaConfig?.LambdaFunctionArn?.payload[1].payload[0];
          const functionName = functionArn.split(':').slice(-1)[0];

          const fieldName = resource.Properties.FieldName;
          const typeName = resource.Properties.TypeName;

          if (!this.functionResolvers[functionName]) this.functionResolvers[functionName] = [];

          this.functionResolvers[functionName].push({
            typeName: typeName,
            fieldName: fieldName,
            defaultRequestMappingTemplate: MappingTemplate.lambdaRequest().renderTemplate(),
            defaultResponseMappingTemplate: functionConfiguration.Properties?.ResponseMappingTemplate, // This should handle error messages
          });
        } else { // Should be a table/model resolver -> Maybe not true when we add in @searchable, etc
          let typeName = resource.Properties?.TypeName;
          let fieldName = resource.Properties?.FieldName;
          let tableName = resource.Properties?.DataSourceName?.payload[0];
          tableName = tableName.replace('DataSource', 'Table');

          if (graphqlTypeStatements.indexOf(typeName) >= 0) {
            this.resolverTableMap[fieldName] = tableName;
          } else { // this is a GSI
            this.gsiResolverTableMap[`${typeName}${fieldName}`] = tableName;
          }
        }
      }
    }
  }

  private buildTablesFromResource(resourceName: string, ctx: TransformerContext): void {
    const tableResource = ctx.template.Resources ? ctx.template.Resources[resourceName] : undefined;

    const attributeDefinitions = tableResource?.Properties?.AttributeDefinitions;
    const keySchema = tableResource?.Properties?.KeySchema;

    const keys = this.parseKeySchema(keySchema, attributeDefinitions);

    let table: CdkTransformerTable = {
      tableName: resourceName,
      partitionKey: keys.partitionKey,
      sortKey: keys.sortKey,
      ttl: tableResource?.Properties?.TimeToLiveSpecification,
      globalSecondaryIndexes: [],
      resolvers: [],
      gsiResolvers: [],
    };

    const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
    if (gsis) {
      gsis.forEach((gsi: any) => {
        const gsiKeys = this.parseKeySchema(gsi.KeySchema, attributeDefinitions);
        const gsiDefinition = {
          indexName: gsi.IndexName,
          projection: gsi.Projection,
          partitionKey: gsiKeys.partitionKey,
          sortKey: gsiKeys.sortKey,
        };

        table.globalSecondaryIndexes.push(gsiDefinition);
      });
    }

    this.tables[resourceName] = table;
  }

  private parseKeySchema(keySchema: any, attributeDefinitions: any) {
    let partitionKey: any = {};
    let sortKey: any = {};

    keySchema.forEach((key: any) => {
      const keyType = key.KeyType;
      const attributeName = key.AttributeName;

      const attribute = attributeDefinitions.find((attr: any) => attr.AttributeName === attributeName);

      if (keyType === 'HASH') {
        partitionKey = {
          name: attribute.AttributeName,
          type: attribute.AttributeType,
        };
      } else if (keyType === 'RANGE') {
        sortKey = {
          name: attribute.AttributeName,
          type: attribute.AttributeType,
        };
      }
    });

    return { partitionKey, sortKey };
  }
}