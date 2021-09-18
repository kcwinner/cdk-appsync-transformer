# API Reference

**Classes**

Name|Description
----|-----------
[AppSyncTransformer](#cdk-appsync-transformer-appsynctransformer)|AppSyncTransformer Construct.


**Structs**

Name|Description
----|-----------
[AppSyncTransformerProps](#cdk-appsync-transformer-appsynctransformerprops)|*No description*
[CdkTransformerFunctionResolver](#cdk-appsync-transformer-cdktransformerfunctionresolver)|*No description*
[CdkTransformerGlobalSecondaryIndex](#cdk-appsync-transformer-cdktransformerglobalsecondaryindex)|*No description*
[CdkTransformerHttpResolver](#cdk-appsync-transformer-cdktransformerhttpresolver)|*No description*
[CdkTransformerLocalSecondaryIndex](#cdk-appsync-transformer-cdktransformerlocalsecondaryindex)|*No description*
[CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)|*No description*
[CdkTransformerTable](#cdk-appsync-transformer-cdktransformertable)|*No description*
[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)|*No description*
[CdkTransformerTableTtl](#cdk-appsync-transformer-cdktransformertablettl)|*No description*
[DynamoDBStreamProps](#cdk-appsync-transformer-dynamodbstreamprops)|*No description*
[OverrideResolverProps](#cdk-appsync-transformer-overrideresolverprops)|*No description*
[SchemaTransformerOutputs](#cdk-appsync-transformer-schematransformeroutputs)|*No description*



## class AppSyncTransformer 🔹 <a id="cdk-appsync-transformer-appsynctransformer"></a>

AppSyncTransformer Construct.

__Implements__: [IConstruct](#constructs-iconstruct), [IConstruct](#aws-cdk-core-iconstruct), [IConstruct](#constructs-iconstruct), [IDependable](#aws-cdk-core-idependable)
__Extends__: [Construct](#aws-cdk-core-construct)

### Initializer




```ts
new AppSyncTransformer(scope: Construct, id: string, props: AppSyncTransformerProps)
```

* **scope** (<code>[Construct](#aws-cdk-core-construct)</code>)  *No description*
* **id** (<code>string</code>)  *No description*
* **props** (<code>[AppSyncTransformerProps](#cdk-appsync-transformer-appsynctransformerprops)</code>)  *No description*
  * **schemaPath** (<code>string</code>)  Relative path where schema.graphql exists. 
  * **apiName** (<code>string</code>)  String value representing the api name. __*Default*__: `${id}-api`
  * **authorizationConfig** (<code>[AuthorizationConfig](#aws-cdk-aws-appsync-authorizationconfig)</code>)  Optional. __*Default*__: API_KEY authorization config
  * **customVtlTransformerRootDirectory** (<code>string</code>)  The root directory to use for finding custom resolvers. __*Default*__: process.cwd()
  * **dynamoDbStreamConfig** (<code>Map<string, [StreamViewType](#aws-cdk-aws-dynamodb-streamviewtype)></code>)  A map of @model type names to stream view type e.g { Blog: StreamViewType.NEW_IMAGE }. __*Optional*__
  * **enableDynamoPointInTimeRecovery** (<code>boolean</code>)  Whether to enable dynamo Point In Time Recovery. __*Default*__: false
  * **fieldLogLevel** (<code>[FieldLogLevel](#aws-cdk-aws-appsync-fieldloglevel)</code>)  Optional. __*Default*__: FieldLogLevel.NONE
  * **nestedStackName** (<code>string</code>)  Specify a custom nested stack name. __*Default*__: "appsync-nested-stack"
  * **postCdkTransformers** (<code>Array<any></code>)  Optional. __*Default*__: undefined
  * **preCdkTransformers** (<code>Array<any></code>)  Optional. __*Default*__: undefined
  * **syncEnabled** (<code>boolean</code>)  Whether to enable Amplify DataStore and Sync Tables. __*Default*__: false
  * **tableNames** (<code>Map<string, string></code>)  A map of names to specify the generated dynamo table names instead of auto generated names. __*Default*__: undefined
  * **xrayEnabled** (<code>boolean</code>)  Determines whether xray should be enabled on the AppSync API. __*Default*__: false



### Properties


Name | Type | Description 
-----|------|-------------
**appsyncAPI**🔹 | <code>[GraphqlApi](#aws-cdk-aws-appsync-graphqlapi)</code> | The cdk GraphqlApi construct.
**functionResolvers**🔹 | <code>Map<string, Array<[CdkTransformerFunctionResolver](#cdk-appsync-transformer-cdktransformerfunctionresolver)>></code> | The Lambda Function resolvers designated by the function directive https://github.com/kcwinner/cdk-appsync-transformer#functions.
**httpResolvers**🔹 | <code>Map<string, Array<[CdkTransformerHttpResolver](#cdk-appsync-transformer-cdktransformerhttpresolver)>></code> | <span></span>
**nestedAppsyncStack**🔹 | <code>[NestedStack](#aws-cdk-core-nestedstack)</code> | The NestedStack that contains the AppSync resources.
**outputs**🔹 | <code>[SchemaTransformerOutputs](#cdk-appsync-transformer-schematransformeroutputs)</code> | The outputs from the SchemaTransformer.
**resolvers**🔹 | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code> | The AppSync resolvers from the transformer minus any function resolvers.
**tableMap**🔹 | <code>Map<string, [Table](#aws-cdk-aws-dynamodb-table)></code> | Map of cdk table keys to L2 Table e.g. { 'TaskTable': Table }.
**tableNameMap**🔹 | <code>Map<string, string></code> | Map of cdk table tokens to table names.

### Methods


#### addDynamoDBStream(props)🔹 <a id="cdk-appsync-transformer-appsynctransformer-adddynamodbstream"></a>

Adds a stream to the dynamodb table associated with the type.

```ts
addDynamoDBStream(props: DynamoDBStreamProps): string
```

* **props** (<code>[DynamoDBStreamProps](#cdk-appsync-transformer-dynamodbstreamprops)</code>)  *No description*
  * **modelTypeName** (<code>string</code>)  The @model type name from the graph schema e.g. Blog. 
  * **streamViewType** (<code>[StreamViewType](#aws-cdk-aws-dynamodb-streamviewtype)</code>)  *No description* 

__Returns__:
* <code>string</code>

#### addLambdaDataSourceAndResolvers(functionName, id, lambdaFunction, options?)🔹 <a id="cdk-appsync-transformer-appsynctransformer-addlambdadatasourceandresolvers"></a>

Adds the function as a lambdaDataSource to the AppSync api Adds all of the functions resolvers to the AppSync api.

```ts
addLambdaDataSourceAndResolvers(functionName: string, id: string, lambdaFunction: IFunction, options?: DataSourceOptions): LambdaDataSource
```

* **functionName** (<code>string</code>)  The function name specified in the.
* **id** (<code>string</code>)  The id to give.
* **lambdaFunction** (<code>[IFunction](#aws-cdk-aws-lambda-ifunction)</code>)  The lambda function to attach.
* **options** (<code>[DataSourceOptions](#aws-cdk-aws-appsync-datasourceoptions)</code>)  *No description*
  * **description** (<code>string</code>)  The description of the data source. __*Default*__: No description
  * **name** (<code>string</code>)  The name of the data source, overrides the id given by cdk. __*Default*__: generated by cdk given the id

__Returns__:
* <code>[LambdaDataSource](#aws-cdk-aws-appsync-lambdadatasource)</code>

#### grantPrivate(grantee)🔹 <a id="cdk-appsync-transformer-appsynctransformer-grantprivate"></a>

Adds an IAM policy statement granting access to the private fields of the AppSync API.

Policy is based off of the @auth transformer
https://docs.amplify.aws/cli/graphql-transformer/auth

```ts
grantPrivate(grantee: IGrantable): Grant
```

* **grantee** (<code>[IGrantable](#aws-cdk-aws-iam-igrantable)</code>)  *No description*

__Returns__:
* <code>[Grant](#aws-cdk-aws-iam-grant)</code>

#### grantPublic(grantee)🔹 <a id="cdk-appsync-transformer-appsynctransformer-grantpublic"></a>

Adds an IAM policy statement granting access to the public fields of the AppSync API.

Policy is based off of the @auth transformer
https://docs.amplify.aws/cli/graphql-transformer/auth

```ts
grantPublic(grantee: IGrantable): Grant
```

* **grantee** (<code>[IGrantable](#aws-cdk-aws-iam-igrantable)</code>)  The principal to grant access to.

__Returns__:
* <code>[Grant](#aws-cdk-aws-iam-grant)</code>

#### overrideResolver(props)🔹 <a id="cdk-appsync-transformer-appsynctransformer-overrideresolver"></a>

Allows for overriding the generated request and response mapping templates.

```ts
overrideResolver(props: OverrideResolverProps): void
```

* **props** (<code>[OverrideResolverProps](#cdk-appsync-transformer-overrideresolverprops)</code>)  *No description*
  * **fieldName** (<code>string</code>)  The fieldname to override e.g. listThings, createStuff. 
  * **typeName** (<code>string</code>)  Example: Query, Mutation, Subscription For a GSI this might be Post, Comment, etc. 
  * **requestMappingTemplateFile** (<code>string</code>)  The full path to the request mapping template file. __*Optional*__
  * **responseMappingTemplateFile** (<code>string</code>)  The full path to the resposne mapping template file. __*Optional*__






## struct AppSyncTransformerProps 🔹 <a id="cdk-appsync-transformer-appsynctransformerprops"></a>






Name | Type | Description 
-----|------|-------------
**schemaPath**🔹 | <code>string</code> | Relative path where schema.graphql exists.
**apiName**?🔹 | <code>string</code> | String value representing the api name.<br/>__*Default*__: `${id}-api`
**authorizationConfig**?🔹 | <code>[AuthorizationConfig](#aws-cdk-aws-appsync-authorizationconfig)</code> | Optional.<br/>__*Default*__: API_KEY authorization config
**customVtlTransformerRootDirectory**?🔹 | <code>string</code> | The root directory to use for finding custom resolvers.<br/>__*Default*__: process.cwd()
**dynamoDbStreamConfig**?🔹 | <code>Map<string, [StreamViewType](#aws-cdk-aws-dynamodb-streamviewtype)></code> | A map of @model type names to stream view type e.g { Blog: StreamViewType.NEW_IMAGE }.<br/>__*Optional*__
**enableDynamoPointInTimeRecovery**?🔹 | <code>boolean</code> | Whether to enable dynamo Point In Time Recovery.<br/>__*Default*__: false
**fieldLogLevel**?🔹 | <code>[FieldLogLevel](#aws-cdk-aws-appsync-fieldloglevel)</code> | Optional.<br/>__*Default*__: FieldLogLevel.NONE
**nestedStackName**?🔹 | <code>string</code> | Specify a custom nested stack name.<br/>__*Default*__: "appsync-nested-stack"
**postCdkTransformers**?🔹 | <code>Array<any></code> | Optional.<br/>__*Default*__: undefined
**preCdkTransformers**?🔹 | <code>Array<any></code> | Optional.<br/>__*Default*__: undefined
**syncEnabled**?🔹 | <code>boolean</code> | Whether to enable Amplify DataStore and Sync Tables.<br/>__*Default*__: false
**tableNames**?🔹 | <code>Map<string, string></code> | A map of names to specify the generated dynamo table names instead of auto generated names.<br/>__*Default*__: undefined
**xrayEnabled**?🔹 | <code>boolean</code> | Determines whether xray should be enabled on the AppSync API.<br/>__*Default*__: false



## struct CdkTransformerFunctionResolver 🔹 <a id="cdk-appsync-transformer-cdktransformerfunctionresolver"></a>






Name | Type | Description 
-----|------|-------------
**defaultRequestMappingTemplate**🔹 | <code>string</code> | <span></span>
**defaultResponseMappingTemplate**🔹 | <code>string</code> | <span></span>
**fieldName**🔹 | <code>string</code> | <span></span>
**typeName**🔹 | <code>string</code> | <span></span>



## struct CdkTransformerGlobalSecondaryIndex 🔹 <a id="cdk-appsync-transformer-cdktransformerglobalsecondaryindex"></a>






Name | Type | Description 
-----|------|-------------
**indexName**🔹 | <code>string</code> | <span></span>
**partitionKey**🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span>
**projection**🔹 | <code>any</code> | <span></span>
**sortKey**🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span>



## struct CdkTransformerHttpResolver 🔹 <a id="cdk-appsync-transformer-cdktransformerhttpresolver"></a>






Name | Type | Description 
-----|------|-------------
**defaultRequestMappingTemplate**🔹 | <code>string</code> | <span></span>
**defaultResponseMappingTemplate**🔹 | <code>string</code> | <span></span>
**fieldName**🔹 | <code>string</code> | <span></span>
**httpConfig**🔹 | <code>any</code> | <span></span>
**typeName**🔹 | <code>string</code> | <span></span>



## struct CdkTransformerLocalSecondaryIndex 🔹 <a id="cdk-appsync-transformer-cdktransformerlocalsecondaryindex"></a>






Name | Type | Description 
-----|------|-------------
**indexName**🔹 | <code>string</code> | <span></span>
**projection**🔹 | <code>any</code> | <span></span>
**sortKey**🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span>



## struct CdkTransformerResolver 🔹 <a id="cdk-appsync-transformer-cdktransformerresolver"></a>






Name | Type | Description 
-----|------|-------------
**fieldName**🔹 | <code>string</code> | <span></span>
**typeName**🔹 | <code>string</code> | <span></span>



## struct CdkTransformerTable 🔹 <a id="cdk-appsync-transformer-cdktransformertable"></a>






Name | Type | Description 
-----|------|-------------
**globalSecondaryIndexes**🔹 | <code>Array<[CdkTransformerGlobalSecondaryIndex](#cdk-appsync-transformer-cdktransformerglobalsecondaryindex)></code> | <span></span>
**gsiResolvers**🔹 | <code>Array<string></code> | <span></span>
**localSecondaryIndexes**🔹 | <code>Array<[CdkTransformerLocalSecondaryIndex](#cdk-appsync-transformer-cdktransformerlocalsecondaryindex)></code> | <span></span>
**partitionKey**🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span>
**resolvers**🔹 | <code>Array<string></code> | <span></span>
**tableName**🔹 | <code>string</code> | <span></span>
**sortKey**?🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | __*Optional*__
**ttl**?🔹 | <code>[CdkTransformerTableTtl](#cdk-appsync-transformer-cdktransformertablettl)</code> | __*Optional*__



## struct CdkTransformerTableKey 🔹 <a id="cdk-appsync-transformer-cdktransformertablekey"></a>






Name | Type | Description 
-----|------|-------------
**name**🔹 | <code>string</code> | <span></span>
**type**🔹 | <code>string</code> | <span></span>



## struct CdkTransformerTableTtl 🔹 <a id="cdk-appsync-transformer-cdktransformertablettl"></a>






Name | Type | Description 
-----|------|-------------
**attributeName**🔹 | <code>string</code> | <span></span>
**enabled**🔹 | <code>boolean</code> | <span></span>



## struct DynamoDBStreamProps 🔹 <a id="cdk-appsync-transformer-dynamodbstreamprops"></a>






Name | Type | Description 
-----|------|-------------
**modelTypeName**🔹 | <code>string</code> | The @model type name from the graph schema e.g. Blog.
**streamViewType**🔹 | <code>[StreamViewType](#aws-cdk-aws-dynamodb-streamviewtype)</code> | <span></span>



## struct OverrideResolverProps 🔹 <a id="cdk-appsync-transformer-overrideresolverprops"></a>






Name | Type | Description 
-----|------|-------------
**fieldName**🔹 | <code>string</code> | The fieldname to override e.g. listThings, createStuff.
**typeName**🔹 | <code>string</code> | Example: Query, Mutation, Subscription For a GSI this might be Post, Comment, etc.
**requestMappingTemplateFile**?🔹 | <code>string</code> | The full path to the request mapping template file.<br/>__*Optional*__
**responseMappingTemplateFile**?🔹 | <code>string</code> | The full path to the resposne mapping template file.<br/>__*Optional*__



## struct SchemaTransformerOutputs 🔹 <a id="cdk-appsync-transformer-schematransformeroutputs"></a>






Name | Type | Description 
-----|------|-------------
**cdkTables**?🔹 | <code>Map<string, [CdkTransformerTable](#cdk-appsync-transformer-cdktransformertable)></code> | __*Optional*__
**functionResolvers**?🔹 | <code>Map<string, Array<[CdkTransformerFunctionResolver](#cdk-appsync-transformer-cdktransformerfunctionresolver)>></code> | __*Optional*__
**httpResolvers**?🔹 | <code>Map<string, Array<[CdkTransformerHttpResolver](#cdk-appsync-transformer-cdktransformerhttpresolver)>></code> | __*Optional*__
**mutations**?🔹 | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code> | __*Optional*__
**noneResolvers**?🔹 | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code> | __*Optional*__
**queries**?🔹 | <code>Map<string, string></code> | __*Optional*__
**subscriptions**?🔹 | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code> | __*Optional*__



