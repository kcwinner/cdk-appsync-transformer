import {
  GraphqlApi,
  AuthorizationType,
  FieldLogLevel,
  MappingTemplate,
  CfnDataSource,
  Resolver,
  AuthorizationConfig,
  Schema,
  DataSourceOptions,
  LambdaDataSource,
} from '@aws-cdk/aws-appsync';

import {
  Table,
  AttributeType,
  ProjectionType,
  BillingMode,
} from '@aws-cdk/aws-dynamodb';
import { Effect, PolicyStatement } from '@aws-cdk/aws-iam';
import { IFunction } from '@aws-cdk/aws-lambda';
import { Construct, NestedStack, CfnOutput } from '@aws-cdk/core';
import { ITransformer } from 'graphql-transformer-core';

import {
  CdkTransformerResolver,
  CdkTransformerFunctionResolver,
  CdkTransformerHttpResolver,
  CdkTransformerTable,
  SchemaTransformerOutputs,
} from './transformer';

import {
  SchemaTransformer,
  SchemaTransformerProps,
} from './transformer/schema-transformer';

export interface AppSyncTransformerProps {
  /**
   * Relative path where schema.graphql exists
   */
  readonly schemaPath: string;

  /**
   * Optional. {@link AuthorizationConfig} type defining authorization for AppSync GraphqlApi. Defaults to API_KEY
   * @default API_KEY authorization config
   */
  readonly authorizationConfig?: AuthorizationConfig;

  /**
   * String value representing the api name
   * @default `${id}-api`
   */
  readonly apiName?: string;

  /**
   * Whether to enable Amplify DataStore and Sync Tables
   * @default false
   */
  readonly syncEnabled?: boolean;

  /**
   * Optional. {@link FieldLogLevel} type for AppSync GraphqlApi log level
   * @default FieldLogLevel.NONE
   */
  readonly fieldLogLevel?: FieldLogLevel;

  /**
   * Determines whether xray should be enabled on the AppSync API
   * @default false
   */
  readonly xrayEnabled?: boolean;

  /**
   * Optional. Additonal custom transformers to run prior to the CDK resource generations.
   * Particularly useful for custom directives.
   * @default undefined
   */

  readonly preCdkTransformers?: [ITransformer];


  /**
   * Optional. Additonal custom transformers to run after the CDK resource generations.
   * Mostly useful for deep level customization of the generated CDK CloudFormation resources.
   * @default undefined
   */

  readonly postCdkTransformers?: [ITransformer];
}

const defaultAuthorizationConfig: AuthorizationConfig = {
  defaultAuthorization: {
    authorizationType: AuthorizationType.API_KEY,
    apiKeyConfig: {
      description: 'Auto generated API Key from construct',
      name: 'dev',
    },
  },
};

/**
 * AppSyncTransformer Construct
 */
export class AppSyncTransformer extends Construct {
  /**
   * The cdk GraphqlApi construct
   */
  public readonly appsyncAPI: GraphqlApi;

  /**
   * The NestedStack that contains the AppSync resources
   */
  public readonly nestedAppsyncStack: NestedStack;

  /**
   * Map of cdk table tokens to table names
   */
  public readonly tableNameMap: { [name: string]: any };

  /**
   * The outputs from the SchemaTransformer
   */
  public readonly outputs: SchemaTransformerOutputs;

  /**
   * The AppSync resolvers from the transformer minus any function resolvers
   */
  public readonly resolvers: any;

  /**
   * The Lambda Function resolvers designated by the function directive
   * https://github.com/kcwinner/cdk-appsync-transformer#functions
   */
  public readonly functionResolvers: {
    [name: string]: CdkTransformerFunctionResolver[];
  };

  public readonly httpResolvers: {
    [name: string]: CdkTransformerHttpResolver[];
  };

  private isSyncEnabled: boolean;
  private syncTable: Table | undefined;

