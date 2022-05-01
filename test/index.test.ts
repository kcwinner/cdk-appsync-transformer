// @ts-nocheck
import * as path from "path";
import { AuthorizationType, AuthorizationConfig, UserPoolDefaultAction } from "@aws-cdk/aws-appsync-alpha";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CfnIdentityPool, UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { StreamViewType } from "aws-cdk-lib/aws-dynamodb";
import { Role, WebIdentityPrincipal } from "aws-cdk-lib/aws-iam";
import { Runtime, Code, Function } from "aws-cdk-lib/aws-lambda";

import { AppSyncTransformer } from "../src/index";
import MappedTransformer from "./mappedTransformer";
import SingleFieldMapTransformer from "./singleFieldMapTransformer";

const testSchemaPath = path.join(__dirname, "schema.graphql");
const testCustomTransformerSchemaPath = path.join(__dirname, "customTransformSchema.graphql");
const functionDirectiveTestFunctionName = "test-function";
const testHttpEndpoint = "https://jsonplaceholder.typicode.com";

const apiKeyAuthorizationConfig: AuthorizationConfig = {
  defaultAuthorization: {
    authorizationType: AuthorizationType.API_KEY,
    apiKeyConfig: {
      description: "Auto generated API Key from construct",
      name: "dev",
    },
  },
};

test("GraphQL API W/ Defaults Created", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "testing-stack");

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
  });

  const template = Template.fromStack(stack);

  template.hasResource("AWS::CloudFormation::Stack", {});
  template.hasResourceProperties("AWS::AppSync::GraphQLApi", {
    AuthenticationType: "API_KEY",
    XrayEnabled: false,
  });

  const customeStackTemplate = Template.fromStack(appSyncTransformer.nestedStacks.Customer);
  customeStackTemplate.hasResource("AWS::DynamoDB::Table", {});
});

test.skip("GraphQL API W/ Sync Created", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "testing-sync-stack");

  new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "sync-api",
    authorizationConfig: apiKeyAuthorizationConfig,
    syncEnabled: true,
    xrayEnabled: true,
  });

  const template = Template.fromStack(stack);

  template.hasResource("AWS::CloudFormation::Stack", {});
  template.hasResourceProperties("AWS::AppSync::GraphQLApi", {
    AuthenticationType: "API_KEY",
    Name: "sync-api",
    XrayEnabled: true,
  });
});

test("GraphQL API W/ User Pool Auth Created", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "user-pool-auth-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "user-pool-auth-api",
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

  const template = Template.fromStack(stack);

  template.hasResource("AWS::CloudFormation::Stack", {});
  template.hasResourceProperties("AWS::AppSync::GraphQLApi", {
    AuthenticationType: "AMAZON_COGNITO_USER_POOLS",
    Name: "user-pool-auth-api",
  });
});

