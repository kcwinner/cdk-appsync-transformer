import '@aws-cdk/assert/jest';
import * as path from 'path';
import { AuthorizationType, AuthorizationConfig, UserPoolDefaultAction } from '@aws-cdk/aws-appsync';
import { UserPool, UserPoolClient } from '@aws-cdk/aws-cognito';
import { CfnTable } from '@aws-cdk/aws-dynamodb';
import { Runtime, Code, Function } from '@aws-cdk/aws-lambda';
import { App, Stack } from '@aws-cdk/core';

import { AppSyncTransformer } from '../src/index';
import MappedTransformer from './mappedTransformer';

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

test('Model Tables Created', () => {
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

  for (const [tableName] of Object.entries(tableData)) {
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::DataSource', {
      Name: tableName,
      Type: 'AMAZON_DYNAMODB',
    });
  }

  // Make sure ttl is on Order table
  const orderTable = appSyncTransformer.nestedAppsyncStack.node.findChild('OrderTable') as CfnTable;
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