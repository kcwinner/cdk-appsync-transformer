import '@aws-cdk/assert/jest';
import { EOL } from 'os';
import * as path from 'path';
import { join } from 'path';
import { AuthorizationType, AuthorizationConfig, UserPoolDefaultAction, CfnResolver } from '@aws-cdk/aws-appsync';
import { CfnIdentityPool, UserPool, UserPoolClient } from '@aws-cdk/aws-cognito';
import { StreamViewType } from '@aws-cdk/aws-dynamodb';
import { Role, WebIdentityPrincipal } from '@aws-cdk/aws-iam';
import { Runtime, Code, Function } from '@aws-cdk/aws-lambda';
import { App, Stack } from '@aws-cdk/core';

import { DynamoDBModelTransformer } from 'graphql-dynamodb-transformer';
import { KeyTransformer } from 'graphql-key-transformer';
import { AppSyncTransformer } from '../src/index';
import MappedTransformer from './mappedTransformer';
import SingleFieldMapTransformer from './singleFieldMapTransformer';
import {HttpTransformer} from "graphql-http-transformer";
// eslint-disable-next-line
const { FunctionTransformer } = require('graphql-function-transformer') as any;

const testSchemaPath = path.join(__dirname, 'schema.graphql');
const testCustomTransformerSchemaPath = path.join(__dirname, 'customTransformSchema.graphql');
const functionDirectiveTestFunctionName = 'test-function';
const testHttpEndpoint = 'https://jsonplaceholder.typicode.com';

const apiKeyAuthorizationConfig: AuthorizationConfig = {
  defaultAuthorization: {
    authorizationType: AuthorizationType.API_KEY,
    apiKeyConfig: {
      description: 'Auto generated API Key from construct',
      name: 'dev',
    },
  },
};

test('GraphQL API W/ Defaults Created', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'testing-stack');

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
  });

  expect(stack).toHaveResource('AWS::CloudFormation::Stack');
  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
    AuthenticationType: 'API_KEY',
    XrayEnabled: false,
  });
});

test('GraphQL API W/ Sync Created', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'testing-sync-stack');

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'sync-api',
    authorizationConfig: apiKeyAuthorizationConfig,
    syncEnabled: true,
    xrayEnabled: true,
  });

  expect(stack).toHaveResource('AWS::CloudFormation::Stack');
  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
    AuthenticationType: 'API_KEY',
    Name: 'sync-api',
    XrayEnabled: true,
  });
});

test('GraphQL API W/ User Pool Auth Created', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'user-pool-auth-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'user-pool-auth-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
  });

  expect(stack).toHaveResource('AWS::CloudFormation::Stack');
  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
    AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
    Name: 'user-pool-auth-api',
  });
});

test('Model Tables Created and PITR', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'user-pool-auth-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'user-pool-auth-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
    enableDynamoPointInTimeRecovery: true,
  });

  const tableData = appSyncTransformer.outputs.cdkTables;
  if (!tableData) throw new Error('Expected table data');

  for (const [tableName] of Object.entries(tableData)) {
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::DataSource', {
      Name: tableName,
      Type: 'AMAZON_DYNAMODB',
    });
  }

  // Make sure LSI is set correctly on Thread table
  const threadTable = appSyncTransformer.nestedAppsyncStack.node.findChild('ThreadTable');
  expect(threadTable).toBeTruthy();

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::DynamoDB::Table', {
    KeySchema: [
      { AttributeName: 'forumName', KeyType: 'HASH' },
      { AttributeName: 'subject', KeyType: 'RANGE' },
    ],
    LocalSecondaryIndexes: [
      {
        IndexName: 'threadsByLatestPost',
        KeySchema: [
          {
            AttributeName: 'forumName',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'latestPostAt',
            KeyType: 'RANGE',
          },
        ],
        Projection: {
          ProjectionType: 'ALL',
        },
      },
    ],
  });

  // Make sure GSI is set correctly on Product table
  const productTable = appSyncTransformer.nestedAppsyncStack.node.findChild('ProductTable');
  expect(productTable).toBeTruthy();

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::DynamoDB::Table', {
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'productsByName',
        KeySchema: [
          {
            AttributeName: 'name',
            KeyType: 'HASH',
          },
          {
            AttributeName: 'added',
            KeyType: 'RANGE',
          },
        ],
        Projection: {
          ProjectionType: 'ALL',
        },
      },
    ],
  });

  // Make sure ttl is on Order table
  const orderTable = appSyncTransformer.nestedAppsyncStack.node.findChild('OrderTable');
  expect(orderTable).toBeTruthy();

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::DynamoDB::Table', {
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' },
      { AttributeName: 'productID', KeyType: 'RANGE' },
    ],
    TimeToLiveSpecification: {
      AttributeName: 'expirationUnixTime',
      Enabled: true,
    },
    PointInTimeRecoverySpecification: {
      PointInTimeRecoveryEnabled: true,
    },
  });
});