test("Model Tables Created and PITR", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "user-pool-auth-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "user-pool-auth-api",
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

  if (!appSyncTransformer.tableMap) throw new Error("Expected table data");

  for (const [name, nestedStack] of Object.entries(appSyncTransformer.nestedStacks)) {
    const nestedTemplate = Template.fromStack(nestedStack);
    if (!nestedTemplate || !nestedTemplate.template || !nestedTemplate.template.Resources) continue;

    if (["HttpStack", "FunctionDirectiveStack", "ConnectionStack"].includes(name)) {
      nestedTemplate.hasResourceProperties("AWS::AppSync::DataSource", {
        Type: "NONE",
      });

      continue;
    }

    // TODO: not sure if I want the datasources here or not
    const datasources = nestedTemplate.findResources("AWS::AppSync::DataSource");
    if (datasources) {
      nestedTemplate.hasResourceProperties("AWS::AppSync::DataSource", {
        Name: `${name}TableDataSource`,
        Type: "AMAZON_DYNAMODB",
      });
    }
  }

  // Make sure LSI is set correctly on Thread table
  const threadStackTemplate = Template.fromStack(appSyncTransformer.nestedStacks.Thread);
  const threadTable = appSyncTransformer.nestedStacks.Thread.node.findChild("ThreadTable");
  expect(threadTable).toBeTruthy();

  threadStackTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [
      { AttributeName: "forumName", KeyType: "HASH" },
      { AttributeName: "subject", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      {
        AttributeName: "forumName",
        AttributeType: "S",
      },
      {
        AttributeName: "subject",
        AttributeType: "S",
      },
      {
        AttributeName: "latestPostAt",
        AttributeType: "S",
      },
    ],
    LocalSecondaryIndexes: [
      {
        IndexName: "byLatestPost",
        KeySchema: [
          {
            AttributeName: "forumName",
            KeyType: "HASH",
          },
          {
            AttributeName: "latestPostAt",
            KeyType: "RANGE",
          },
        ],
        Projection: {
          ProjectionType: "ALL",
        },
      },
    ],
    PointInTimeRecoverySpecification: {
      PointInTimeRecoveryEnabled: true,
    },
  });

  // Make sure GSI is set correctly on Product table
  const productStackTemplate = Template.fromStack(appSyncTransformer.nestedStacks.Product);
  const productTable = appSyncTransformer.nestedStacks.Product.node.findChild("ProductTable");
  expect(productTable).toBeTruthy();

  productStackTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
    GlobalSecondaryIndexes: [
      {
        IndexName: "productsByName",
        KeySchema: [
          {
            AttributeName: "name",
            KeyType: "HASH",
          },
          {
            AttributeName: "added",
            KeyType: "RANGE",
          },
        ],
        Projection: {
          ProjectionType: "ALL",
        },
      },
    ],
  });

  // TODO: Rebuild ttl transformer??

  // // Make sure ttl is on Order table
  // const orderTable = appSyncTransformer.nestedAppsyncStack.node.findChild("OrderTable");
  // expect(orderTable).toBeTruthy();

  // nestedTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
  //   KeySchema: [
  //     { AttributeName: "id", KeyType: "HASH" },
  //     { AttributeName: "productID", KeyType: "RANGE" },
  //   ],
  //   TimeToLiveSpecification: {
  //     AttributeName: "expirationUnixTime",
  //     Enabled: true,
  //   },
  //   PointInTimeRecoverySpecification: {
  //     PointInTimeRecoveryEnabled: true,
  //   },
  // });
});

test("HTTP Resolvers Match", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "user-pool-auth-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "user-pool-auth-api",
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

  const httpNestedTemplate = Template.fromStack(appSyncTransformer.nestedStacks.HttpStack);
  for (const resolver of endpointResolvers) {
    httpNestedTemplate.hasResourceProperties("AWS::AppSync::Resolver", {
      FieldName: resolver.fieldName,
      TypeName: resolver.typeName,
    });
  }
});

test("Function Resolvers Match", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "user-pool-auth-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "user-pool-auth-api",
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

test("addLambdaDataSourceAndResolvers", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "lambda-resolvers-test-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "user-pool-auth-api",
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
  const testFunction = new Function(stack, functionDirectiveTestFunctionName, {
    runtime: Runtime.NODEJS_12_X,
    code: Code.fromInline("export function handler() { }"),
    handler: "handler",
  });

  const testFunctionDataSource = appSyncTransformer.addLambdaDataSourceAndResolvers(functionDirectiveTestFunctionName, "test-data-source", testFunction);

  const nestedTemplate = Template.fromStack(appSyncTransformer.nestedStacks.FunctionDirectiveStack);
  nestedTemplate.hasResourceProperties("AWS::AppSync::DataSource", {
    Name: testFunctionDataSource.name,
    Type: "AWS_LAMBDA",
  });

  const testFunctionResolvers = appSyncTransformer.functionResolvers[functionDirectiveTestFunctionName];
  for (const resolver of testFunctionResolvers) {
    nestedTemplate.hasResourceProperties("AWS::AppSync::Resolver", {
      FieldName: resolver.fieldName,
      TypeName: resolver.typeName,
    });
  }
});

// test("Custom Pre Transform", () => {
//   const mockApp = new App();
//   const stack = new Stack(mockApp, "custom-transform-stack");

