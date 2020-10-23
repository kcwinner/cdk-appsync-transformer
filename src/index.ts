import { Construct, NestedStack, CfnOutput } from '@aws-cdk/core';
import { GraphqlApi, AuthorizationType, FieldLogLevel, MappingTemplate, CfnDataSource, Resolver, AuthorizationConfig, Schema } from '@aws-cdk/aws-appsync';
import { Table, AttributeType, ProjectionType, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Effect, PolicyStatement } from '@aws-cdk/aws-iam'

import { SchemaTransformer } from './transformer/schema-transformer';

/**
 * Properties for AppSyncTransformer Construct
 * @param schemaPath Relative path where schema.graphql exists.
 * @param authorizationConfig {@link AuthorizationConfig} type defining authorization for AppSync GraphqlApi. Defaults to API_KEY
 * @param apiName Optional string value representing the api name
 * @param syncEnabled Optional boolean to enable DataStore Sync Tables
 * @param fieldLogLevel {@link FieldLogLevel} type for AppSync GraphqlApi log level
 */
export interface AppSyncTransformerProps {
    /**
     * Required. Relative path where schema.graphql exists
     */
    readonly schemaPath: string

    /**
     * Optional. {@link AuthorizationConfig} type defining authorization for AppSync GraphqlApi. Defaults to API_KEY
     * @default API_KEY authorization config
     */
    readonly authorizationConfig?: AuthorizationConfig

    /**
     * Optional. String value representing the api name
     * @default `${id}-api`
     */
    readonly apiName?: string

    /**
     * Optional. Boolean to enable DataStore Sync Tables
     * @default false
     */
    readonly syncEnabled?: boolean

    /**
     * Optional. {@link FieldLogLevel} type for AppSync GraphqlApi log level
     * @default FieldLogLevel.NONE
     */
    readonly fieldLogLevel?: FieldLogLevel
}

const defaultAuthorizationConfig: AuthorizationConfig = {
    defaultAuthorization: {
        authorizationType: AuthorizationType.API_KEY,
        apiKeyConfig: {
            description: "Auto generated API Key from construct",
            name: "dev"
        }
    }
}

/**
 * AppSyncTransformer Construct
 */
export class AppSyncTransformer extends Construct {
    public readonly appsyncAPI: GraphqlApi
    public readonly nestedAppsyncStack: NestedStack;
    public readonly tableNameMap: any;
    public readonly outputs: any;
    public readonly resolvers: any;

    private isSyncEnabled: boolean
    private syncTable: Table | undefined

    constructor(scope: Construct, id: string, props: AppSyncTransformerProps) {
        super(scope, id);

        this.isSyncEnabled = props.syncEnabled ? props.syncEnabled : false;

        const transformerConfiguration = {
            schemaPath: props.schemaPath,
            syncEnabled: props.syncEnabled || false
        }

        const transformer = new SchemaTransformer(transformerConfiguration);
        const outputs = transformer.transform();
        const resolvers = transformer.getResolvers();

        this.outputs = outputs;

        this.outputs.FUNCTION_RESOLVERS.forEach((resolver: any) => {
            switch (resolver.typeName) {
                case 'Query':
                    delete resolvers[resolver.fieldName]
                    break;
                case 'Mutation':
                    delete resolvers[resolver.fieldName]
                    break;
                case 'Subscription':
                    delete resolvers[resolver.fieldName]
                    break;
            }
        })

        this.resolvers = resolvers;

        this.nestedAppsyncStack = new NestedStack(this, `appsync-nested-stack`);

        // AppSync
        this.appsyncAPI = new GraphqlApi(this.nestedAppsyncStack, `${id}-api`, {
            name: props.apiName ? props.apiName : `${id}-api`,
            authorizationConfig: props.authorizationConfig ? props.authorizationConfig : defaultAuthorizationConfig,
            logConfig: {
                fieldLogLevel: props.fieldLogLevel ? props.fieldLogLevel : FieldLogLevel.NONE,
            },
            schema: Schema.fromAsset('./appsync/schema.graphql')
        })

        let tableData = outputs.CDK_TABLES;

        // Check to see if sync is enabled
        if (tableData['DataStore']) {
            this.isSyncEnabled = true
            this.syncTable = this.createSyncTable(tableData['DataStore']);
            delete tableData['DataStore'] // We don't want to create this again below so remove it from the tableData map
        }

        this.tableNameMap = this.createTablesAndResolvers(tableData, resolvers);
        this.createNoneDataSourceAndResolvers(outputs.NONE, resolvers);

        // Outputs so we can generate exports
        new CfnOutput(scope, 'appsyncGraphQLEndpointOutput', {
            value: this.appsyncAPI.graphqlUrl,
            description: 'Output for aws_appsync_graphqlEndpoint'
        })
    }

    private createNoneDataSourceAndResolvers(none: any, resolvers: any) {
        const noneDataSource = this.appsyncAPI.addNoneDataSource('NONE');

        Object.keys(none).forEach((resolverKey: any) => {
            let resolver = resolvers[resolverKey];

            new Resolver(this.nestedAppsyncStack, `${resolver.typeName}-${resolver.fieldName}-resolver`, {
                api: this.appsyncAPI,
                typeName: resolver.typeName,
                fieldName: resolver.fieldName,
                dataSource: noneDataSource,
                requestMappingTemplate: MappingTemplate.fromFile(resolver.requestMappingTemplate),
                responseMappingTemplate: MappingTemplate.fromFile(resolver.responseMappingTemplate),
            })
        })
    }