test('HTTP Resolvers Match', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'user-pool-auth-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'user-pool-auth-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
  });

  expect(appSyncTransformer.httpResolvers).toBeTruthy();

  const endpointResolvers = appSyncTransformer.httpResolvers[testHttpEndpoint];
  expect(endpointResolvers.length).toEqual(2);

  for (const resolver of endpointResolvers) {
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::Resolver', {
      FieldName: resolver.fieldName,
      TypeName: resolver.typeName,
    });
  }
});

test('Function Resolvers Match', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'user-pool-auth-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'user-pool-auth-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
  });

  const functionResolvers = appSyncTransformer.functionResolvers;
  expect(functionResolvers).toBeTruthy();
  expect(functionResolvers![functionDirectiveTestFunctionName]).toBeTruthy(); // Will fail above if not truthy

  const testFunctionResolvers = functionResolvers![functionDirectiveTestFunctionName]; // will fail above if does not exist
  expect(testFunctionResolvers.length).toEqual(4);
});

test('addLambdaDataSourceAndResolvers', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'user-pool-auth-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'user-pool-auth-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
  });

  // We don't really need this to work
  const testFunction = new Function(stack, 'test-function', {
    runtime: Runtime.NODEJS_12_X,
    code: Code.fromInline('export function handler() { }'),
    handler: 'handler',
  });

  const testFunctionDataSource = appSyncTransformer.addLambdaDataSourceAndResolvers(
    functionDirectiveTestFunctionName,
    'test-data-source',
    testFunction,
  );

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::DataSource', {
    Name: testFunctionDataSource.name,
    Type: 'AWS_LAMBDA',
  });

  const testFunctionResolvers = appSyncTransformer.functionResolvers[functionDirectiveTestFunctionName];
  for (const resolver of testFunctionResolvers) {
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::Resolver', {
      FieldName: resolver.fieldName,
      TypeName: resolver.typeName,
    });
  }
});

test('Custom Pre Transform', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'custom-transform-stack');

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testCustomTransformerSchemaPath,
    apiName: 'custom-transforms',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.API_KEY,
      },
    },
    preCdkTransformers: [
      new MappedTransformer(),
      new SingleFieldMapTransformer(),
    ],
  });

  expect(appSyncTransformer.httpResolvers).toBeTruthy();

  const endpointResolvers = appSyncTransformer.httpResolvers[testHttpEndpoint];
  expect(endpointResolvers.length).toEqual(1);

  for (const resolver of endpointResolvers) {
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::Resolver', {
      FieldName: resolver.fieldName,
      TypeName: resolver.typeName,
    });
  }

  const noneDataResolvers = appSyncTransformer.outputs.noneResolvers ?? {};
  expect(Object.keys(noneDataResolvers).length).toEqual(2);
});

test('Custom Post Transform', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'custom-transform-stack');

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testCustomTransformerSchemaPath,
    apiName: 'custom-transforms',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.API_KEY,
      },
    },
    postCdkTransformers: [
      new MappedTransformer(),
      new SingleFieldMapTransformer(),
    ],
  });

  expect(appSyncTransformer.httpResolvers).toBeTruthy();

  const endpointResolvers = appSyncTransformer.httpResolvers[testHttpEndpoint];
  expect(endpointResolvers.length).toEqual(1);

  for (const resolver of endpointResolvers) {
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::Resolver', {
      FieldName: resolver.fieldName,
      TypeName: resolver.typeName,
    });
  }
});

test('Invalid Transformer', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'custom-transform-stack');

  const willThrow = () => {
    new AppSyncTransformer(stack, 'test-transformer', {
      schemaPath: testCustomTransformerSchemaPath,
      apiName: 'custom-transforms',
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
        },
      },
      preCdkTransformers: [
        '123abc',
      ],
    });
  };

  expect(willThrow).toThrow();
});

test('DynamoDB Stream Config Property', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'user-pool-auth-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'user-pool-auth-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
    dynamoDbStreamConfig: {
      Order: StreamViewType.NEW_IMAGE,
    },
  });

  const tableData = appSyncTransformer.outputs.cdkTables;
  if (!tableData) throw new Error('Expected table data');

  // Make sure order table exists
  const orderTable = appSyncTransformer.tableMap.OrderTable;
  expect(orderTable.tableStreamArn).toBeTruthy();

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::DynamoDB::Table', {
    StreamSpecification: {
      StreamViewType: StreamViewType.NEW_IMAGE,
    },
  });
});