//   const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
//     schemaPath: testCustomTransformerSchemaPath,
//     apiName: "custom-transforms",
//     authorizationConfig: {
//       defaultAuthorization: {
//         authorizationType: AuthorizationType.API_KEY,
//       },
//     },
//     preCdkTransformers: [new MappedTransformer(), new SingleFieldMapTransformer()],
//   });

//   const nestedTemplate = Template.fromStack(appSyncTransformer.nestedAppsyncStack);

//   expect(appSyncTransformer.httpResolvers).toBeTruthy();

//   const endpointResolvers = appSyncTransformer.httpResolvers[testHttpEndpoint];
//   expect(endpointResolvers.length).toEqual(1);

//   for (const resolver of endpointResolvers) {
//     nestedTemplate.hasResourceProperties("AWS::AppSync::Resolver", {
//       FieldName: resolver.fieldName,
//       TypeName: resolver.typeName,
//     });
//   }

//   const noneDataResolvers = appSyncTransformer.outputs.noneResolvers ?? {};
//   expect(Object.keys(noneDataResolvers).length).toEqual(2);
// });

// test("Custom Post Transform", () => {
//   const mockApp = new App();
//   const stack = new Stack(mockApp, "custom-transform-stack");

//   const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
//     schemaPath: testCustomTransformerSchemaPath,
//     apiName: "custom-transforms",
//     authorizationConfig: {
//       defaultAuthorization: {
//         authorizationType: AuthorizationType.API_KEY,
//       },
//     },
//     postCdkTransformers: [new MappedTransformer(), new SingleFieldMapTransformer()],
//   });

//   const nestedTemplate = Template.fromStack(appSyncTransformer.nestedAppsyncStack);

//   expect(appSyncTransformer.httpResolvers).toBeTruthy();

//   const endpointResolvers = appSyncTransformer.httpResolvers[testHttpEndpoint];
//   expect(endpointResolvers.length).toEqual(1);

//   for (const resolver of endpointResolvers) {
//     nestedTemplate.hasResourceProperties("AWS::AppSync::Resolver", {
//       FieldName: resolver.fieldName,
//       TypeName: resolver.typeName,
//     });
//   }
// });

test("Invalid Transformer", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "custom-transform-stack");

  const willThrow = () => {
    new AppSyncTransformer(stack, "test-transformer", {
      schemaPath: testCustomTransformerSchemaPath,
      apiName: "custom-transforms",
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.API_KEY,
        },
      },
      preCdkTransformers: ["123abc"],
    });
  };

  expect(willThrow).toThrow();
});

test("DynamoDB Stream Config Property", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "user-pool-auth-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "user-pool-auth-api",
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

  // Make sure order table exists
  const orderTable = appSyncTransformer.tableMap.OrderTable;
  expect(orderTable.tableStreamArn).toBeTruthy();

  const nestedTemplate = Template.fromStack(appSyncTransformer.nestedStacks.Order);
  nestedTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
    StreamSpecification: {
      StreamViewType: StreamViewType.NEW_IMAGE,
    },
  });
});

test("DynamoDB Stream Enabled Convenience Method", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "user-pool-auth-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "user-pool-auth-api",
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

  const streamArn = appSyncTransformer.addDynamoDBStream({
    modelTypeName: "Order",
    streamViewType: StreamViewType.NEW_IMAGE,
  });

  expect(streamArn).toBeTruthy();

  const nestedTemplate = Template.fromStack(appSyncTransformer.nestedStacks.Order);
  nestedTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
    StreamSpecification: {
      StreamViewType: StreamViewType.NEW_IMAGE,
    },
  });
});

