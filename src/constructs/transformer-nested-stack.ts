// @ts-nocheck
import * as fs from "fs";
import * as path from "path";
import {
  GraphqlApi,
  AuthorizationType,
  FieldLogLevel,
  MappingTemplate,
  Resolver,
  AuthorizationConfig,
  Schema,
  DataSourceOptions,
  LambdaDataSource,
  NoneDataSource,
} from "@aws-cdk/aws-appsync-alpha";

import { NestedStack, CfnOutput } from "aws-cdk-lib";
import { CfnDataSource, CfnResolver } from "aws-cdk-lib/aws-appsync";

import { CfnTable, Table, AttributeType, ProjectionType, BillingMode, StreamViewType, TableProps } from "aws-cdk-lib/aws-dynamodb";
import { Effect, Grant, IGrantable, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

import { CdkTransformerStack, CdkTransformerResolver, CdkTransformerFunctionResolver, CdkTransformerHttpResolver, CdkTransformerTable } from "./transformer";
import { Resource } from "./transformer/resource";

import { SchemaTransformer, SchemaTransformerProps } from "./transformer/schema-transformer";

export interface AppSyncTransformerProps {
  /**
   * Whether to enable dynamo Point In Time Recovery. Default to false for backwards compatibility
   * @default false
   */
  readonly enableDynamoPointInTimeRecovery?: boolean;

  /**
   * A map of names to specify the generated dynamo table names instead of auto generated names
   * @default undefined
   */
  readonly tableNames?: Record<string, string>;

  /**
   * A map of @model type names to stream view type
   * e.g { Blog: StreamViewType.NEW_IMAGE }
   */
  readonly dynamoDbStreamConfig?: { [name: string]: StreamViewType };
}

/**
 * AppSyncTransformer Construct
 */
export class TransformerNestedStack extends Construct {
  /**
   * The NestedStacks that contain the resources
   */
  public readonly nestedStack: NestedStack;

  /**
   * Map of cdk table tokens to table names
   */
  public readonly tableNameMap: { [name: string]: string };

  /**
   * Map of cdk table keys to L2 Table
   * e.g. { 'TaskTable': Table }
   */
  public readonly tableMap: { [name: string]: Table };

  /**
   * The AppSync resolvers from the transformer minus any function resolvers
   */
  public readonly resolvers: { [name: string]: CdkTransformerResolver };

  public readonly modelResolvers: { [name: string]: CdkTransformerResolver };

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

  private props: AppSyncTransformerProps;
  private isSyncEnabled: boolean;
  private syncTable: Table | undefined;
  private pointInTimeRecovery: boolean;
  private readonly publicResourceArns: string[];
  private readonly privateResourceArns: string[];
  private readonly noneDataSource: NoneDataSource;

  constructor(scope: Construct, id: string, props: AppSyncTransformerProps) {}
}