  constructor(scope: Construct, id: string, props: AppSyncTransformerProps) {
    super(scope, id);

    this.isSyncEnabled = props.syncEnabled ? props.syncEnabled : false;

    const transformerConfiguration: SchemaTransformerProps = {
      schemaPath: props.schemaPath,
      syncEnabled: props.syncEnabled ?? false,
    };

    const transformer = new SchemaTransformer(transformerConfiguration);
    this.outputs = transformer.transform(props.preCdkTransformers, props.postCdkTransformers);
    const resolvers = transformer.getResolvers();

    this.functionResolvers = this.outputs.functionResolvers ?? {};

    // Remove any function resolvers from the total list of resolvers
    // Otherwise it will add them twice
    for (const [_, functionResolvers] of Object.entries(
      this.functionResolvers,
    )) {
      functionResolvers.forEach((resolver: any) => {
        switch (resolver.typeName) {
          case 'Query':
          case 'Mutation':
          case 'Subscription':
            delete resolvers[resolver.fieldName];
            break;
        }
      });
    }

    this.httpResolvers = this.outputs.httpResolvers ?? {};

    // Remove any http resolvers from the total list of resolvers
    // Otherwise it will add them twice
    for (const [_, httpResolvers] of Object.entries(this.httpResolvers)) {
      httpResolvers.forEach((resolver: any) => {
        switch (resolver.typeName) {
          case 'Query':
          case 'Mutation':
          case 'Subscription':
            delete resolvers[resolver.fieldName];
            break;
        }
      });
    }

    this.resolvers = resolvers;

    this.nestedAppsyncStack = new NestedStack(this, 'appsync-nested-stack');

    // AppSync
    this.appsyncAPI = new GraphqlApi(this.nestedAppsyncStack, `${id}-api`, {
      name: props.apiName ? props.apiName : `${id}-api`,
      authorizationConfig: props.authorizationConfig
        ? props.authorizationConfig
        : defaultAuthorizationConfig,
      logConfig: {
        fieldLogLevel: props.fieldLogLevel
          ? props.fieldLogLevel
          : FieldLogLevel.NONE,
      },
      schema: Schema.fromAsset('./appsync/schema.graphql'),
      xrayEnabled: props.xrayEnabled ?? false,
    });

    let tableData = this.outputs.cdkTables ?? {};

    // Check to see if sync is enabled
    if (tableData.DataStore) {
      this.isSyncEnabled = true;
      this.syncTable = this.createSyncTable(tableData.DataStore);
      delete tableData.DataStore; // We don't want to create this again below so remove it from the tableData map
    }

    this.tableNameMap = this.createTablesAndResolvers(tableData, resolvers);
    if (this.outputs.noneResolvers) {
      this.createNoneDataSourceAndResolvers(
        this.outputs.noneResolvers,
        resolvers,
      );
    }
    this.createHttpResolvers();

    // Outputs so we can generate exports
    new CfnOutput(scope, 'appsyncGraphQLEndpointOutput', {
      value: this.appsyncAPI.graphqlUrl,
      description: 'Output for aws_appsync_graphqlEndpoint',
    });
  }

  /**
   * Creates NONE data source and associated resolvers
   * @param noneResolvers The resolvers that belong to the none data source
   * @param resolvers The resolver map minus function resolvers
   */
  private createNoneDataSourceAndResolvers(
    noneResolvers: { [name: string]: CdkTransformerResolver },
    resolvers: any,
  ) {
    const noneDataSource = this.appsyncAPI.addNoneDataSource('NONE');

    Object.keys(noneResolvers).forEach((resolverKey: any) => {
      const resolver = resolvers[resolverKey];

      new Resolver(
        this.nestedAppsyncStack,
        `${resolver.typeName}-${resolver.fieldName}-resolver`,
        {
          api: this.appsyncAPI,
          typeName: resolver.typeName,
          fieldName: resolver.fieldName,
          dataSource: noneDataSource,
          requestMappingTemplate: MappingTemplate.fromFile(
            resolver.requestMappingTemplate,
          ),
          responseMappingTemplate: MappingTemplate.fromFile(
            resolver.responseMappingTemplate,
          ),
        },
      );
    });
  }

