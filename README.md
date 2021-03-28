# AppSync Transformer Construct for AWS CDK

![build](https://github.com/kcwinner/cdk-appsync-transformer/workflows/Build/badge.svg)
[![codecov](https://codecov.io/gh/kcwinner/cdk-appsync-transformer/branch/main/graph/badge.svg)](https://codecov.io/gh/kcwinner/cdk-appsync-transformer)
[![dependencies Status](https://david-dm.org/kcwinner/cdk-appsync-transformer/status.svg)](https://david-dm.org/kcwinner/cdk-appsync-transformer)
[![npm](https://img.shields.io/npm/dt/cdk-appsync-transformer)](https://www.npmjs.com/package/cdk-appsync-transformer)

[![npm version](https://badge.fury.io/js/cdk-appsync-transformer.svg)](https://badge.fury.io/js/cdk-appsync-transformer)
[![PyPI version](https://badge.fury.io/py/cdk-appsync-transformer.svg)](https://badge.fury.io/py/cdk-appsync-transformer)

## Notice

For CDK versions < 1.64.0 please use [aws-cdk-appsync-transformer](https://github.com/kcwinner/aws-cdk-appsync-transformer).

## Why This Package

In April 2020 I wrote a [blog post](https://www.trek10.com/blog/appsync-with-the-aws-cloud-development-kit) on using the AWS Cloud Development Kit with AppSync. I wrote my own transformer in order to emulate AWS Amplify's method of using GraphQL directives in order to template a lot of the Schema Definition Language.

This package is my attempt to convert all of that effort into a separate construct in order to clean up the process.

## How Do I Use It

### Example Usage

API With Default Values

```ts
import { AppSyncTransformer } from 'cdk-appsync-transformer';
...
new AppSyncTransformer(this, "my-cool-api", {
    schemaPath: 'schema.graphql'
});
```

schema.graphql

```graphql
type Customer
  @model
  @auth(
    rules: [
      { allow: groups, groups: ["Admins"] }
      { allow: private, provider: iam, operations: [read, update] }
    ]
  ) {
  id: ID!
  firstName: String!
  lastName: String!
  active: Boolean!
  address: String!
}

type Product
  @model
  @auth(
    rules: [
      { allow: groups, groups: ["Admins"] }
      { allow: public, provider: iam, operations: [read] }
    ]
  ) {
  id: ID!
  name: String!
  description: String!
  price: String!
  active: Boolean!
  added: AWSDateTime!
  orders: [Order] @connection
}

type Order @model @key(fields: ["id", "productID"]) {
  id: ID!
  productID: ID!
  total: String!
  ordered: AWSDateTime!
}
```

### [Supported Amplify Directives](https://docs.amplify.aws/cli/graphql-transformer/directives)

Tested:

- [@model](https://docs.amplify.aws/cli/graphql-transformer/directives#model)
- [@auth](https://docs.amplify.aws/cli/graphql-transformer/directives#auth)
- [@connection](https://docs.amplify.aws/cli/graphql-transformer/directives#connection)
- [@key](https://docs.amplify.aws/cli/graphql-transformer/directives#key)
- [@function](https://docs.amplify.aws/cli/graphql-transformer/directives#function)
  - These work differently here than they do in Amplify - see [Functions](#functions) below

Experimental:

- [@versioned](https://docs.amplify.aws/cli/graphql-transformer/directives#versioned)
- [@http](https://docs.amplify.aws/cli/graphql-transformer/directives#http)
- [@ttl](https://github.com/flogy/graphql-ttl-transformer)
  - Community directive transformer

Not Yet Supported:

- [@searchable](https://docs.amplify.aws/cli/graphql-transformer/directives#searchable)
- [@predictions](https://docs.amplify.aws/cli/graphql-transformer/directives#predictions)

### Custom Transformers & Directives

_This is an advanced feature_

It is possible to add pre/post custom transformers that extend the Amplify ITransformer. To see a simple example please look at [mapped-transformer.ts](./test/mappedTransformer/mapped-transformer.ts) in the tests section.

This allows you to modify the data either before or after the [cdk-transformer](./src/transformer/cdk-transformer.ts) is run.

_Limitation:_ Due to some limitations with `jsii` we are unable to export the ITransformer interface from `graphql-transformer-core` to ensure complete type safety. Instead, there is a validation method that will check for `name`, `directive` and `typeDefinitions` members in the transformers that are passed in.

```ts
import { PreTransformer, PostTransformer } from "./customTransformers";
new AppSyncTransformer(this, "my-cool-api", {
  schemaPath: "schema.graphql",
  preCdkTransformers: [new PreTransformer()],
  postCdkTransformers: [new PostTransformer()],
});
```

### Authentication

User Pool Authentication

```ts
const userPool = new UserPool(this, 'my-cool-user-pool', {
    ...
})
...
const userPoolClient = new UserPoolClient(this, `${id}-client`, {
    userPool: this.userPool,
    ...
})
...
new AppSyncTransformer(this, "my-cool-api", {
    schemaPath: 'schema.graphql',
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
```

#### IAM

Unauth Role: TODO

Auth Role: Unsupported. Authorized roles (Lambda Functions, EC2 roles, etc) are required to setup their own role permissions.

### Functions

#### Directive Example

```graphql
type Query {
  listUsers: UserConnection @function(name: "myFunction")
  getUser(id: ID!): User @function(name: "myFunction")
}
```

There are two ways to add functions as data sources (and their resolvers)

#### Construct Convenience Method

```ts
const myFunction = new Function(...);

// first argument is the name in the @function directive
appsyncTransformer.addLambdaDataSourceAndResolvers('myFunction', 'unique-id', myFunction, {
  name: 'lambdaDatasourceName'
})
```

`addLambdaDataSourceAndResolvers` does the same thing as the manual version below. However, if you want to customize mapping templates you will have to bypass this and set up the data source and resolvers yourself

#### Manually

Fields with the `@function` directive will be accessible via `appsyncTransformer.functionResolvers`. It will return a map like so:

```ts
{
  'user-function': [
    { typeName: 'Query', fieldName: 'listUsers' },
    { typeName: 'Query', fieldName: 'getUser' },
    { typeName: 'Mutation', fieldName: 'createUser' },
    { typeName: 'Mutation', fieldName: 'updateUser' }
  ]
}
```

You can grab your function resolvers via the map and assign them your own function(s). Example might be something like:

```ts
const userFunction = new Function(...);
const userFunctionDataSource = appsyncTransformer.appsyncAPI.addLambdaDataSource('some-id', userFunction);

const dataSourceMap = {
  'user-function': userFunctionDataSource
};

for (const [functionName, resolver] of Object.entries(appsyncTransformer.functionResolvers)) {
  const dataSource = dataSourceMap[functionName];
  new Resolver(this.nestedAppsyncStack, `${resolver.typeName}-${resolver.fieldName}-resolver`, {
    api: appsyncTransformer.appsyncAPI,
    typeName: resolver.typeName,
    fieldName: resolver.fieldName,
    dataSource: dataSource,
    requestMappingTemplate: resolver.defaultRequestMappingTemplate,
    responseMappingTemplate: resolver.defaultResponseMappingTemplate // This defaults to allow errors to return to the client instead of throwing
  });
}
```

### Table Name Map

Often you will need to access your table names in a lambda function or elsewhere. The cdk-appsync-transformer will return these values as a map of table names to cdk tokens. These tokens will be resolved at deploy time. They can be accessed via `appSyncTransformer.tableNameMap`.

```ts
{
  CustomerTable: '${Token[TOKEN.1300]}',
  ProductTable: '${Token[TOKEN.1346]}',
  OrderTable: '${Token[TOKEN.1392]}',
  BlogTable: '${Token[TOKEN.1442]}',
  PostTable: '${Token[TOKEN.1492]}',
  CommentTable: '${Token[TOKEN.1546]}',
  UserTable: '${Token[TOKEN.1596]}'
}
```

### Table Map

You may need to access your dynamo table L2 constructs. These can be accessed via `appSyncTransformer.tableMap`.

### DynamoDB Streams

There are two ways to enable DynamoDB streams for a table. The first version is probably most preferred. You pass in the `@model` type name and the StreamViewType as properties when creating the AppSyncTransformer. This will also allow you to access the `tableStreamArn` property of the L2 table construct from the `tableMap`.

```ts
const appSyncTransformer = new AppSyncTransformer(stack, 'test-transformer', {
  schemaPath: testSchemaPath,
  dynamoDbStreamConfig: {
    Order: StreamViewType.NEW_IMAGE,
    Blog: StreamViewType.NEW_AND_OLD_IMAGES
  }
});

const orderTable = appSyncTransformer.tableMap.OrderTable;
// Do something with the table stream arn - orderTable.tableStreamArn
```

A convenience method is also available. It returns the stream arn because the L2 Table construct does not seem to update with the value since we are updating the underlying CfnTable. Normally a Table construct must pass in the stream specification as a prop

```ts
const streamArn = appSyncTransformer.addDynamoDBStream({
  modelTypeName: 'Order',
  streamViewType: StreamViewType.NEW_IMAGE,
});

// Do something with the streamArn
```

### DataStore Support

1. Pass `syncEnabled: true` to the `AppSyncTransformerProps`
1. Generate necessary exports (see [Code Generation](#code-generation) below)

### Cfn Outputs

- `appsyncGraphQLEndpointOutput` - the appsync graphql endpoint

### Code Generation

I've written some helpers to generate code similarly to how AWS Amplify generates statements and types. You can find the code [here](https://github.com/kcwinner/advocacy/tree/master/cdk-amplify-appsync-helpers).

## Versioning

I will _attempt_ to align the major and minor version of this package with [AWS CDK], but always check the release descriptions for compatibility.

I currently support [![GitHub package.json dependency version (prod)](https://img.shields.io/github/package-json/dependency-version/kcwinner/cdk-appsync-transformer/@aws-cdk/core)](https://github.com/aws/aws-cdk)

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for details

## License

Distributed under [Apache License, Version 2.0](LICENSE)

## References

- [aws cdk](https://aws.amazon.com/cdk)
- [amplify-cli](https://github.com/aws-amplify/amplify-cli)
- [Amplify Directives](https://docs.amplify.aws/cli/graphql-transformer/directives)