test.skip("Grant Access To Public/Private Fields", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "test-grant-stack");

  const userPool = new UserPool(stack, "test-userpool");
  const userPoolClient = new UserPoolClient(stack, "test-userpool-client", {
    userPool: userPool,
  });

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "grant-test-api",
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
  const testPrivateFunction = new Function(stack, "test-function", {
    runtime: Runtime.NODEJS_12_X,
    code: Code.fromInline("export function handler() { }"),
    handler: "handler",
  });

  appSyncTransformer.grantPrivate(testPrivateFunction);

  const identityPool = new CfnIdentityPool(stack, "test-identity-pool", {
    identityPoolName: "test-identity-pool",
    cognitoIdentityProviders: [
      {
        clientId: userPoolClient.userPoolClientId,
        providerName: `cognito-idp.${stack.region}.amazonaws.com/${userPool.userPoolId}`,
      },
    ],
    allowUnauthenticatedIdentities: true,
  });

  const testPublicRole = new Role(stack, "public-role", {
    assumedBy: new WebIdentityPrincipal("cognito-identity.amazonaws.com").withConditions({
      StringEquals: { "cognito-identity.amazonaws.com:aud": `${identityPool.ref}` },
      "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "unauthenticated" },
    }),
  });

  appSyncTransformer.grantPublic(testPublicRole);

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: [
        {
          Action: "appsync:GraphQL",
          Effect: "Allow",
          Resource: [
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Customer/*",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Mutation/fields/updateCustomer",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/getCustomer",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/listCustomers",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onCreateCustomer",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onUpdateCustomer",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onDeleteCustomer",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Product/*",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/getProduct",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/listProducts",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/productsByName",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onCreateProduct",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onUpdateProduct",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onDeleteProduct",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/User/*",
                ],
              ],
            },
          ],
        },
      ],
    },
    PolicyName: "testfunctionServiceRoleDefaultPolicy2F277F85",
    Roles: [
      {
        Ref: "testfunctionServiceRoleFB85AD63",
      },
    ],
  });

  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyDocument: {
      Statement: [
        {
          Action: "appsync:GraphQL",
          Effect: "Allow",
          Resource: [
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  { Ref: "AWS::Region" },
                  ":",
                  { Ref: "AWS::AccountId" },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Product/*",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  { Ref: "AWS::Region" },
                  ":",
                  { Ref: "AWS::AccountId" },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/getProduct",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/listProducts",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Query/fields/productsByName",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onCreateProduct",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onUpdateProduct",
                ],
              ],
            },
            {
              "Fn::Join": [
                "",
                [
                  "arn:aws:appsync:",
                  {
                    Ref: "AWS::Region",
                  },
                  ":",
                  {
                    Ref: "AWS::AccountId",
                  },
                  ":apis/",
                  {
                    "Fn::GetAtt": [
                      "testtransformerappsyncnestedstackNestedStackappsyncnestedstackNestedStackResourceC669E073",
                      "Outputs.testgrantstacktesttransformerappsyncnestedstacktesttransformerapiBA0BE26BApiId",
                    ],
                  },
                  "/types/Subscription/fields/onDeleteProduct",
                ],
              ],
            },
          ],
        },
      ],
    },
    PolicyName: "publicroleDefaultPolicy321C2CCD",
    Roles: [
      {
        Ref: "publicroleEFDEA157",
      },
    ],
  });
});

test("Custom Table Names Are Applied", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "custom-table-names-stack");

  const customerTableName = "CustomerTableCustomName";
  const orderTableName = "OrderTableCustomName";

  const appSyncTransformer = new AppSyncTransformer(stack, "test-transformer", {
    schemaPath: testSchemaPath,
    apiName: "custom-table-names-api",
    tableNames: {
      CustomerTable: customerTableName,
      OrderTable: orderTableName,
    },
  });

  const tableData = appSyncTransformer.tableNameMap;
  if (!tableData) throw new Error("Expected table data");

  // Make sure custom name was applied to CustomerTable
  const customerTable = appSyncTransformer.nestedStacks.Customer.node.findChild("CustomerTable");
  expect(customerTable).toBeTruthy();

  const customerNestedTemplate = Template.fromStack(appSyncTransformer.nestedStacks.Customer);
  customerNestedTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: customerTableName,
    KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  });

  // Make sure custom name was applied to OrderTable
  const orderTable = appSyncTransformer.nestedStacks.Order.node.findChild("OrderTable");
  expect(orderTable).toBeTruthy();

  const orderNestedTemplate = Template.fromStack(appSyncTransformer.nestedStacks.Order);
  orderNestedTemplate.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: orderTableName,
    KeySchema: [
      { AttributeName: "id", KeyType: "HASH" },
      { AttributeName: "productID", KeyType: "RANGE" },
    ],
  });
});

test.skip("Can override resolver", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "override-resolver-stack");

  const appSyncTransformer = new AppSyncTransformer(stack, "override-transformer", {
    schemaPath: testSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
  });

  expect(appSyncTransformer.resolvers.gsi).toMatchObject({
    ...appSyncTransformer.resolvers.gsi,
    Postcomments: {
      typeName: "Post",
      fieldName: "comments",
      tableName: "Comments",
      requestMappingTemplate: "appsync/resolvers/Post.comments.req",
      responseMappingTemplate: "appsync/resolvers/Post.comments.res",
    },
  });

  appSyncTransformer.overrideResolver({
    typeName: "Post",
    fieldName: "comments",
    requestMappingTemplateFile: path.join(process.cwd(), "test", "custom-resolvers", "Test", "request.vtl"),
    responseMappingTemplateFile: path.join(process.cwd(), "test", "custom-resolvers", "Test", "response.vtl"),
  });

  const nestedTemplate = Template.fromStack(appSyncTransformer.nestedAppsyncStack);

  nestedTemplate.hasResourceProperties("AWS::AppSync::Resolver", {
    FieldName: "comments",
    TypeName: "Post",
    Kind: "UNIT",
    RequestMappingTemplate: '{\n  "version": "2018-05-29"\n}',
    ResponseMappingTemplate: "$util.toJson({})",
  });
});

const customVtlTestSchemaPath = path.join(__dirname, "customVtlTransformerSchema.graphql");

test.skip("Custom VTL Transformer Creates Resolvers", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "custom-vtl-stack");

  const appSyncTransformer = new AppSyncTransformer(stack, "custom-vtl-transformer", {
    schemaPath: customVtlTestSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
  });

  const nestedTemplate = Template.fromStack(appSyncTransformer.nestedAppsyncStack);

  expect(appSyncTransformer.resolvers).toMatchObject({
    QuerylistThingCustom: {
      typeName: "Query",
      fieldName: "listThingCustom",
      requestMappingTemplate: "appsync/resolvers/Query.listThingCustom.req",
      responseMappingTemplate: "appsync/resolvers/Query.listThingCustom.res",
    },
  });

  nestedTemplate.hasResourceProperties("AWS::AppSync::Resolver", {
    FieldName: "listThingCustom",
    TypeName: "Query",
    DataSourceName: "NONE",
    Kind: "UNIT",
    RequestMappingTemplate: '{\n  "version": "2018-05-29"\n}',
    ResponseMappingTemplate: "$util.toJson({})",
  });
});

test("Can Set Custom Directory", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "custom-vtl-stack");

  const customDir = path.join(process.cwd(), "..", "cdk-appsync-transformer");

  new AppSyncTransformer(stack, "custom-vtl-transformer", {
    schemaPath: customVtlTestSchemaPath,
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
    customVtlTransformerRootDirectory: customDir,
  });
});

test.skip("Can set custom output path", () => {
  const mockApp = new App();
  const stack = new Stack(mockApp, "custom-vtl-stack");

  const appSyncTransformer = new AppSyncTransformer(stack, "custom-vtl-transformer", {
    schemaPath: customVtlTestSchemaPath,
    outputPath: "./customtest/appsync",
    authorizationConfig: apiKeyAuthorizationConfig,
    xrayEnabled: false,
  });

  const nestedTemplate = Template.fromStack(appSyncTransformer.nestedAppsyncStack);

  expect(appSyncTransformer.resolvers).toMatchObject({
    QuerylistThingCustom: {
      typeName: "Query",
      fieldName: "listThingCustom",
      requestMappingTemplate: "customtest/appsync/resolvers/Query.listThingCustom.req",
      responseMappingTemplate: "customtest/appsync/resolvers/Query.listThingCustom.res",
    },
  });

  nestedTemplate.hasResourceProperties("AWS::AppSync::Resolver", {
    FieldName: "listThingCustom",
    TypeName: "Query",
    DataSourceName: "NONE",
    Kind: "UNIT",
    RequestMappingTemplate: '{\n  "version": "2018-05-29"\n}',
    ResponseMappingTemplate: "$util.toJson({})",
  });
});