test('DynamoDB Stream Enabled Convenience Method', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'user-pool-auth-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'user-pool-auth-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
  });

  const tableData = appSyncTransformer.outputs.cdkTables;
  if (!tableData) throw new Error('Expected table data');

  const streamArn = appSyncTransformer.addDynamoDBStream({
    modelTypeName: 'Order',
    streamViewType: StreamViewType.NEW_IMAGE,
  });

  expect(streamArn).toBeTruthy();

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::DynamoDB::Table', {
    StreamSpecification: {
      StreamViewType: StreamViewType.NEW_IMAGE,
    },
  });

});

test('Grant Access To Public/Private Fields', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'test-grant-stack');

  const userPool = new UserPool(stack, 'test-userpool');
  const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'grant-test-api',
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: AuthorizationType.USER_POOL,
        userPoolConfig: {
          userPool: userPool,
          appIdClientRegex: userPoolClient.userPoolClientId,
          defaultAction: UserPoolDefaultAction.ALLOW,
        },
      },
    },
  });

  // We don't really need this to work
  const testPrivateFunction = new Function(stack, 'test-function', {
    runtime: Runtime.NODEJS_12_X,
    code: Code.fromInline('export function handler() { }'),
    handler: 'handler',
  });

  appSyncTransformer.grantPrivate(testPrivateFunction);
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'appsync:GraphQL',
          Effect: 'Allow',
          Resource: [
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Customer/*',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Mutation/fields/updateCustomer',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/getCustomer',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/listCustomers',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onCreateCustomer',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onUpdateCustomer',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onDeleteCustomer',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Product/*',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/getProduct',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/listProducts',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/productsByName',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onCreateProduct',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onUpdateProduct',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onDeleteProduct',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/User/*',
                ],
              ],
            },
          ],
        },
      ],
    },
    PolicyName: 'testfunctionServiceRoleDefaultPolicy2F277F85',
    Roles: [
      {
        Ref: 'testfunctionServiceRoleFB85AD63',
      },
    ],
  });

  const identityPool = new CfnIdentityPool(stack, 'test-identity-pool', {
    identityPoolName: 'test-identity-pool',
    cognitoIdentityProviders: [
      {
        clientId: userPoolClient.userPoolClientId,
        providerName: `cognito-idp.${stack.region}.amazonaws.com/${userPool.userPoolId}`,
      },
    ],
    allowUnauthenticatedIdentities: true,
  });

  const testPublicRole = new Role(stack, 'public-role', {
    assumedBy: new WebIdentityPrincipal('cognito-identity.amazonaws.com')
      .withConditions({
        'StringEquals': { 'cognito-identity.amazonaws.com:aud': `${identityPool.ref}` },
        'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated' },
      }),
  });

  appSyncTransformer.grantPublic(testPublicRole);
  expect(stack).toHaveResourceLike('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'appsync:GraphQL',
          Effect: 'Allow',
          Resource: [
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Product/*',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/getProduct',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/listProducts',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Query/fields/productsByName',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onCreateProduct',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onUpdateProduct',
                ],
              ],
            },
            {
              'Fn::Join': [
                '',
                [
                  'arn:aws:appsync:',
                  {
                    Ref: 'AWS::Region',
                  },
                  ':',
                  {
                    Ref: 'AWS::AccountId',
                  },
                  ':apis/',
                  {
                    'Fn::GetAtt': [
                      'testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073',
                      'Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId',
                    ],
                  },
                  '/types/Subscription/fields/onDeleteProduct',
                ],
              ],
            },
          ],
        },
      ],
    },
    PolicyName: 'publicroleDefaultPolicy321C2CCD',
    Roles: [
      {
        Ref: 'publicroleEFDEA157',
      },
    ],
  });
});

test('Custom Table Names Are Applied', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'custom-table-names-stack');

  const customerTableName = 'CustomerTableCustomName';
  const orderTableName = 'OrderTableCustomName';

  const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
    schemaPath: testSchemaPath,
    apiName: 'custom-table-names-api',
    tableNames: {
      CustomerTable: customerTableName,
      OrderTable: orderTableName,
    },
  });

  const tableData = appSyncTransformer.outputs.cdkTables;
  if (!tableData) throw new Error('Expected table data');

  // Make sure custom name was applied to CustomerTable
  const customerTable = appSyncTransformer.nestedAppsyncStack.node.findChild('CustomerTable');
  expect(customerTable).toBeTruthy();

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::DynamoDB::Table', {
    TableName: customerTableName,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' },
    ],
  });

  // Make sure custom name was applied to OrderTable
  const orderTable = appSyncTransformer.nestedAppsyncStack.node.findChild('OrderTable');
  expect(orderTable).toBeTruthy();

  expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::DynamoDB::Table', {
    TableName: orderTableName,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' },
      { AttributeName: 'productID', KeyType: 'RANGE' },
    ],
  });
});

test('Can override resolver', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'override-resolver-stack');

  const appsyncTransformer = new AppSyncTransformer(stack, 'override-transformer', {
    schemaPath: testSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
  });

  expect(appsyncTransformer.resolvers.gsi).toMatchObject({
    ...appsyncTransformer.resolvers.gsi,
    Postcomments: {
      typeName: 'Post',
      fieldName: 'comments',
      tableName: 'Comments',
      requestMappingTemplate: join('appsync', 'resolvers', 'Post.comments.req'),
      responseMappingTemplate: join('appsync', 'resolvers', 'Post.comments.res'),
    },
  });

  appsyncTransformer.overrideResolver({
    typeName: 'Post',
    fieldName: 'comments',
    requestMappingTemplateFile: path.join(process.cwd(), 'test', 'custom-resolvers', 'Test', 'request.vtl'),
    responseMappingTemplateFile: path.join(process.cwd(), 'test', 'custom-resolvers', 'Test', 'response.vtl'),
  });

  expect(appsyncTransformer.nestedAppsyncStack).toHaveResourceLike('AWS::AppSync::Resolver', {
    FieldName: 'comments',
    TypeName: 'Post',
    Kind: 'UNIT',
    RequestMappingTemplate: `{${EOL}  "version": "2018-05-29"${EOL}}`,
    ResponseMappingTemplate: '$util.toJson({})',
  });
});

const customVtlTestSchemaPath = path.join(__dirname, 'customVtlTransformerSchema.graphql');

test('Custom VTL Transformer Creates Resolvers', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'custom-vtl-stack');

  const appsyncTransformer = new AppSyncTransformer(stack, 'custom-vtl-transformer', {
    schemaPath: customVtlTestSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
  });

  expect(appsyncTransformer.resolvers).toMatchObject({
    QuerylistThingCustom: {
      typeName: 'Query',
      fieldName: 'listThingCustom',
      requestMappingTemplate: join('appsync', 'resolvers', 'Query.listThingCustom.req'),
      responseMappingTemplate: join('appsync', 'resolvers', 'Query.listThingCustom.res'),
    },
  });

  expect(appsyncTransformer.nestedAppsyncStack).toHaveResourceLike('AWS::AppSync::Resolver', {
    FieldName: 'listThingCustom',
    TypeName: 'Query',
    DataSourceName: 'NONE',
    Kind: 'UNIT',
    RequestMappingTemplate: `{${EOL}  "version": "2018-05-29"${EOL}}`,
    ResponseMappingTemplate: '$util.toJson({})',
  });
});

test('field reference lambda uses appsync generated resolver', () => {
  const mockApp = new App();
  const stackA = new Stack(mockApp, 'field-ref-stack');
  const stackB = new Stack(mockApp, 'field-ref-stack-off');

  const appsyncTransformerWithoutPipeline = new AppSyncTransformer(stackA, 'field-ref-transformer-off', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
  });
  const appsyncTransformer = new AppSyncTransformer(stackB, 'field-ref-transformer', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
    pipelineFieldLambdas: true,
  });

  const testFunctionA = new Function(stackA, 'test-function-a', {
    runtime: Runtime.NODEJS_12_X,
    code: Code.fromInline('export function handler() { }'),
    handler: 'handler',
  });
  const testFunctionB = new Function(stackB, 'test-function-b', {
    runtime: Runtime.NODEJS_12_X,
    code: Code.fromInline('export function handler() { }'),
    handler: 'handler',
  });

  appsyncTransformerWithoutPipeline.addLambdaDataSourceAndResolvers('testFn', 'fn', testFunctionA);
  appsyncTransformer.addLambdaDataSourceAndResolvers('testFn', 'fn', testFunctionB);

  expect(appsyncTransformerWithoutPipeline.nestedAppsyncStack).not.toHaveResourceLike('AWS::AppSync::Resolver', {
    FieldName: 'delegate',
    TypeName: 'Test',
    DataSourceName: 'fn',
    Kind: 'UNIT',
    RequestMappingTemplate: '## [Start] Stash resolver specific context.. **\n$util.qr($ctx.stash.put(\"typeName\", \"Test\"))\n$util.qr($ctx.stash.put(\"fieldName\", \"delegate\"))\n{}\n## [End] Stash resolver specific context.. **',
    ResponseMappingTemplate: '$util.toJson($ctx.prev.result)',
  });
  expect(appsyncTransformer.nestedAppsyncStack).toHaveResourceLike('AWS::AppSync::Resolver', {
    FieldName: 'delegate',
    TypeName: 'Test',
    Kind: 'PIPELINE',
    RequestMappingTemplate: '## [Start] Stash resolver specific context.. **\n$util.qr($ctx.stash.put(\"typeName\", \"Test\"))\n$util.qr($ctx.stash.put(\"fieldName\", \"delegate\"))\n{}\n## [End] Stash resolver specific context.. **',
    ResponseMappingTemplate: '$util.toJson($ctx.prev.result)',
  });
});

test('Can Set Custom Directory', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'custom-vtl-stack');

  const customDir = path.join(process.cwd(), '..', 'cdk-appsync-transformer');

  new AppSyncTransformer(stack, 'custom-vtl-transformer', {
    schemaPath: customVtlTestSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
    customVtlTransformerRootDirectory: customDir,
  });
});

test('Can pass in a schema directory and override resolvers', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'custom-schema-dir');

  const transformer = new AppSyncTransformer(stack, 'schema-directory', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
  });
  expect(Object.keys(transformer.tableMap)).toContain('TestTable');
  expect(Object.keys(transformer.tableMap)).toContain('RunTable');
  expect(Object.keys(transformer.fieldResolvers)).toContain('getRun');
  const cfnResolver = transformer.fieldResolvers.getRun?.[0]!
    .node.defaultChild! as CfnResolver;
  expect(cfnResolver).toBeTruthy();
  cfnResolver.syncConfig = {
    conflictDetection: 'VERSION',
    conflictHandler: 'OPTIMISTIC_CONCURRENCY',
  };
});

test('Can override amplifyTransformers', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'amplifyTransformers');

  expect(() => new AppSyncTransformer(stack, 'amplifyTransformers-expectedThrow', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
    amplifyTransformers: [],
  })).toThrow();
  expect(() => new AppSyncTransformer(stack, 'amplifyTransformers-noThrow', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
    amplifyTransformers: [new DynamoDBModelTransformer(), new KeyTransformer(), new HttpTransformer(), new FunctionTransformer()],
  })).not.toThrow();
});

test('Lambda resources use provided schema', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'amplifyTransformers');

  const transformer = new AppSyncTransformer(stack, 'amplifyTransformers-noThrow', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
    amplifyTransformers: [new DynamoDBModelTransformer(), new KeyTransformer(), new HttpTransformer(), new FunctionTransformer()],
  });
  expect(transformer);
});

test('Can override transformConfig', () => {
  const mockApp = new App();
  const stack1 = new Stack(mockApp, 'transformConfig1');
  const stack2 = new Stack(mockApp, 'transformConfig2');

  const schema1 = new AppSyncTransformer(stack1, 'amplifyTransformers-v5', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
    transformConfig: {
      Version: 5,
    },
  }).appsyncAPI.schema.definition;
  const schema2 = new AppSyncTransformer(stack2, 'amplifyTransformers-v3', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
    transformConfig: {
      Version: 3,
    },
  }).appsyncAPI.schema.definition;
  expect(schema1).not.toMatch(schema2);
});

test('Can override featureFlags', () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, 'featureFlags');
  let foundFeatureFlags: Set<string> = new Set();

  const withFeatureFlags = () => new AppSyncTransformer(stack, 'featureFlags-extractor', {
    schemaPath: path.resolve(__dirname, 'schema-directory'),
    featureFlags: {
      getBoolean: (k: string) => {
        foundFeatureFlags.add(k);
        return false;
      },
      getString: (k: string) => {
        foundFeatureFlags.add(k);
        return '';
      },
      getNumber: (k: string) => {
        foundFeatureFlags.add(k);
        return 0;
      },
      getObject: (k: string) => {
        foundFeatureFlags.add(k);
        return {};
      },
    },
  });
  expect(withFeatureFlags).not.toThrow();
  expect(Array.from(foundFeatureFlags.values()).sort()).toMatchInlineSnapshot(`
Array [
  "improvePluralization",
  "skipOverrideMutationInputTypes",
]
`);
});
