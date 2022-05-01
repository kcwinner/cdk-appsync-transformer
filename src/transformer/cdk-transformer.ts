import { DeploymentResources } from "@aws-amplify/graphql-transformer-core";
import Template from "@aws-amplify/graphql-transformer-core/lib/transformation/types";

const graphqlTypeStatements = ["Query", "Mutation", "Subscription"];

export interface CdkTransformerTableKey {
  readonly name: string;
  readonly type: string;
}

export interface CdkTransformerLocalSecondaryIndex {
  readonly indexName: string;
  readonly projection: any;
  readonly sortKey: CdkTransformerTableKey;
}

export interface CdkTransformerGlobalSecondaryIndex {
  readonly indexName: string;
  readonly projection: any;
  readonly partitionKey: CdkTransformerTableKey;
  readonly sortKey: CdkTransformerTableKey;
}

export interface CdkTransformerTableTtl {
  readonly attributeName: string;
  readonly enabled: boolean;
}

export interface CdkTransformerTable {
  readonly tableName: string;
  readonly partitionKey: CdkTransformerTableKey;
  readonly sortKey?: CdkTransformerTableKey;
  readonly ttl?: CdkTransformerTableTtl;
  readonly localSecondaryIndexes: CdkTransformerLocalSecondaryIndex[];
  readonly globalSecondaryIndexes: CdkTransformerGlobalSecondaryIndex[];
  readonly resolvers: string[];
  readonly gsiResolvers: string[];
}

export enum DataSourceType {
  AMAZON_DYNAMO_DB = "AMAZON_DYNAMODB",
  AWS_LAMBDA = "AWS_LAMBDA",
  HTTP = "HTTP",
  NONE = "NONE",
}

export interface IDataSourceHttpConfig {
  endpoint: string;
}

export interface ICdkTransformerAppSyncFunctionConfiguration {
  name: string;
  dataSourceType: DataSourceType;
  dataSourceTable?: string;
  dataSourceHttpConfig?: IDataSourceHttpConfig;
  requestMappingTemplate?: string;
  requestMappingTemplateFileName?: string;
  responseMappingTemplate?: string;
  responseMappingTemplateFileName?: string;
}

export interface CdkTransformerResolver {
  readonly typeName: string;
  readonly fieldName: string;
  readonly pipelineConfig: ICdkTransformerAppSyncFunctionConfiguration[];
  readonly requestMappingTemplate: string;
  readonly responseMappingTemplate: string;
}

export interface CdkTransformerHttpResolver extends CdkTransformerResolver {
  // readonly httpConfig?: any;
  readonly defaultRequestMappingTemplate?: string;
  readonly defaultResponseMappingTemplate?: string;
}

export interface CdkTransformerFunctionResolver extends CdkTransformerResolver {
  readonly defaultRequestMappingTemplate?: string;
  readonly defaultResponseMappingTemplate?: string;
}

export interface CdkTransformerStack {
  readonly tables: { [name: string]: CdkTransformerTable };
  readonly noneDataSources: { [name: string]: CdkTransformerResolver };
  readonly modelResolvers: { [name: string]: CdkTransformerResolver };
  readonly functionResolvers: { [name: string]: CdkTransformerFunctionResolver[] };
  readonly httpResolvers: { [name: string]: CdkTransformerHttpResolver[] };
  readonly resolverTableMap: { [name: string]: string }; // TODO: is this needed?
  readonly gsiResolverTableMap: { [name: string]: string }; // TODO: is this needed?
}

export class CdkTransformer {
  stacks: {
    [name: string]: CdkTransformerStack;
  };

  constructor() {
    this.stacks = {};
  }

  public transform = (deploymentResources: DeploymentResources) => {
    this.buildResources(deploymentResources);

    Object.entries(this.stacks).forEach(([_stackName, stack]) => {
      // TODO: Improve this iteration
      Object.keys(stack.tables).forEach((tableName) => {
        let table = stack.tables[tableName];

        Object.keys(stack.modelResolvers).forEach((resolverName) => {
          const tableNames = stack.modelResolvers[resolverName].pipelineConfig.map((cfg) => {
            return cfg.dataSourceTable;
          });

          if (tableNames.includes(tableName)) table.resolvers.push(resolverName);
        });

        Object.keys(stack.gsiResolverTableMap).forEach((resolverName) => {
          if (stack.gsiResolverTableMap[resolverName] === tableName) table.gsiResolvers.push(resolverName);
        });
      });
    });

    return this.stacks;
  };

