import { AppSync, Fn, Refs, IntrinsicFunction } from 'cloudform-types';

import { InputObjectTypeDefinitionNode } from 'graphql';
import {
  DynamoDBMappingTemplate,
  printBlock,
  str,
  print,
  ref,
  obj,
  set,
  nul,
  ifElse,
  compoundExpression,
  qref,
  bool,
  equals,
  iff,
  raw,
  comment,
  forEach,
  and,
  RESOLVER_VERSION_ID,
} from 'graphql-mapping-template';

import {
  ResourceConstants,
  plurality,
  graphqlName,
  toUpper,
  ModelResourceIDs,
  getBaseType,
} from 'graphql-transformer-common';

import { SyncConfig, SyncUtils } from 'graphql-transformer-core';
import { plural } from 'pluralize';

type MutationResolverInput = {
  type: string;
  syncConfig?: SyncConfig;
  nameOverride?: string;
  mutationTypeName?: string;
  timestamps?: {
    createdAtField?: string;
    updatedAtField?: string;
  };
};

export class ResourceFactory {
  private dynamoDBTableName(typeName: string): IntrinsicFunction {
    return Fn.If(
      ResourceConstants.CONDITIONS.HasEnvironmentParameter,
      Fn.Join('-', [
        typeName,
        Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
        Fn.Ref(ResourceConstants.PARAMETERS.Env),
      ]),
      Fn.Join('-', [typeName, Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId')]),
    );
  }

  /**
   * Given the name of a data source and optional logical id return a CF
   * spec for a data source pointing to the dynamodb table.
   */
  public makeDynamoDBDataSource(tableId: string, iamRoleLogicalID: string, typeName: string, isSyncEnabled: boolean = false) {
    return new AppSync.DataSource({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      Name: tableId,
      Type: 'AMAZON_DYNAMODB',
      ServiceRoleArn: Fn.GetAtt(iamRoleLogicalID, 'Arn'),
      DynamoDBConfig: {
        AwsRegion: Refs.Region,
        TableName: this.dynamoDBTableName(typeName),
        ...(isSyncEnabled && {
          DeltaSyncConfig: SyncUtils.syncDataSourceConfig(),
          Versioned: true,
        }),
      },
    }).dependsOn([iamRoleLogicalID]);
  }

  /**
   * Create a resolver that creates an item in DynamoDB.
   * @param type
   */
  public makeCreateResolver({ type, nameOverride, syncConfig, mutationTypeName = 'Mutation' }: MutationResolverInput) {
    const fieldName = nameOverride ? nameOverride : graphqlName('create' + toUpper(type));
    const isSyncEnabled = syncConfig ? true : false;
    return new AppSync.Resolver({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      DataSourceName: Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
      FieldName: fieldName,
      TypeName: mutationTypeName,
      RequestMappingTemplate: printBlock('Prepare DynamoDB PutItem Request')(
        compoundExpression([
          qref(`$context.args.input.put("__typename", "${type}")`),
          set(
            ref('condition'),
            obj({
              expression: str('attribute_not_exists(#id)'),
              expressionNames: obj({
                '#id': str('id'),
              }),
            }),
          ),
          iff(
            ref('context.args.condition'),
            compoundExpression([
              set(ref('condition.expressionValues'), obj({})),
              set(
                ref('conditionFilterExpressions'),
                raw('$util.parseJson($util.transform.toDynamoDBConditionExpression($context.args.condition))'),
              ),
              // tslint:disable-next-line
              qref('$condition.put("expression", "($condition.expression) AND $conditionFilterExpressions.expression")'),
              qref('$condition.expressionNames.putAll($conditionFilterExpressions.expressionNames)'),
              qref('$condition.expressionValues.putAll($conditionFilterExpressions.expressionValues)'),
            ]),
          ),
          iff(
            and([ref('condition.expressionValues'), raw('$condition.expressionValues.size() == 0')]),
            set(
              ref('condition'),
              obj({
                expression: ref('condition.expression'),
                expressionNames: ref('condition.expressionNames'),
              }),
            ),
          ),
          DynamoDBMappingTemplate.putItem({
            key: ifElse(
              ref(ResourceConstants.SNIPPETS.ModelObjectKey),
              raw(`$util.toJson(\$${ResourceConstants.SNIPPETS.ModelObjectKey})`),
              obj({
                id: raw('$util.dynamodb.toDynamoDBJson($ctx.args.input.id)'),
              }),
              true,
            ),
            attributeValues: ref('util.dynamodb.toMapValuesJson($context.args.input)'),
            condition: ref('util.toJson($condition)'),
          }),
        ]),
      ),
      ResponseMappingTemplate: print(DynamoDBMappingTemplate.dynamoDBResponse(isSyncEnabled)),
      ...(syncConfig && { SyncConfig: SyncUtils.syncResolverConfig(syncConfig) }),
    });
  }

  public initalizeDefaultInputForCreateMutation(input: InputObjectTypeDefinitionNode, timestamps: any): string {
    const hasDefaultIdField = input.fields?.find(field => field.name.value === 'id' && ['ID', 'String'].includes(getBaseType(field.type)));
    return printBlock('Set default values')(
      compoundExpression([
        ...(hasDefaultIdField ? [qref('$context.args.input.put("id", $util.defaultIfNull($ctx.args.input.id, $util.autoId()))')] : []),
        ...(timestamps && (timestamps.createdAtField || timestamps.updatedAtField)
          ? [set(ref('createdAt'), ref('util.time.nowISO8601()'))]
          : []),
        ...(timestamps && timestamps.createdAtField
          ? [
            comment('Automatically set the createdAt timestamp.'),
            qref(
              `$context.args.input.put("${timestamps.createdAtField}", $util.defaultIfNull($ctx.args.input.${timestamps.createdAtField}, $createdAt))`,
            ),
          ]
          : []),
        ...(timestamps && timestamps.updatedAtField
          ? [
            comment('Automatically set the updatedAt timestamp.'),
            qref(
              `$context.args.input.put("${timestamps.updatedAtField}", $util.defaultIfNull($ctx.args.input.${timestamps.updatedAtField}, $createdAt))`,
            ),
          ]
          : []),
      ]),
    );
  }

  public makeUpdateResolver({ type, nameOverride, syncConfig, mutationTypeName = 'Mutation', timestamps }: MutationResolverInput) {
    const fieldName = nameOverride ? nameOverride : graphqlName('update' + toUpper(type));
    const isSyncEnabled = syncConfig ? true : false;
    return new AppSync.Resolver({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      DataSourceName: Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
      FieldName: fieldName,
      TypeName: mutationTypeName,
      RequestMappingTemplate: print(
        compoundExpression([
          ifElse(
            raw(`$${ResourceConstants.SNIPPETS.AuthCondition} && $${ResourceConstants.SNIPPETS.AuthCondition}.expression != ""`),
            compoundExpression([
              set(ref('condition'), ref(ResourceConstants.SNIPPETS.AuthCondition)),
              ifElse(
                ref(ResourceConstants.SNIPPETS.ModelObjectKey),
                forEach(ref('entry'), ref(`${ResourceConstants.SNIPPETS.ModelObjectKey}.entrySet()`), [
                  qref('$condition.put("expression", "$condition.expression AND attribute_exists(#keyCondition$velocityCount)")'),
                  qref('$condition.expressionNames.put("#keyCondition$velocityCount", "$entry.key")'),
                ]),
                compoundExpression([
                  qref('$condition.put("expression", "$condition.expression AND attribute_exists(#id)")'),
                  qref('$condition.expressionNames.put("#id", "id")'),
                ]),
              ),
            ]),
            ifElse(
              ref(ResourceConstants.SNIPPETS.ModelObjectKey),
              compoundExpression([
                set(
                  ref('condition'),
                  obj({
                    expression: str(''),
                    expressionNames: obj({}),
                    expressionValues: obj({}),
                  }),
                ),
                forEach(ref('entry'), ref(`${ResourceConstants.SNIPPETS.ModelObjectKey}.entrySet()`), [
                  ifElse(
                    raw('$velocityCount == 1'),
                    qref('$condition.put("expression", "attribute_exists(#keyCondition$velocityCount)")'),
                    qref('$condition.put(\
"expression", "$condition.expression AND attribute_exists(#keyCondition$velocityCount)")'),
                  ),
                  qref('$condition.expressionNames.put("#keyCondition$velocityCount", "$entry.key")'),
                ]),
              ]),
              set(
                ref('condition'),
                obj({
                  expression: str('attribute_exists(#id)'),
                  expressionNames: obj({
                    '#id': str('id'),
                  }),
                  expressionValues: obj({}),
                }),
              ),
            ),
          ),
          ...(timestamps && timestamps.updatedAtField
            ? [
              comment('Automatically set the updatedAt timestamp.'),
              qref(
                `$context.args.input.put("${timestamps.updatedAtField}", $util.defaultIfNull($ctx.args.input.${timestamps.updatedAtField}, $util.time.nowISO8601()))`,
              ),
            ]
            : []),
          qref(`$context.args.input.put("__typename", "${type}")`),
          comment('Update condition if type is @versioned'),
          iff(
            ref(ResourceConstants.SNIPPETS.VersionedCondition),
            compoundExpression([
              // tslint:disable-next-line
              qref(
                `$condition.put("expression", "($condition.expression) AND $${ResourceConstants.SNIPPETS.VersionedCondition}.expression")`,
              ),
              qref(`$condition.expressionNames.putAll($${ResourceConstants.SNIPPETS.VersionedCondition}.expressionNames)`),
              qref(`$condition.expressionValues.putAll($${ResourceConstants.SNIPPETS.VersionedCondition}.expressionValues)`),
            ]),
          ),
          iff(
            ref('context.args.condition'),
            compoundExpression([
              set(
                ref('conditionFilterExpressions'),
                raw('$util.parseJson($util.transform.toDynamoDBConditionExpression($context.args.condition))'),
              ),
              // tslint:disable-next-line
              qref('$condition.put("expression", "($condition.expression) AND $conditionFilterExpressions.expression")'),
              qref('$condition.expressionNames.putAll($conditionFilterExpressions.expressionNames)'),
              qref('$condition.expressionValues.putAll($conditionFilterExpressions.expressionValues)'),
            ]),
          ),
          iff(
            and([ref('condition.expressionValues'), raw('$condition.expressionValues.size() == 0')]),
            set(
              ref('condition'),
              obj({
                expression: ref('condition.expression'),
                expressionNames: ref('condition.expressionNames'),
              }),
            ),
          ),
          DynamoDBMappingTemplate.updateItem({
            key: ifElse(
              ref(ResourceConstants.SNIPPETS.ModelObjectKey),
              raw(`$util.toJson(\$${ResourceConstants.SNIPPETS.ModelObjectKey})`),
              obj({
                id: obj({ S: ref('util.toJson($context.args.input.id)') }),
              }),
              true,
            ),
            condition: ref('util.toJson($condition)'),
            objectKeyVariable: ResourceConstants.SNIPPETS.ModelObjectKey,
            nameOverrideMap: ResourceConstants.SNIPPETS.DynamoDBNameOverrideMap,
            isSyncEnabled,
          }),
        ]),
      ),
      ResponseMappingTemplate: print(DynamoDBMappingTemplate.dynamoDBResponse(isSyncEnabled)),
      ...(syncConfig && { SyncConfig: SyncUtils.syncResolverConfig(syncConfig) }),
    });
  }

  /**
   * Create a resolver that creates an item in DynamoDB.
   * @param type
   */
  public makeGetResolver(type: string, nameOverride?: string, isSyncEnabled: boolean = false, queryTypeName: string = 'Query') {
    const fieldName = nameOverride ? nameOverride : graphqlName('get' + toUpper(type));
    return new AppSync.Resolver({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      DataSourceName: Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
      FieldName: fieldName,
      TypeName: queryTypeName,
      RequestMappingTemplate: print(
        DynamoDBMappingTemplate.getItem({
          key: ifElse(
            ref(ResourceConstants.SNIPPETS.ModelObjectKey),
            raw(`$util.toJson(\$${ResourceConstants.SNIPPETS.ModelObjectKey})`),
            obj({
              id: ref('util.dynamodb.toDynamoDBJson($ctx.args.id)'),
            }),
            true,
          ),
          isSyncEnabled,
        }),
      ),
      ResponseMappingTemplate: print(DynamoDBMappingTemplate.dynamoDBResponse(isSyncEnabled)),
    });
  }

  /**
   * Create a resolver that syncs local storage with cloud storage
   * @param type
   */
  public makeSyncResolver(type: string, queryTypeName: string = 'Query') {
    const fieldName = graphqlName('sync' + toUpper(plural(type)));
    return new AppSync.Resolver({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      DataSourceName: Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
      FieldName: fieldName,
      TypeName: queryTypeName,
      RequestMappingTemplate: print(
        DynamoDBMappingTemplate.syncItem({
          filter: ifElse(ref('context.args.filter'), ref('util.transform.toDynamoDBFilterExpression($ctx.args.filter)'), nul()),
          limit: ref(`util.defaultIfNull($ctx.args.limit, ${ResourceConstants.DEFAULT_SYNC_QUERY_PAGE_LIMIT})`),
          lastSync: ref('util.toJson($util.defaultIfNull($ctx.args.lastSync, null))'),
          nextToken: ref('util.toJson($util.defaultIfNull($ctx.args.nextToken, null))'),
        }),
      ),
      ResponseMappingTemplate: print(DynamoDBMappingTemplate.dynamoDBResponse(true)),
    });
  }

  /**
   * Create a resolver that queries an item in DynamoDB.
   * @param type
   */
  public makeQueryResolver(type: string, nameOverride?: string, isSyncEnabled: boolean = false, queryTypeName: string = 'Query') {
    const fieldName = nameOverride ? nameOverride : graphqlName(`query${toUpper(type)}`);
    return new AppSync.Resolver({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      DataSourceName: Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
      FieldName: fieldName,
      TypeName: queryTypeName,
      RequestMappingTemplate: print(
        compoundExpression([
          set(ref('limit'), ref(`util.defaultIfNull($context.args.limit, ${ResourceConstants.DEFAULT_PAGE_LIMIT})`)),
          DynamoDBMappingTemplate.query({
            query: obj({
              expression: str('#typename = :typename'),
              expressionNames: obj({
                '#typename': str('__typename'),
              }),
              expressionValues: obj({
                ':typename': obj({
                  S: str(type),
                }),
              }),
            }),
            scanIndexForward: ifElse(
              ref('context.args.sortDirection'),
              ifElse(equals(ref('context.args.sortDirection'), str('ASC')), bool(true), bool(false)),
              bool(true),
            ),
            filter: ifElse(ref('context.args.filter'), ref('util.transform.toDynamoDBFilterExpression($ctx.args.filter)'), nul()),
            limit: ref('limit'),
            nextToken: ifElse(ref('context.args.nextToken'), ref('util.toJson($context.args.nextToken)'), nul()),
          }),
        ]),
      ),
      ResponseMappingTemplate: print(
        DynamoDBMappingTemplate.dynamoDBResponse(
          isSyncEnabled,
          compoundExpression([iff(raw('!$result'), set(ref('result'), ref('ctx.result'))), raw('$util.toJson($result)')]),
        ),
      ),
    });
  }

  /**
   * Create a resolver that lists items in DynamoDB.
   * TODO: actually fill out the right filter expression. This is a placeholder only.
   * @param type
   */
  public makeListResolver(type: string, nameOverride?: string, isSyncEnabled: boolean = false, queryTypeName: string = 'Query') {
    const fieldName = nameOverride ? nameOverride : graphqlName('list' + plurality(toUpper(type)));
    const requestVariable = 'ListRequest';
    return new AppSync.Resolver({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      DataSourceName: Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
      FieldName: fieldName,
      TypeName: queryTypeName,
      RequestMappingTemplate: print(
        compoundExpression([
          set(ref('limit'), ref(`util.defaultIfNull($context.args.limit, ${ResourceConstants.DEFAULT_PAGE_LIMIT})`)),
          set(
            ref(requestVariable),
            obj({
              version: str(RESOLVER_VERSION_ID),
              limit: ref('limit'),
            }),
          ),
          iff(ref('context.args.nextToken'), set(ref(`${requestVariable}.nextToken`), ref('context.args.nextToken'))),
          iff(
            ref('context.args.filter'),
            set(ref(`${requestVariable}.filter`), ref('util.parseJson("$util.transform.toDynamoDBFilterExpression($ctx.args.filter)")')),
          ),
          ifElse(
            raw(`!$util.isNull($${ResourceConstants.SNIPPETS.ModelQueryExpression})
                        && !$util.isNullOrEmpty($${ResourceConstants.SNIPPETS.ModelQueryExpression}.expression)`),
            compoundExpression([
              qref(`$${requestVariable}.put("operation", "Query")`),
              qref(`$${requestVariable}.put("query", $${ResourceConstants.SNIPPETS.ModelQueryExpression})`),
              ifElse(
                raw('!$util.isNull($ctx.args.sortDirection) && $ctx.args.sortDirection == "DESC"'),
                set(ref(`${requestVariable}.scanIndexForward`), bool(false)),
                set(ref(`${requestVariable}.scanIndexForward`), bool(true)),
              ),
            ]),
            qref(`$${requestVariable}.put("operation", "Scan")`),
          ),
          raw(`$util.toJson($${requestVariable})`),
        ]),
      ),
      ResponseMappingTemplate: print(DynamoDBMappingTemplate.dynamoDBResponse(isSyncEnabled)),
    });
  }

  /**
   * Create a resolver that deletes an item from DynamoDB.
   * @param type The name of the type to delete an item of.
   * @param nameOverride A user provided override for the field name.
   */
  public makeDeleteResolver({ type, nameOverride, syncConfig, mutationTypeName = 'Mutation' }: MutationResolverInput) {
    const fieldName = nameOverride ? nameOverride : graphqlName('delete' + toUpper(type));
    const isSyncEnabled = syncConfig ? true : false;
    return new AppSync.Resolver({
      ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
      DataSourceName: Fn.GetAtt(ModelResourceIDs.ModelTableDataSourceID(type), 'Name'),
      FieldName: fieldName,
      TypeName: mutationTypeName,
      RequestMappingTemplate: print(
        compoundExpression([
          ifElse(
            ref(ResourceConstants.SNIPPETS.AuthCondition),
            compoundExpression([
              set(ref('condition'), ref(ResourceConstants.SNIPPETS.AuthCondition)),
              ifElse(
                ref(ResourceConstants.SNIPPETS.ModelObjectKey),
                forEach(ref('entry'), ref(`${ResourceConstants.SNIPPETS.ModelObjectKey}.entrySet()`), [
                  qref('$condition.put("expression", "$condition.expression AND attribute_exists(#keyCondition$velocityCount)")'),
                  qref('$condition.expressionNames.put("#keyCondition$velocityCount", "$entry.key")'),
                ]),
                compoundExpression([
                  qref('$condition.put("expression", "$condition.expression AND attribute_exists(#id)")'),
                  qref('$condition.expressionNames.put("#id", "id")'),
                ]),
              ),
            ]),
            ifElse(
              ref(ResourceConstants.SNIPPETS.ModelObjectKey),
              compoundExpression([
                set(
                  ref('condition'),
                  obj({
                    expression: str(''),
                    expressionNames: obj({}),
                  }),
                ),
                forEach(ref('entry'), ref(`${ResourceConstants.SNIPPETS.ModelObjectKey}.entrySet()`), [
                  ifElse(
                    raw('$velocityCount == 1'),
                    qref('$condition.put("expression", "attribute_exists(#keyCondition$velocityCount)")'),
                    qref('$condition.put(\
"expression", "$condition.expression AND attribute_exists(#keyCondition$velocityCount)")'),
                  ),
                  qref('$condition.expressionNames.put("#keyCondition$velocityCount", "$entry.key")'),
                ]),
              ]),
              set(
                ref('condition'),
                obj({
                  expression: str('attribute_exists(#id)'),
                  expressionNames: obj({
                    '#id': str('id'),
                  }),
                }),
              ),
            ),
          ),
          iff(
            ref(ResourceConstants.SNIPPETS.VersionedCondition),
            compoundExpression([
              // tslint:disable-next-line
              qref(
                `$condition.put("expression", "($condition.expression) AND $${ResourceConstants.SNIPPETS.VersionedCondition}.expression")`,
              ),
              qref(`$condition.expressionNames.putAll($${ResourceConstants.SNIPPETS.VersionedCondition}.expressionNames)`),
              set(ref('expressionValues'), raw('$util.defaultIfNull($condition.expressionValues, {})')),
              qref(`$expressionValues.putAll($${ResourceConstants.SNIPPETS.VersionedCondition}.expressionValues)`),
              set(ref('condition.expressionValues'), ref('expressionValues')),
            ]),
          ),
          iff(
            ref('context.args.condition'),
            compoundExpression([
              set(
                ref('conditionFilterExpressions'),
                raw('$util.parseJson($util.transform.toDynamoDBConditionExpression($context.args.condition))'),
              ),
              // tslint:disable-next-line
              qref('$condition.put("expression", "($condition.expression) AND $conditionFilterExpressions.expression")'),
              qref('$condition.expressionNames.putAll($conditionFilterExpressions.expressionNames)'),
              set(ref('conditionExpressionValues'), raw('$util.defaultIfNull($condition.expressionValues, {})')),
              qref('$conditionExpressionValues.putAll($conditionFilterExpressions.expressionValues)'),
              set(ref('condition.expressionValues'), ref('conditionExpressionValues')),
              qref('$condition.expressionValues.putAll($conditionFilterExpressions.expressionValues)'),
            ]),
          ),
          iff(
            and([ref('condition.expressionValues'), raw('$condition.expressionValues.size() == 0')]),
            set(
              ref('condition'),
              obj({
                expression: ref('condition.expression'),
                expressionNames: ref('condition.expressionNames'),
              }),
            ),
          ),
          DynamoDBMappingTemplate.deleteItem({
            key: ifElse(
              ref(ResourceConstants.SNIPPETS.ModelObjectKey),
              raw(`$util.toJson(\$${ResourceConstants.SNIPPETS.ModelObjectKey})`),
              obj({
                id: ref('util.dynamodb.toDynamoDBJson($ctx.args.input.id)'),
              }),
              true,
            ),
            condition: ref('util.toJson($condition)'),
            isSyncEnabled,
          }),
        ]),
      ),
      ResponseMappingTemplate: print(DynamoDBMappingTemplate.dynamoDBResponse(isSyncEnabled)),
      ...(syncConfig && { SyncConfig: SyncUtils.syncResolverConfig(syncConfig) }),
    });
  }
}