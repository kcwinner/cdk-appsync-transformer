import { App, Stack } from '@aws-cdk/core';
import '@aws-cdk/assert/jest';
import { AuthorizationType, AuthorizationConfig, UserPoolDefaultAction } from '@aws-cdk/aws-appsync';
import { UserPool, UserPoolClient } from '@aws-cdk/aws-cognito';

import { AppSyncTransformer } from '../src/index';

import * as path from 'path';

const testSchemaPath = path.join(__dirname, 'schema.graphql');

const apiKeyAuthorizationConfig: AuthorizationConfig = {
    defaultAuthorization: {
        authorizationType: AuthorizationType.API_KEY,
        apiKeyConfig: {
            description: 'Auto generated API Key from construct',
            name: 'dev',
        }
    }
}

test('GraphQL API W/ Defaults Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'testing-stack');

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: testSchemaPath,
        authorizationConfig: apiKeyAuthorizationConfig
    });

    expect(stack).toHaveResource('AWS::CloudFormation::Stack');
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'API_KEY'
    });
});

test('GraphQL API W/ Sync Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'testing-sync-stack');

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: testSchemaPath,
        apiName: 'sync-api',
        authorizationConfig: apiKeyAuthorizationConfig,
        syncEnabled: true
    });

    expect(stack).toHaveResource('AWS::CloudFormation::Stack');
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'API_KEY',
        Name: 'sync-api'
    });
});

test('GraphQL API W/ User Pool Auth Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'user-pool-auth-stack');

    const userPool = new UserPool(stack, 'test-userpool');
    const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
        userPool: userPool
    })

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: testSchemaPath,
        apiName: 'user-pool-auth-api',
        authorizationConfig: {
            defaultAuthorization: {
                authorizationType: AuthorizationType.USER_POOL,
                userPoolConfig: {
                    userPool: userPool,
                    appIdClientRegex: userPoolClient.userPoolClientId,
                    defaultAction: UserPoolDefaultAction.ALLOW
                }
            }
        }
    });

    expect(stack).toHaveResource('AWS::CloudFormation::Stack');
    expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::GraphQLApi', {
        AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
        Name: 'user-pool-auth-api'
    });
});

test('Model Tables Created', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'user-pool-auth-stack');

    const userPool = new UserPool(stack, 'test-userpool');
    const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
        userPool: userPool
    })

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: testSchemaPath,
        apiName: 'user-pool-auth-api',
        authorizationConfig: {
            defaultAuthorization: {
                authorizationType: AuthorizationType.USER_POOL,
                userPoolConfig: {
                    userPool: userPool,
                    appIdClientRegex: userPoolClient.userPoolClientId,
                    defaultAction: UserPoolDefaultAction.ALLOW
                }
            }
        }
    });
    
    const tableData = appSyncTransformer.outputs.CDK_TABLES;
    if (!tableData) throw new Error('Expected table data');

    for (const [tableName] of Object.entries(tableData)) {
        expect(appSyncTransformer.nestedAppsyncStack).toHaveResource('AWS::AppSync::DataSource', {
            Name: tableName,
            Type: 'AMAZON_DYNAMODB'
        });
    }
});

test('Function Resolvers Match', () => {
    const mockApp = new App();
    const stack = new Stack(mockApp, 'user-pool-auth-stack');

    const userPool = new UserPool(stack, 'test-userpool');
    const userPoolClient = new UserPoolClient(stack, 'test-userpool-client', {
        userPool: userPool
    })

    const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
        schemaPath: testSchemaPath,
        apiName: 'user-pool-auth-api',
        authorizationConfig: {
            defaultAuthorization: {
                authorizationType: AuthorizationType.USER_POOL,
                userPoolConfig: {
                    userPool: userPool,
                    appIdClientRegex: userPoolClient.userPoolClientId,
                    defaultAction: UserPoolDefaultAction.ALLOW
                }
            }
        }
    });
    
    const functionResolvers = appSyncTransformer.functionResolvers;
    expect(functionResolvers).toBeTruthy();
    expect(functionResolvers!['test-function']).toBeTruthy(); // Will fail above if not truthy

    const testFunctionResolvers = functionResolvers!['test-function']; // will fail above if does not exist
    expect(testFunctionResolvers.length).toEqual(4);
});