  private buildResources(deploymentResources: DeploymentResources): void {
    for (const [stackName, template] of Object.entries(deploymentResources.stacks)) {
      this.stacks[stackName] = {
        tables: {},
        noneDataSources: {},
        modelResolvers: {},
        functionResolvers: {},
        httpResolvers: {},
        resolverTableMap: {},
        gsiResolverTableMap: {},
      };

      const templateResources = template.Resources;
      if (!templateResources) continue;

      for (const [resourceName, resource] of Object.entries(templateResources)) {
        if (resourceName === "PostBlogDataResolverFn") {
          console.log("!!!!!!!! FOUND !!!!!!!!");
          console.log(resource);
          console.log("!!!!!!!! FOUND !!!!!!!!");
        }

        if (resource.Type === "AWS::DynamoDB::Table") {
          const { table, tableName } = this.buildTableFromResource(resourceName, template);
          this.stacks[stackName].tables[tableName] = table;
        } else if (resource.Type === "AWS::AppSync::Resolver") {
          if (resource.Properties?.Kind === "PIPELINE") {
            const pipelineConfig = resource.Properties.PipelineConfig;
            const pipelineFunctions = pipelineConfig.Functions;

            const outResolver: CdkTransformerResolver = {
              fieldName: resource.Properties.FieldName,
              typeName: resource.Properties.TypeName,
              pipelineConfig: [],
              requestMappingTemplate: resource.Properties.RequestMappingTemplate, // TODO: Fix these because they are wrong
              responseMappingTemplate: resource.Properties.ResponseMappingTemplate,
            };

            let hasDynamo = false;
            let httpEndpoint;
            let hasLambda = false;
            let functionName = "";

            for (const pipelineFunction of pipelineFunctions) {
              const id = pipelineFunction["Fn::GetAtt"] ? pipelineFunction["Fn::GetAtt"][0] : undefined;
              if (!id) {
                // this is a ref pipelineFunction["Ref"]
                // TODO: find the ref stack?
                continue;
              }
              const functionConfiguration = templateResources[id];

              let dataSourceType = DataSourceType.NONE;

              const dataSourceNameRef = functionConfiguration.Properties.DataSourceName;
              const dataSourceName = dataSourceNameRef.Ref ?? dataSourceNameRef["Fn::GetAtt"][0];
              const dataSource = templateResources[dataSourceName];

              let otherProps: Partial<ICdkTransformerAppSyncFunctionConfiguration> = {};

              if (!dataSource) {
                dataSourceType = DataSourceType.NONE;
              } else {
                dataSourceType = dataSource.Properties.Type as DataSourceType;
                switch (dataSourceType) {
                  case "AMAZON_DYNAMODB":
                    otherProps.dataSourceTable = dataSource.Properties.Name;
                    hasDynamo = true;
                    break;
                  case "HTTP":
                    otherProps.dataSourceHttpConfig = {
                      endpoint: dataSource.Properties.HttpConfig.Endpoint,
                    };
                    httpEndpoint = dataSource.Properties.HttpConfig.Endpoint;
                    break;
                  case "AWS_LAMBDA":
                    hasLambda = true;
                    const subFn = dataSource.Properties.LambdaConfig.LambdaFunctionArn["Fn::If"][2]["Fn::Sub"];
                    functionName = subFn.split(":").slice(-1)[0];
                    break;
                  default:
                    throw new Error(`Unsupported Data Source Type: ${dataSourceType}`);
                }
              }

              if (functionConfiguration.Properties.RequestMappingTemplateS3Location) {
                const filename = sliceMappingTemplateS3Location(functionConfiguration.Properties.RequestMappingTemplateS3Location);
                otherProps.requestMappingTemplateFileName = filename.replace(".vtl", "");
              } else {
                otherProps.requestMappingTemplate = functionConfiguration.Properties.RequestMappingTemplate;
              }

              if (functionConfiguration.Properties.ResponseMappingTemplateS3Location) {
                const filename = sliceMappingTemplateS3Location(functionConfiguration.Properties.ResponseMappingTemplateS3Location);
                otherProps.responseMappingTemplateFileName = filename.replace(".vtl", "");
              } else {
                otherProps.responseMappingTemplate = functionConfiguration.Properties.ResponseMappingTemplate;
              }

              outResolver.pipelineConfig.push({
                name: functionConfiguration.Properties.Name,
                dataSourceType,
                ...otherProps,
              });
            }

            const stack = this.stacks[stackName];

            if (hasDynamo) {
              if (graphqlTypeStatements.indexOf(outResolver.typeName) >= 0) {
                stack.modelResolvers[outResolver.fieldName] = outResolver;
              } else {
                // this is a gsi
                throw new Error("Unsupported GSI Type?");
              }
            } else if (httpEndpoint) {
              if (!stack.httpResolvers[httpEndpoint]) stack.httpResolvers[httpEndpoint] = [];
              stack.httpResolvers[httpEndpoint].push(outResolver);
            } else if (hasLambda) {
              if (!stack.functionResolvers[functionName]) stack.functionResolvers[functionName] = [];
              stack.functionResolvers[functionName].push(outResolver);
            } else {
              // TODO: Figure these GSIs out
              // console.log('-- NONE Resolver --');
              // if (stackName === 'ConnectionStack') {
              //   console.log(JSON.stringify(outResolver, undefined, 2));
              // }
              // // This was the old code
              // stack.gsiResolverTableMap[`${typeName}${fieldName}`] = tableName;
              // stack.pipelineResolvers[`${outResolver.typeName}${outResolver.fieldName}`] = outResolver;
            }
          } else {
            throw new Error("Invalid resolver type. All resolvers should be pipelines.");
          }
        }
      }
    }
  }