  /**
   * Creates each dynamodb table, gsis, dynamodb datasource, and associated resolvers
   * If sync is enabled then TTL configuration is added
   * Returns tableName: table map in case it is needed for lambda functions, etc
   * @param tableData The CdkTransformer table information
   * @param resolvers The resolver map minus function resolvers
   */
  private createTablesAndResolvers(
    tableData: { [name: string]: CdkTransformerTable },
    resolvers: any,
  ): { [name: string]: string } {
    const tableNameMap: any = {};

    Object.keys(tableData).forEach((tableKey: any) => {
      const table = this.createTable(tableData[tableKey]);
      const dataSource = this.appsyncAPI.addDynamoDbDataSource(tableKey, table);

      // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appsync-datasource-deltasyncconfig.html

      if (this.isSyncEnabled && this.syncTable) {
        //@ts-ignore - ds is the base CfnDataSource and the db config needs to be versioned - see CfnDataSource
        dataSource.ds.dynamoDbConfig.versioned = true;

        //@ts-ignore - ds is the base CfnDataSource - see CfnDataSource
        dataSource.ds.dynamoDbConfig.deltaSyncConfig = {
          baseTableTtl: '43200', // Got this value from amplify - 30 days in minutes
          deltaSyncTableName: this.syncTable.tableName,
          deltaSyncTableTtl: '30', // Got this value from amplify - 30 minutes
        };

        // Need to add permission for our datasource service role to access the sync table
        dataSource.grantPrincipal.addToPolicy(
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              'dynamodb:*', // TODO: This may be too permissive
            ],
            resources: [this.syncTable.tableArn],
          }),
        );
      }

      const dynamoDbConfig = dataSource.ds
        .dynamoDbConfig as CfnDataSource.DynamoDBConfigProperty;
      tableNameMap[tableKey] = dynamoDbConfig.tableName;

      // Loop the basic resolvers
      tableData[tableKey].resolvers.forEach((resolverKey: any) => {
        let resolver = resolvers[resolverKey];
        new Resolver(
          this.nestedAppsyncStack,
          `${resolver.typeName}-${resolver.fieldName}-resolver`,
          {
            api: this.appsyncAPI,
            typeName: resolver.typeName,
            fieldName: resolver.fieldName,
            dataSource: dataSource,
            requestMappingTemplate: MappingTemplate.fromFile(
              resolver.requestMappingTemplate,
            ),
            responseMappingTemplate: MappingTemplate.fromFile(
              resolver.responseMappingTemplate,
            ),
          },
        );
      });

