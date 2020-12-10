# API Reference

**Classes**

Name|Description
----|-----------
[AppSyncTransformer](#cdk-appsync-transformer-appsynctransformer)|AppSyncTransformer Construct.


**Structs**

Name|Description
----|-----------
[AppSyncTransformerProps](#cdk-appsync-transformer-appsynctransformerprops)|Properties for AppSyncTransformer Construct.
[CdkTransformerFunctionResolver](#cdk-appsync-transformer-cdktransformerfunctionresolver)|*No description*
[CdkTransformerGlobalSecondaryIndex](#cdk-appsync-transformer-cdktransformerglobalsecondaryindex)|*No description*
[CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)|*No description*
[CdkTransformerTable](#cdk-appsync-transformer-cdktransformertable)|*No description*
[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)|*No description*
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
  * **schemaPath** (<code>string</code>)  Required. 
  * **apiName** (<code>string</code>)  Optional. __*Default*__: `${id}-api`
  * **authorizationConfig** (<code>[AuthorizationConfig](#aws-cdk-aws-appsync-authorizationconfig)</code>)  Optional. __*Default*__: API_KEY authorization config
  * **fieldLogLevel** (<code>[FieldLogLevel](#aws-cdk-aws-appsync-fieldloglevel)</code>)  Optional. __*Default*__: FieldLogLevel.NONE
  * **syncEnabled** (<code>boolean</code>)  Optional. __*Default*__: false



### Properties


Name | Type | Description 
-----|------|-------------
**appsyncAPI**🔹 | <code>[GraphqlApi](#aws-cdk-aws-appsync-graphqlapi)</code> | The cdk GraphqlApi construct.
**functionResolvers**🔹 | <code>Map<string, Array<[CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)>></code> | The Lambda Function resolvers designated by the function directive https://github.com/kcwinner/cdk-appsync-transformer#functions.
**nestedAppsyncStack**🔹 | <code>[NestedStack](#aws-cdk-core-nestedstack)</code> | The NestedStack that contains the AppSync resources.
**outputs**🔹 | <code>[SchemaTransformerOutputs](#cdk-appsync-transformer-schematransformeroutputs)</code> | The outputs from the SchemaTransformer.
**resolvers**🔹 | <code>any</code> | The AppSync resolvers from the transformer minus any function resolvers.
**tableNameMap**🔹 | <code>Map<string, any></code> | Map of cdk table tokens to table names.



## struct AppSyncTransformerProps 🔹 <a id="cdk-appsync-transformer-appsynctransformerprops"></a>


Properties for AppSyncTransformer Construct.



Name | Type | Description 
-----|------|-------------
**schemaPath**🔹 | <code>string</code> | Required.
**apiName**?🔹 | <code>string</code> | Optional.<br/>__*Default*__: `${id}-api`
**authorizationConfig**?🔹 | <code>[AuthorizationConfig](#aws-cdk-aws-appsync-authorizationconfig)</code> | Optional.<br/>__*Default*__: API_KEY authorization config
**fieldLogLevel**?🔹 | <code>[FieldLogLevel](#aws-cdk-aws-appsync-fieldloglevel)</code> | Optional.<br/>__*Default*__: FieldLogLevel.NONE
**syncEnabled**?🔹 | <code>boolean</code> | Optional.<br/>__*Default*__: false



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
**partitionKey**🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | <span></span>
**resolvers**🔹 | <code>Array<string></code> | <span></span>
**tableName**🔹 | <code>string</code> | <span></span>
**sortKey**?🔹 | <code>[CdkTransformerTableKey](#cdk-appsync-transformer-cdktransformertablekey)</code> | __*Optional*__
**ttl**?🔹 | <code>any</code> | __*Optional*__



## struct CdkTransformerTableKey 🔹 <a id="cdk-appsync-transformer-cdktransformertablekey"></a>






Name | Type | Description 
-----|------|-------------
**name**🔹 | <code>string</code> | <span></span>
**type**🔹 | <code>string</code> | <span></span>



## struct SchemaTransformerOutputs 🔹 <a id="cdk-appsync-transformer-schematransformeroutputs"></a>






Name | Type | Description 
-----|------|-------------
**cdkTables**?🔹 | <code>Map<string, [CdkTransformerTable](#cdk-appsync-transformer-cdktransformertable)></code> | __*Optional*__
**functionResolvers**?🔹 | <code>Map<string, Array<[CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)>></code> | __*Optional*__
**mutations**?🔹 | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code> | __*Optional*__
**noneResolvers**?🔹 | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code> | __*Optional*__
**queries**?🔹 | <code>Map<string, string></code> | __*Optional*__
**subscriptions**?🔹 | <code>Map<string, [CdkTransformerResolver](#cdk-appsync-transformer-cdktransformerresolver)></code> | __*Optional*__