  private buildTableFromResource(resourceName: string, template: Template) {
    const tableResource = template.Resources ? template.Resources[resourceName] : undefined;
    const attributeDefinitions = tableResource?.Properties?.AttributeDefinitions;
    const keySchema = tableResource?.Properties?.KeySchema;

    const keys = this.parseKeySchema(keySchema, attributeDefinitions);

    let ttl = tableResource?.Properties?.TimeToLiveSpecification;
    if (ttl) {
      ttl = {
        attributeName: ttl.AttributeName,
        enabled: ttl.Enabled,
      };
    }

    const tableName = resourceName.substring(0, resourceName.indexOf("Table")) + "Table";

    const table: CdkTransformerTable = {
      tableName,
      partitionKey: keys.partitionKey,
      sortKey: keys.sortKey,
      ttl: ttl,
      localSecondaryIndexes: [],
      globalSecondaryIndexes: [],
      resolvers: [],
      gsiResolvers: [],
    };

    const lsis = tableResource?.Properties?.LocalSecondaryIndexes;
    if (lsis) {
      lsis.forEach((lsi: any) => {
        const lsiKeys = this.parseKeySchema(lsi.KeySchema, attributeDefinitions);
        const lsiDefinition = {
          indexName: lsi.IndexName,
          projection: lsi.Projection,
          sortKey: lsiKeys.sortKey,
        };

        table.localSecondaryIndexes.push(lsiDefinition);
      });
    }

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

    return { tableName, table };
  }

  private parseKeySchema(keySchema: any, attributeDefinitions: any) {
    let partitionKey: any = {};
    let sortKey: any = {};

    keySchema.forEach((key: any) => {
      const keyType = key.KeyType;
      const attributeName = key.AttributeName;

      const attribute = attributeDefinitions.find((attr: any) => attr.AttributeName === attributeName);

      if (keyType === "HASH") {
        partitionKey = {
          name: attribute.AttributeName,
          type: attribute.AttributeType,
        };
      } else if (keyType === "RANGE") {
        sortKey = {
          name: attribute.AttributeName,
          type: attribute.AttributeType,
        };
      }
    });

    return { partitionKey, sortKey };
  }
}

function sliceMappingTemplateS3Location(locationProperty: any) {
  const joinFn = locationProperty["Fn::Join"];
  const values = joinFn[1];
  const key = values.slice(-1)[0];
  return key.split("/").slice(-1)[0];
}
