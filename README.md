# AppSync Transformer Construct for AWS CDK

![build](https://github.com/kcwinner/cdk-appsync-transformer/workflows/build/badge.svg)
[![codecov](https://codecov.io/gh/kcwinner/cdk-appsync-transformer/branch/main/graph/badge.svg)](https://codecov.io/gh/kcwinner/cdk-appsync-transformer)
[![dependencies Status](https://david-dm.org/kcwinner/cdk-appsync-transformer/status.svg)](https://david-dm.org/kcwinner/cdk-appsync-transformer)
[![npm](https://img.shields.io/npm/dt/cdk-appsync-transformer)](https://www.npmjs.com/package/cdk-appsync-transformer)

[![npm version](https://badge.fury.io/js/cdk-appsync-transformer.svg)](https://badge.fury.io/js/cdk-appsync-transformer)
[![PyPI version](https://badge.fury.io/py/cdk-appsync-transformer.svg)](https://badge.fury.io/py/cdk-appsync-transformer)

## Notice

This is a work in progress and is being migrated from [aws-cdk-appsync-transformer](https://github.com/kcwinner/aws-cdk-appsync-transformer) to follow community naming guidelines and to utilize [projen](https://github.com/eladb/projen). For CDK versions < 1.64.0 please use that version.

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
type Customer @model
    @auth(rules: [
        { allow: groups, groups: ["Admins"] },
        { allow: private, provider: iam, operations: [read, update] }
    ]) {
        id: ID!
        firstName: String!
        lastName: String!
        active: Boolean!
        address: String!
}

type Product @model
    @auth(rules: [
        { allow: groups, groups: ["Admins"] },
        { allow: public, provider: iam, operations: [read] }
    ]) {
        id: ID!
        name: String!
        description: String!
        price: String!
        active: Boolean!
        added: AWSDateTime!
        orders: [Order] @connection
}

type Order @model
    @key(fields: ["id", "productID"]) {
        id: ID!
        productID: ID!
        total: String!
        ordered: AWSDateTime!
}
```

### [Supported Amplify Directives](https://docs.amplify.aws/cli/graphql-transformer/directives)

Tested:
* [@model](https://docs.amplify.aws/cli/graphql-transformer/directives#model)
* [@auth](https://docs.amplify.aws/cli/graphql-transformer/directives#auth)
* [@connection](https://docs.amplify.aws/cli/graphql-transformer/directives#connection)

Experimental:
* [@key](https://docs.amplify.aws/cli/graphql-transformer/directives#key)
* [@versioned](https://docs.amplify.aws/cli/graphql-transformer/directives#versioned)
* [@function](https://docs.amplify.aws/cli/graphql-transformer/directives#function)
  * These work differently here than they do in Amplify - see [Functions](#functions) below

Not Yet Supported:
* [@searchable](https://docs.amplify.aws/cli/graphql-transformer/directives#searchable)
* [@predictions](https://docs.amplify.aws/cli/graphql-transformer/directives#predictions)
* [@http](https://docs.amplify.aws/cli/graphql-transformer/directives#http)

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

Auth Role: Unsupported (for now?). Authorized roles (Lambda Functions, EC2 roles, etc) are required to setup their own role permissions.

### Functions

Fields with the `@function` directive will be accessible via `api.outputs.FUNCTION_RESOLVERS`. It will return an array like below.Currently these are not named and do not specify a region. There are improvements that can be made here but this simple way has worked for me so I've implemented it first. Typically I send all `@function` requests to one Lambda Function and have it route as necessary.

```js
[
  { typeName: 'Query', fieldName: 'listUsers' },
  { typeName: 'Query', fieldName: 'getUser' },
  { typeName: 'Mutation', fieldName: 'createUser' },
  { typeName: 'Mutation', fieldName: 'updateUser' }
]
```

### DataStore Support

1. Pass `syncEnabled: true` to the `AppSyncTransformerProps`
1. Generate necessary exports (see [Code Generation](#code-generation) below)

### Code Generation

I've written some helpers to generate code similarly to how AWS Amplify generates statements and types. You can find the code [here](https://github.com/kcwinner/advocacy/tree/master/cdk-amplify-appsync-helpers).

## Versioning

I will *attempt* to align the major and minor version of this package with [AWS CDK], but always check the release descriptions for compatibility.

I currently support [![GitHub package.json dependency version (prod)](https://img.shields.io/github/package-json/dependency-version/kcwinner/cdk-appsync-transformer/@aws-cdk/core)](https://github.com/aws/aws-cdk)

## Limitations

* 

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md) for details

## License

Distributed under [Apache License, Version 2.0](LICENSE)

[aws cdk]: https://aws.amazon.com/cdk