    private createTablesAndResolvers(tableData: any, resolvers: any) {
        const tableNameMap: any = {};

        Object.keys(tableData).forEach((tableKey: any) => {
            const table = this.createTable(tableData[tableKey]);
            const dataSource = this.appsyncAPI.addDynamoDbDataSource(tableKey, table);

            // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-appsync-datasource-deltasyncconfig.html

            if (this.isSyncEnabled && this.syncTable) {
                //@ts-ignore - ds is the base CfnDataSource and the db config needs to be versioned - see CfnDataSource
                dataSource.ds.dynamoDbConfig.versioned = true

                //@ts-ignore - ds is the base CfnDataSource - see CfnDataSource
                dataSource.ds.dynamoDbConfig.deltaSyncConfig = {
                    baseTableTtl: '43200', // Got this value from amplify - 30 days in minutes
                    deltaSyncTableName: this.syncTable.tableName,
                    deltaSyncTableTtl: '30' // Got this value from amplify - 30 minutes
                }

                // Need to add permission for our datasource service role to access the sync table
                dataSource.grantPrincipal.addToPolicy(new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        'dynamodb:*'
                    ],
                    resources: [
                        this.syncTable.tableArn
                    ]
                }))
            }

            const dynamoDbConfig = dataSource.ds.dynamoDbConfig as CfnDataSource.DynamoDBConfigProperty;
            tableNameMap[tableKey] = dynamoDbConfig.tableName;

            // Loop the basic resolvers
            tableData[tableKey].Resolvers.forEach((resolverKey: any) => {
                let resolver = resolvers[resolverKey];
                new Resolver(this.nestedAppsyncStack, `${resolver.typeName}-${resolver.fieldName}-resolver`, {
                    api: this.appsyncAPI,
                    typeName: resolver.typeName,
                    fieldName: resolver.fieldName,
                    dataSource: dataSource,
                    requestMappingTemplate: MappingTemplate.fromFile(resolver.requestMappingTemplate),
                    responseMappingTemplate: MappingTemplate.fromFile(resolver.responseMappingTemplate),
                })
            });

            // Loop the gsi resolvers
            tableData[tableKey].GSIResolvers.forEach((resolverKey: any) => {
                let resolver = resolvers['gsi'][resolverKey];
                new Resolver(this.nestedAppsyncStack, `${resolver.typeName}-${resolver.fieldName}-resolver`, {
                    api: this.appsyncAPI,
                    typeName: resolver.typeName,
                    fieldName: resolver.fieldName,
                    dataSource: dataSource,
                    requestMappingTemplate: MappingTemplate.fromFile(resolver.requestMappingTemplate),
                    responseMappingTemplate: MappingTemplate.fromFile(resolver.responseMappingTemplate),
                })
            });
        });

        return tableNameMap;
    }

    private createTable(tableData: any) {
        let tableProps: any = {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: tableData.PartitionKey.name,
                type: this.convertAttributeType(tableData.PartitionKey.type)
            }
        };

        if (tableData.SortKey && tableData.SortKey.name) {
            tableProps.sortKey = {
                name: tableData.SortKey.name,
                type: this.convertAttributeType(tableData.SortKey.type)
            };
        };

        if (tableData.TTL && tableData.TTL.Enabled) {
            tableProps.timeToLiveAttribute = tableData.TTL.AttributeName;
        }

        let table = new Table(this.nestedAppsyncStack, tableData.TableName, tableProps);

        if (tableData.GlobalSecondaryIndexes && tableData.GlobalSecondaryIndexes.length > 0) {
            tableData.GlobalSecondaryIndexes.forEach((gsi: any) => {
                table.addGlobalSecondaryIndex({
                    indexName: gsi.IndexName,
                    partitionKey: {
                        name: gsi.PartitionKey.name,
                        type: this.convertAttributeType(gsi.PartitionKey.type)
                    },
                    projectionType: this.convertProjectionType(gsi.Projection.ProjectionType)
                })
            })
        }

        return table;
    }

    // https://docs.aws.amazon.com/appsync/latest/devguide/conflict-detection-and-sync.html
    private createSyncTable(tableData: any) {
        return new Table(this, 'appsync-api-sync-table', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: tableData.PartitionKey.name,
                type: this.convertAttributeType(tableData.PartitionKey.type)
            },
            sortKey: {
                name: tableData.SortKey.name,
                type: this.convertAttributeType(tableData.SortKey.type)
            },
            timeToLiveAttribute: tableData.TTL?.AttributeName || '_ttl'
        })
    }

    private convertAttributeType(type: string) {
        switch (type) {
            case 'S':
                return AttributeType.STRING
            case 'N':
                return AttributeType.NUMBER
            case 'B':
                return AttributeType.BINARY
            default:
                return AttributeType.STRING
        }
    }

    private convertProjectionType(type: string) {
        switch (type) {
            case 'ALL':
                return ProjectionType.ALL
            case 'INCLUDE':
                return ProjectionType.INCLUDE
            case 'KEYS_ONLY':
                return ProjectionType.KEYS_ONLY
            default:
                return ProjectionType.ALL
        }
    }
}