      // Loop the gsi resolvers
      tableData[tableKey].gsiResolvers.forEach((resolverKey: any) => {
        let resolver = resolvers.gsi[resolverKey];
        new Resolver(
          this.nestedAppsyncStack,
          `${resolver.typeName}-${resolver.fieldName}-resolver`,
          {
            api: this.appsyncAPI,
            typeName: resolver.typeName,
            fieldName: resolver.fieldName,
            dataSource: dataSource,
            requestMappingTemplate: MappingTemplate.fromFile(
              resolver.requestMappingTemplate,
            ),
            responseMappingTemplate: MappingTemplate.fromFile(
              resolver.responseMappingTemplate,
            ),
          },
        );
      });
    });

    return tableNameMap;
  }

  private createTable(tableData: CdkTransformerTable) {
    let tableProps: any = {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: tableData.partitionKey.name,
        type: this.convertAttributeType(tableData.partitionKey.type),
      },
    };

    if (tableData.sortKey && tableData.sortKey.name) {
      tableProps.sortKey = {
        name: tableData.sortKey.name,
        type: this.convertAttributeType(tableData.sortKey.type),
      };
    }

    if (tableData.ttl && tableData.ttl.enabled) {
      tableProps.timeToLiveAttribute = tableData.ttl.attributeName;
    }

    const table = new Table(
      this.nestedAppsyncStack,
      tableData.tableName,
      tableProps,
    );

    if (
      tableData.globalSecondaryIndexes &&
      tableData.globalSecondaryIndexes.length > 0
    ) {
      tableData.globalSecondaryIndexes.forEach((gsi: any) => {
        table.addGlobalSecondaryIndex({
          indexName: gsi.indexName,
          partitionKey: {
            name: gsi.partitionKey.name,
            type: this.convertAttributeType(gsi.partitionKey.type),
          },
          projectionType: this.convertProjectionType(
            gsi.projection.ProjectionType,
          ),
        });
      });
    }

    return table;
  }

  /**
   * Creates the sync table for Amplify DataStore
   * https://docs.aws.amazon.com/appsync/latest/devguide/conflict-detection-and-sync.html
   * @param tableData The CdkTransformer table information
   */
  private createSyncTable(tableData: CdkTransformerTable): Table {
    return new Table(this, 'appsync-api-sync-table', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: tableData.partitionKey.name,
        type: this.convertAttributeType(tableData.partitionKey.type),
      },
      sortKey: {
        name: tableData.sortKey!.name, // We know it has a sortkey because we forced it to
        type: this.convertAttributeType(tableData.sortKey!.type), // We know it has a sortkey because we forced it to
      },
      timeToLiveAttribute: tableData.ttl?.attributeName || '_ttl',
    });
  }

  private convertAttributeType(type: string): AttributeType {
    switch (type) {
      case 'N':
        return AttributeType.NUMBER;
      case 'B':
        return AttributeType.BINARY;
      case 'S': // Same as default
      default:
        return AttributeType.STRING;
    }
  }

  private convertProjectionType(type: string): ProjectionType {
    switch (type) {
      case 'INCLUDE':
        return ProjectionType.INCLUDE;
      case 'KEYS_ONLY':
        return ProjectionType.KEYS_ONLY;
      case 'ALL': // Same as default
      default:
        return ProjectionType.ALL;
    }
  }

  private createHttpResolvers() {
    for (const [endpoint, httpResolvers] of Object.entries(
      this.httpResolvers,
    )) {
      const strippedEndpoint = endpoint.replace(/[^_0-9A-Za-z]/g, '');
      const httpDataSource = this.appsyncAPI.addHttpDataSource(
        `${strippedEndpoint}`,
        endpoint,
      );

      httpResolvers.forEach((resolver: CdkTransformerHttpResolver) => {
        new Resolver(
          this.nestedAppsyncStack,
          `${resolver.typeName}-${resolver.fieldName}-resolver`,
          {
            api: this.appsyncAPI,
            typeName: resolver.typeName,
            fieldName: resolver.fieldName,
            dataSource: httpDataSource,
            requestMappingTemplate: MappingTemplate.fromString(
              resolver.defaultRequestMappingTemplate,
            ),
            responseMappingTemplate: MappingTemplate.fromString(
              resolver.defaultResponseMappingTemplate,
            ),
          },
        );
      });
    }
  }

  /**
   * Adds the function as a lambdaDataSource to the AppSync api
   * Adds all of the functions resolvers to the AppSync api
   * @param functionName The function name specified in the @function directive of the schema
   * @param id The id to give
   * @param lambdaFunction The lambda function to attach
   * @param options
   */
  public addLambdaDataSourceAndResolvers(
    functionName: string,
    id: string,
    lambdaFunction: IFunction,
    options?: DataSourceOptions,
  ): LambdaDataSource {
    const functionDataSource = this.appsyncAPI.addLambdaDataSource(
      id,
      lambdaFunction,
      options,
    );

    for (const resolver of this.functionResolvers[functionName]) {
      new Resolver(
        this.nestedAppsyncStack,
        `${resolver.typeName}-${resolver.fieldName}-resolver`,
        {
          api: this.appsyncAPI,
          typeName: resolver.typeName,
          fieldName: resolver.fieldName,
          dataSource: functionDataSource,
          requestMappingTemplate: MappingTemplate.fromString(
            resolver.defaultRequestMappingTemplate,
          ),
          responseMappingTemplate: MappingTemplate.fromString(
            resolver.defaultResponseMappingTemplate,
          ), // This defaults to allow errors to return to the client instead of throwing
        },
      );
    }

    return functionDataSource;
  }
}
