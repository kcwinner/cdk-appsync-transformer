import { Transformer, TransformerContext, getFieldArguments } from 'graphql-transformer-core';

const graphqlTypeStatements = ['Query', 'Mutation', 'Subscription'];

export interface CdkTransformerTableKey {
    name: string
    type: string
}

export interface CdkTransformerGlobalSecondaryIndex {
    IndexName: string;
    Projection: string;
    PartitionKey: CdkTransformerTableKey
    SortKey: CdkTransformerTableKey,
}

export interface CdkTransformerTable {
    TableName: string;
    PartitionKey: CdkTransformerTableKey;
    SortKey?: CdkTransformerTableKey;
    TTL?: any; // TODO: Figure this out
    GlobalSecondaryIndexes: CdkTransformerGlobalSecondaryIndex[];
    Resolvers: string[];
    GSIResolvers: string[];
}

export interface CdkTransformerResolver {
    typeName: string;
    fieldName: string;
}

export interface CdkTransformerFunctionResolver extends CdkTransformerResolver {
    RequestMappingTemplate: string;
    ResponseMappingTemplate: string;
}

export class CdkTransformer extends Transformer {
    tables: { [name: string]: CdkTransformerTable };
    noneDataSources: { [name: string]: CdkTransformerResolver };
    functionResolvers: CdkTransformerResolver[];
    resolverTableMap: { [name: string]: string };
    gsiResolverTableMap: { [name: string]: string };

    constructor() {
        super(
            'CdkTransformer',
            'directive @nullable on FIELD_DEFINITION' // this is unused
        )

        this.tables = {}
        this.noneDataSources = {}
        this.functionResolvers = []
        this.resolverTableMap = {};
        this.gsiResolverTableMap = {};
    }

    public after = (ctx: TransformerContext): void => {
        this.printWithoutFilePath(ctx);

        Object.keys(this.tables).forEach(tableName => {
            let table = this.tables[tableName];
            Object.keys(this.resolverTableMap).forEach(resolverName => {
                if (this.resolverTableMap[resolverName] === tableName) table.Resolvers.push(resolverName);
            })

            Object.keys(this.gsiResolverTableMap).forEach(resolverName => {
                if (this.gsiResolverTableMap[resolverName] === tableName) table.GSIResolvers.push(resolverName);
            })
        })

        // @ts-ignore - we are overloading the use of outputs here...
        ctx.setOutput('CDK_TABLES', this.tables);

        // @ts-ignore - we are overloading the use of outputs here...
        ctx.setOutput('NONE', this.noneDataSources);

        // @ts-ignore - we are overloading the use of outputs here...
        ctx.setOutput('FUNCTION_RESOLVERS', this.functionResolvers);

        const query = ctx.getQuery();
        if (query) {
            const queryFields = getFieldArguments(query);
            ctx.setOutput('QUERIES', queryFields);
        }

        const mutation = ctx.getMutation();
        if (mutation) {
            const mutationFields = getFieldArguments(mutation);
            ctx.setOutput('MUTATIONS', mutationFields);
        }

        const subscription = ctx.getSubscription();
        if (subscription) {
            const subscriptionFields = getFieldArguments(subscription);
            ctx.setOutput('SUBSCRIPTIONS', subscriptionFields);
        }
    }

    private printWithoutFilePath(ctx: TransformerContext): void {
        const templateResources = ctx.template.Resources
        if (!templateResources) return;

        for (const [resourceName, resource] of Object.entries(templateResources)) {
            console.log('Resource Name:', resourceName);
            console.log(resource);

            if (resource.Type === 'AWS::DynamoDB::Table') {
                this.buildTablesFromResource(resourceName, ctx)
            } else if (resource.Type === 'AWS::AppSync::Resolver') {
                if (resource.Properties?.DataSourceName === 'NONE') {
                    this.noneDataSources[resource.Properties.FieldName] = {
                        typeName: resource.Properties.TypeName,
                        fieldName: resource.Properties.FieldName
                    }
                } else if (resource.Properties?.Kind === 'PIPELINE') {
                    // TODO: This may not be accurate but works for now - AWS::AppSync::FunctionConfiguration instead
                    // Map AWS::AppSync::FunctionConfiguration -> DataSource -> DataSource TYPE: AWS_LAMBDA -> PIPELINE ???
                    console.log('resource.Properties');
                    console.log(resource.Properties)
                    
                    let fieldName = resource.Properties?.FieldName
                    let typeName = resource.Properties?.TypeName

                    this.functionResolvers.push({
                        typeName: typeName,
                        fieldName: fieldName
                    })
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
        const tableResource = ctx.template.Resources ? ctx.template.Resources[resourceName] : undefined

        const attributeDefinitions = tableResource?.Properties?.AttributeDefinitions
        const keySchema = tableResource?.Properties?.KeySchema

        const keys = this.parseKeySchema(keySchema, attributeDefinitions);

        let table: CdkTransformerTable = {
            TableName: resourceName,
            PartitionKey: keys.partitionKey,
            SortKey: keys.sortKey,
            TTL: tableResource?.Properties?.TimeToLiveSpecification,
            GlobalSecondaryIndexes: [],
            Resolvers: [],
            GSIResolvers: []
        }

        const gsis = tableResource?.Properties?.GlobalSecondaryIndexes;
        if (gsis) {
            gsis.forEach((gsi: any) => {
                const gsiKeys = this.parseKeySchema(gsi.KeySchema, attributeDefinitions);
                const gsiDefinition = {
                    IndexName: gsi.IndexName,
                    Projection: gsi.Projection,
                    PartitionKey: gsiKeys.partitionKey,
                    SortKey: gsiKeys.sortKey,
                }

                table.GlobalSecondaryIndexes.push(gsiDefinition);
            })
        }

        this.tables[resourceName] = table
    }

    private parseKeySchema(keySchema: any, attributeDefinitions: any) {
        let partitionKey: any = {}
        let sortKey: any = {}

        keySchema.forEach((key: any) => {
            const keyType = key.KeyType
            const attributeName = key.AttributeName

            const attribute = attributeDefinitions.find((attribute: any) => {
                return attribute.AttributeName === attributeName
            })

            if (keyType === 'HASH') {
                partitionKey = {
                    name: attribute.AttributeName,
                    type: attribute.AttributeType
                }
            } else if (keyType === 'RANGE') {
                sortKey = {
                    name: attribute.AttributeName,
                    type: attribute.AttributeType
                }
            }
        })

        return {
            partitionKey,
            sortKey
        }
    }
}