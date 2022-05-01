# API Reference

**Classes**

| Name                                                              | Description                   |
| ----------------------------------------------------------------- | ----------------------------- |
| [AppSyncTransformer](#cdk-appsync-transformer-appsynctransformer) | AppSyncTransformer Construct. |

**Structs**

| Name                                                                                              | Description      |
| ------------------------------------------------------------------------------------------------- | ---------------- |
| [AppSyncTransformerProps](#cdk-appsync-transformer-appsynctransformerprops)                       | _No description_ |
| [CdkTransformerFunctionResolver](#cdk-appsync-transformer-cdktransformerfunctionresolver)         | _No description_ |
| [CdkTransformerGlobalSecondaryIndex](#cdk-appsync-transformer-cdktransformerglobalsecondaryindex) | _No description_ |
| [CdkTransformerHttpResolver](#cdk-appsync-transformer-cdktransformerhttpresolver)                 | _No description_ |
| [CdkTransformerLocalSecondaryIndex](#cdk-appsync-transformer-cdktransformerlocalsecondaryindex)   | _No description_ |
| [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)                         | _No description_ |
| [CdkTransformerTable](#cdk-appsync-transformer-cdktransformertable)                               | _No description_ |
| [CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)                         | _No description_ |
| [CdkTransformerTableTtl](#cdk-appsync-transformer-cdktransformertablettl)                         | _No description_ |
| [DynamoDBStreamProps](#cdk-appsync-transformer-dynamodbstreamprops)                               | _No description_ |
| [OverrideResolverProps](#cdk-appsync-transformer-overrideresolverprops)                           | _No description_ |
| [SchemaTransformerOutputs](#cdk-appsync-transformer-schematransformeroutputs)                     | _No description_ |

## class AppSyncTransformer 🔹 <a id="cdk-appsync-transformer-appsynctransformer"></a>

AppSyncTransformer Construct.

**Implements**: [IConstruct](#constructs-iconstruct), [IDependable](#constructs-idependable)
**Extends**: [Construct](#constructs-construct)

### Initializer

```ts
new AppSyncTransformer(scope: Construct, id: string, props: AppSyncTransformerProps)
```

- **scope** (<code>[Construct](#constructs-construct)</code>) _No description_
- **id** (<code>string</code>) _No description_
- **props** (<code>[AppSyncTransformerProps](#cdk-appsync-transformer-appsynctransformerprops)</code>) _No description_
  - **schemaPath** (<code>string</code>) Relative path where schema.graphql exists.
  - **apiName** (<code>string</code>) String value representing the api name. **_Default_**: `${id}-api`
  - **authorizationConfig** (<code>[AuthorizationConfig](#aws-cdk-aws-appsync-alpha-authorizationconfig)</code>) Optional. **_Default_**: API_KEY authorization config
  - **customVtlTransformerRootDirectory** (<code>string</code>) The root directory to use for finding custom resolvers. **_Default_**: process.cwd()
  - **dynamoDbStreamConfig** (<code>Map<string, [aws_dynamodb.StreamViewType](#aws-cdk-lib-aws-dynamodb-streamviewtype)></code>) A map of @model type names to stream view type e.g { Blog: StreamViewType.NEW_IMAGE }. **_Optional_**
  - **enableDynamoPointInTimeRecovery** (<code>boolean</code>) Whether to enable dynamo Point In Time Recovery. **_Default_**: false
  - **fieldLogLevel** (<code>[FieldLogLevel](#aws-cdk-aws-appsync-alpha-fieldloglevel)</code>) Optional. **_Default_**: FieldLogLevel.NONE
  - **nestedStackName** (<code>string</code>) Specify a custom nested stack name. **_Default_**: "appsync-nested-stack"
  - **outputPath** (<code>string</code>) Path where generated resolvers are output. **_Default_**: "./appsync"
  - **postCdkTransformers** (<code>Array<any></code>) Optional. **_Default_**: undefined
  - **preCdkTransformers** (<code>Array<any></code>) Optional. **_Default_**: undefined
  - **syncEnabled** (<code>boolean</code>) Whether to enable Amplify DataStore and Sync Tables. **_Default_**: false
  - **tableNames** (<code>Map<string, string></code>) A map of names to specify the generated dynamo table names instead of auto generated names. **_Default_**: undefined
  - **xrayEnabled** (<code>boolean</code>) Determines whether xray should be enabled on the AppSync API. **_Default_**: false

### Properties

| Name                     | Type                                                                                                                       | Description                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **appsyncAPI**🔹         | <code>[GraphqlApi](#aws-cdk-aws-appsync-alpha-graphqlapi)</code>                                                           | The cdk GraphqlApi construct.                                                                                                     |
| **functionResolvers**🔹  | <code>Map<string, Array<[CdkTransformerFunctionResolver](#cdk-appsync-transformer-cdktransformerfunctionresolver)>></code> | The Lambda Function resolvers designated by the function directive https://github.com/kcwinner/cdk-appsync-transformer#functions. |
| **httpResolvers**🔹      | <code>Map<string, Array<[CdkTransformerHttpResolver](#cdk-appsync-transformer-cdktransformerhttpresolver)>></code>         | <span></span>                                                                                                                     |
| **nestedAppsyncStack**🔹 | <code>[NestedStack](#aws-cdk-lib-nestedstack)</code>                                                                       | The NestedStack that contains the AppSync resources.                                                                              |
| **outputs**🔹            | <code>[SchemaTransformerOutputs](#cdk-appsync-transformer-schematransformeroutputs)</code>                                 | The outputs from the SchemaTransformer.                                                                                           |
| **resolvers**🔹          | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code>                        | The AppSync resolvers from the transformer minus any function resolvers.                                                          |
| **tableMap**🔹           | <code>Map<string, [aws_dynamodb.Table](#aws-cdk-lib-aws-dynamodb-table)></code>                                            | Map of cdk table keys to L2 Table e.g. { 'TaskTable': Table }.                                                                    |
| **tableNameMap**🔹       | <code>Map<string, string></code>                                                                                           | Map of cdk table tokens to table names.                                                                                           |

### Methods

#### addDynamoDBStream(props)🔹 <a id="cdk-appsync-transformer-appsynctransformer-adddynamodbstream"></a>

Adds a stream to the dynamodb table associated with the type.

```ts
addDynamoDBStream(props: DynamoDBStreamProps): string
```

- **props** (<code>[DynamoDBStreamProps](#cdk-appsync-transformer-dynamodbstreamprops)</code>) _No description_
  - **modelTypeName** (<code>string</code>) The @model type name from the graph schema e.g. Blog.
  - **streamViewType** (<code>[aws_dynamodb.StreamViewType](#aws-cdk-lib-aws-dynamodb-streamviewtype)</code>) _No description_

**Returns**:

- <code>string</code>

#### addLambdaDataSourceAndResolvers(functionName, id, lambdaFunction, options?)🔹 <a id="cdk-appsync-transformer-appsynctransformer-addlambdadatasourceandresolvers"></a>

Adds the function as a lambdaDataSource to the AppSync api Adds all of the functions resolvers to the AppSync api.

```ts
addLambdaDataSourceAndResolvers(functionName: string, id: string, lambdaFunction: IFunction, options?: DataSourceOptions): LambdaDataSource
```

- **functionName** (<code>string</code>) The function name specified in the.
- **id** (<code>string</code>) The id to give.
- **lambdaFunction** (<code>[aws_lambda.IFunction](#aws-cdk-lib-aws-lambda-ifunction)</code>) The lambda function to attach.
- **options** (<code>[DataSourceOptions](#aws-cdk-aws-appsync-alpha-datasourceoptions)</code>) _No description_
  - **description** (<code>string</code>) The description of the data source. **_Default_**: No description
  - **name** (<code>string</code>) The name of the data source, overrides the id given by cdk. **_Default_**: generated by cdk given the id

**Returns**:

- <code>[LambdaDataSource](#aws-cdk-aws-appsync-alpha-lambdadatasource)</code>

#### grantPrivate(grantee)🔹 <a id="cdk-appsync-transformer-appsynctransformer-grantprivate"></a>

Adds an IAM policy statement granting access to the private fields of the AppSync API.

Policy is based off of the @auth transformer
https://docs.amplify.aws/cli/graphql-transformer/auth

```ts
grantPrivate(grantee: IGrantable): Grant
```

- **grantee** (<code>[aws_iam.IGrantable](#aws-cdk-lib-aws-iam-igrantable)</code>) _No description_

**Returns**:

- <code>[aws_iam.Grant](#aws-cdk-lib-aws-iam-grant)</code>

#### grantPublic(grantee)🔹 <a id="cdk-appsync-transformer-appsynctransformer-grantpublic"></a>

Adds an IAM policy statement granting access to the public fields of the AppSync API.

Policy is based off of the @auth transformer
https://docs.amplify.aws/cli/graphql-transformer/auth

```ts
grantPublic(grantee: IGrantable): Grant
```

- **grantee** (<code>[aws_iam.IGrantable](#aws-cdk-lib-aws-iam-igrantable)</code>) The principal to grant access to.

**Returns**:

- <code>[aws_iam.Grant](#aws-cdk-lib-aws-iam-grant)</code>

#### overrideResolver(props)🔹 <a id="cdk-appsync-transformer-appsynctransformer-overrideresolver"></a>

Allows for overriding the generated request and response mapping templates.

```ts
overrideResolver(props: OverrideResolverProps): void
```

- **props** (<code>[OverrideResolverProps](#cdk-appsync-transformer-overrideresolverprops)</code>) _No description_
  - **fieldName** (<code>string</code>) The fieldname to override e.g. listThings, createStuff.
  - **typeName** (<code>string</code>) Example: Query, Mutation, Subscription For a GSI this might be Post, Comment, etc.
  - **requestMappingTemplateFile** (<code>string</code>) The full path to the request mapping template file. **_Optional_**
  - **responseMappingTemplateFile** (<code>string</code>) The full path to the resposne mapping template file. **_Optional_**

## struct AppSyncTransformerProps 🔹 <a id="cdk-appsync-transformer-appsynctransformerprops"></a>

| Name                                     | Type                                                                                              | Description                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **schemaPath**🔹                         | <code>string</code>                                                                               | Relative path where schema.graphql exists.                                                                               |
| **apiName**?🔹                           | <code>string</code>                                                                               | String value representing the api name.<br/>**_Default_**: `${id}-api`                                                   |
| **authorizationConfig**?🔹               | <code>[AuthorizationConfig](#aws-cdk-aws-appsync-alpha-authorizationconfig)</code>                | Optional.<br/>**_Default_**: API_KEY authorization config                                                                |
| **customVtlTransformerRootDirectory**?🔹 | <code>string</code>                                                                               | The root directory to use for finding custom resolvers.<br/>**_Default_**: process.cwd()                                 |
| **dynamoDbStreamConfig**?🔹              | <code>Map<string, [aws_dynamodb.StreamViewType](#aws-cdk-lib-aws-dynamodb-streamviewtype)></code> | A map of @model type names to stream view type e.g { Blog: StreamViewType.NEW_IMAGE }.<br/>**_Optional_**                |
| **enableDynamoPointInTimeRecovery**?🔹   | <code>boolean</code>                                                                              | Whether to enable dynamo Point In Time Recovery.<br/>**_Default_**: false                                                |
| **fieldLogLevel**?🔹                     | <code>[FieldLogLevel](#aws-cdk-aws-appsync-alpha-fieldloglevel)</code>                            | Optional.<br/>**_Default_**: FieldLogLevel.NONE                                                                          |
| **nestedStackName**?🔹                   | <code>string</code>                                                                               | Specify a custom nested stack name.<br/>**_Default_**: "appsync-nested-stack"                                            |
| **outputPath**?🔹                        | <code>string</code>                                                                               | Path where generated resolvers are output.<br/>**_Default_**: "./appsync"                                                |
| **postCdkTransformers**?🔹               | <code>Array<any></code>                                                                           | Optional.<br/>**_Default_**: undefined                                                                                   |
| **preCdkTransformers**?🔹                | <code>Array<any></code>                                                                           | Optional.<br/>**_Default_**: undefined                                                                                   |
| **syncEnabled**?🔹                       | <code>boolean</code>                                                                              | Whether to enable Amplify DataStore and Sync Tables.<br/>**_Default_**: false                                            |
| **tableNames**?🔹                        | <code>Map<string, string></code>                                                                  | A map of names to specify the generated dynamo table names instead of auto generated names.<br/>**_Default_**: undefined |
| **xrayEnabled**?🔹                       | <code>boolean</code>                                                                              | Determines whether xray should be enabled on the AppSync API.<br/>**_Default_**: false                                   |

## struct CdkTransformerFunctionResolver 🔹 <a id="cdk-appsync-transformer-cdktransformerfunctionresolver"></a>

| Name                                 | Type                | Description   |
| ------------------------------------ | ------------------- | ------------- |
| **defaultRequestMappingTemplate**🔹  | <code>string</code> | <span></span> |
| **defaultResponseMappingTemplate**🔹 | <code>string</code> | <span></span> |
| **fieldName**🔹                      | <code>string</code> | <span></span> |
| **typeName**🔹                       | <code>string</code> | <span></span> |

## struct CdkTransformerGlobalSecondaryIndex 🔹 <a id="cdk-appsync-transformer-cdktransformerglobalsecondaryindex"></a>

| Name               | Type                                                                                   | Description   |
| ------------------ | -------------------------------------------------------------------------------------- | ------------- |
| **indexName**🔹    | <code>string</code>                                                                    | <span></span> |
| **partitionKey**🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span> |
| **projection**🔹   | <code>any</code>                                                                       | <span></span> |
| **sortKey**🔹      | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span> |

## struct CdkTransformerHttpResolver 🔹 <a id="cdk-appsync-transformer-cdktransformerhttpresolver"></a>

| Name                                 | Type                | Description   |
| ------------------------------------ | ------------------- | ------------- |
| **defaultRequestMappingTemplate**🔹  | <code>string</code> | <span></span> |
| **defaultResponseMappingTemplate**🔹 | <code>string</code> | <span></span> |
| **fieldName**🔹                      | <code>string</code> | <span></span> |
| **httpConfig**🔹                     | <code>any</code>    | <span></span> |
| **typeName**🔹                       | <code>string</code> | <span></span> |

## struct CdkTransformerLocalSecondaryIndex 🔹 <a id="cdk-appsync-transformer-cdktransformerlocalsecondaryindex"></a>

| Name             | Type                                                                                   | Description   |
| ---------------- | -------------------------------------------------------------------------------------- | ------------- |
| **indexName**🔹  | <code>string</code>                                                                    | <span></span> |
| **projection**🔹 | <code>any</code>                                                                       | <span></span> |
| **sortKey**🔹    | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span> |

## struct CdkTransformerResolver 🔹 <a id="cdk-appsync-transformer-cdktransformerresolver"></a>

| Name            | Type                | Description   |
| --------------- | ------------------- | ------------- |
| **fieldName**🔹 | <code>string</code> | <span></span> |
| **typeName**🔹  | <code>string</code> | <span></span> |

## struct CdkTransformerTable 🔹 <a id="cdk-appsync-transformer-cdktransformertable"></a>

| Name                         | Type                                                                                                                  | Description    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------- |
| **globalSecondaryIndexes**🔹 | <code>Array<[CdkTransformerGlobalSecondaryIndex](#cdk-appsync-transformer-cdktransformerglobalsecondaryindex)></code> | <span></span>  |
| **gsiResolvers**🔹           | <code>Array<string></code>                                                                                            | <span></span>  |
| **localSecondaryIndexes**🔹  | <code>Array<[CdkTransformerLocalSecondaryIndex](#cdk-appsync-transformer-cdktransformerlocalsecondaryindex)></code>   | <span></span>  |
| **partitionKey**🔹           | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code>                                | <span></span>  |
| **resolvers**🔹              | <code>Array<string></code>                                                                                            | <span></span>  |
| **tableName**🔹              | <code>string</code>                                                                                                   | <span></span>  |
| **sortKey**?🔹               | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code>                                | **_Optional_** |
| **ttl**?🔹                   | <code>[CdkTransformerTableTtl](#cdk-appsync-transformer-cdktransformertablettl)</code>                                | **_Optional_** |

## struct CdkTransformerTableKey 🔹 <a id="cdk-appsync-transformer-cdktransformertablekey"></a>

| Name       | Type                | Description   |
| ---------- | ------------------- | ------------- |
| **name**🔹 | <code>string</code> | <span></span> |
| **type**🔹 | <code>string</code> | <span></span> |

## struct CdkTransformerTableTtl 🔹 <a id="cdk-appsync-transformer-cdktransformertablettl"></a>

| Name                | Type                 | Description   |
| ------------------- | -------------------- | ------------- |
| **attributeName**🔹 | <code>string</code>  | <span></span> |
| **enabled**🔹       | <code>boolean</code> | <span></span> |

## struct DynamoDBStreamProps 🔹 <a id="cdk-appsync-transformer-dynamodbstreamprops"></a>

| Name                 | Type                                                                                 | Description                                           |
| -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **modelTypeName**🔹  | <code>string</code>                                                                  | The @model type name from the graph schema e.g. Blog. |
| **streamViewType**🔹 | <code>[aws_dynamodb.StreamViewType](#aws-cdk-lib-aws-dynamodb-streamviewtype)</code> | <span></span>                                         |

## struct OverrideResolverProps 🔹 <a id="cdk-appsync-transformer-overrideresolverprops"></a>

| Name                               | Type                | Description                                                                        |
| ---------------------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| **fieldName**🔹                    | <code>string</code> | The fieldname to override e.g. listThings, createStuff.                            |
| **typeName**🔹                     | <code>string</code> | Example: Query, Mutation, Subscription For a GSI this might be Post, Comment, etc. |
| **requestMappingTemplateFile**?🔹  | <code>string</code> | The full path to the request mapping template file.<br/>**_Optional_**             |
| **responseMappingTemplateFile**?🔹 | <code>string</code> | The full path to the resposne mapping template file.<br/>**_Optional_**            |

## struct SchemaTransformerOutputs 🔹 <a id="cdk-appsync-transformer-schematransformeroutputs"></a>

| Name                     | Type                                                                                                                       | Description    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **cdkTables**?🔹         | <code>Map<string, [CdkTransformerTable](#cdk-appsync-transformer-cdktransformertable)></code>                              | **_Optional_** |
| **functionResolvers**?🔹 | <code>Map<string, Array<[CdkTransformerFunctionResolver](#cdk-appsync-transformer-cdktransformerfunctionresolver)>></code> | **_Optional_** |
| **httpResolvers**?🔹     | <code>Map<string, Array<[CdkTransformerHttpResolver](#cdk-appsync-transformer-cdktransformerhttpresolver)>></code>         | **_Optional_** |
| **mutations**?🔹         | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code>                        | **_Optional_** |
| **noneResolvers**?🔹     | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code>                        | **_Optional_** |
| **queries**?🔹           | <code>Map<string, string></code>                                                                                           | **_Optional_** |
| **subscriptions**?🔹     | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code>                        | **_Optional_** |
