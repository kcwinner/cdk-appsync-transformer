import {
  DirectiveNode,
  ObjectTypeDefinitionNode,
  FieldDefinitionNode
} from 'graphql';

import {
  // getNonModelObjectArray,
  // makeNonModelInputObject,
  makeModelConnectionType,
  makeModelSortDirectionEnumObject,
  makeModelXFilterInputObject,
  makeEnumFilterInputObjects,
  makeAttributeTypeEnum,
  makeScalarFilterInputs
} from 'graphql-dynamodb-transformer/lib/definitions';

import { ResourceFactory } from 'graphql-dynamodb-transformer/lib/resources';

import {
  gql,
  getDirectiveArguments,
  // getFieldArguments,
  Transformer,
  TransformerContext,
  InvalidDirectiveError,
} from 'graphql-transformer-core';

import {
  blankObject,
  makeConnectionField,
  makeField,
  makeInputValueDefinition,
  wrapNonNull,
  makeNamedType,
  makeNonNullType,
  ModelResourceIDs,
  ResolverResourceIDs,
  getBaseType,
} from 'graphql-transformer-common';

const directiveDefinition = gql`
  directive @singletable(
    name: String!
  ) on OBJECT
`;

export interface tableType {
  [name: string]: any;
}

// To support generation of conditions and new naming, version 5 was introduced
export const CONDITIONS_MINIMUM_VERSION = 5;

export class SingleTableTransformer extends Transformer {
  resources: ResourceFactory;
  tableTypes: { [name: string]: tableType };
  schemaTypes: tableType;

  constructor() {
    super('SingleTableTransformer', directiveDefinition);
    this.resources = new ResourceFactory();
    this.tableTypes = {};
    this.schemaTypes = {};
  }

  public after = (ctx: TransformerContext): void => {
    Object.keys(this.schemaTypes).forEach(key => {
      const schemaType = this.schemaTypes[key];
      const tableMetadata = ctx.metadata.get(key);

      this.tableTypes[schemaType.tableName][key] = tableMetadata;
    });

    console.log('### Single Table Types', this.tableTypes);
  };

  /**
   * Given the initial input and context manipulate the context to handle this object directive.
   * @param initial The input passed to the transform.
   * @param ctx The accumulated context for the transform.
   */
  public object = (def: ObjectTypeDefinitionNode, directive: DirectiveNode, ctx: TransformerContext): void => {
    const isTypeNameReserved =
      def.name.value === ctx.getQueryTypeName() ||
      def.name.value === ctx.getMutationTypeName() ||
      def.name.value === ctx.getSubscriptionTypeName();

    if (isTypeNameReserved && ctx.featureFlags.getBoolean('validateTypeNameReservedWords', true)) {
      throw new InvalidDirectiveError(
        `'${def.name.value}' is a reserved type name and currently in use within the default schema element.`,
      );
    }

    // This is the type name (e.g. type Order, type Post, etc etc)
    const typeName = def.name.value;

    // console.log('### TYPE NAME:', typeName);
    // console.log('### DEFINITION:', def);

    // const fieldArgs = getFieldArguments(def);
    // console.log('### FIELD ARGS:', fieldArgs);

    const args = getDirectiveArguments(directive);
    const tableName = args.name;

    if (!this.tableTypes[tableName]) this.tableTypes[tableName] = [];
    this.tableTypes[tableName][typeName] = {};
    this.schemaTypes[typeName] = { tableName: tableName, pk: 'id', sk: 'sk' };

    ctx.metadata.set(typeName, { tableName: tableName, pk: 'id', sk: 'sk' });
    console.log(ctx.metadata);

    this.createQueries(def, directive, ctx);

    this.addTimestampFields(def, directive, ctx);
  }

  private typeExist(type: string, ctx: TransformerContext): boolean {
    return Boolean(type in ctx.nodeMap);
  }

  private supportsConditions(context: TransformerContext) {
    return context.getTransformerVersion() >= CONDITIONS_MINIMUM_VERSION;
  }

  private createQueries = (def: ObjectTypeDefinitionNode, directive: DirectiveNode, ctx: TransformerContext) => {
    const typeName = def.name.value;
    const queryFields = [];
    const directiveArguments = getDirectiveArguments(directive);

    // Configure queries based on *queries* argument
    let shouldMakeGet = true;
    let shouldMakeList = true;
    let getFieldNameOverride = undefined;
    let listFieldNameOverride = undefined;
    // const isSyncEnabled = this.opts.SyncConfig ? true : false;
    const isSyncEnabled = false;

    // Figure out which queries to make and if they have name overrides.
    // If queries is undefined (default), create all queries
    // If queries is explicetly set to null, do not create any
    // else if queries is defined, check overrides
    if (directiveArguments.queries === null) {
      shouldMakeGet = false;
      shouldMakeList = false;
    } else if (directiveArguments.queries) {
      if (!directiveArguments.queries.get) {
        shouldMakeGet = false;
      } else {
        getFieldNameOverride = directiveArguments.queries.get;
      }
      if (!directiveArguments.queries.list) {
        shouldMakeList = false;
      } else {
        listFieldNameOverride = directiveArguments.queries.list;
      }
    }

    if (shouldMakeList) {
      if (!this.typeExist('ModelSortDirection', ctx)) {
        const tableSortDirection = makeModelSortDirectionEnumObject();
        ctx.addEnum(tableSortDirection);
      }
    }

    // Create sync query if @model present for datastore
    // if (isSyncEnabled) {
    //   // change here for selective Sync for @model (Just add the queryMap for table and query expression)
    //   const syncResolver = this.resources.makeSyncResolver(typeName);
    //   const syncResourceID = ResolverResourceIDs.SyncResolverResourceID(typeName);
    //   ctx.setResource(syncResourceID, syncResolver);
    //   ctx.mapResourceToStack(typeName, syncResourceID);
    //   this.generateModelXConnectionType(ctx, def, isSyncEnabled);
    //   this.generateFilterInputs(ctx, def);
    //   queryFields.push(
    //     makeField(
    //       syncResolver.Properties.FieldName.toString(),
    //       [
    //         makeInputValueDefinition('filter', makeNamedType(ModelResourceIDs.ModelFilterInputTypeName(def.name.value))),
    //         makeInputValueDefinition('limit', makeNamedType('Int')),
    //         makeInputValueDefinition('nextToken', makeNamedType('String')),
    //         makeInputValueDefinition('lastSync', makeNamedType('AWSTimestamp')),
    //       ],
    //       makeNamedType(ModelResourceIDs.ModelConnectionTypeName(def.name.value)),
    //     ),
    //   );
    // }

    // Create get queries
    if (shouldMakeGet) {
      const getResolver = this.resources.makeGetResolver(def.name.value, getFieldNameOverride, isSyncEnabled, ctx.getQueryTypeName());
      const resourceId = ResolverResourceIDs.DynamoDBGetResolverResourceID(typeName);
      ctx.setResource(resourceId, getResolver);
      ctx.mapResourceToStack(typeName, resourceId);

      queryFields.push(
        makeField(
          getResolver.Properties.FieldName.toString(),
          [makeInputValueDefinition('id', makeNonNullType(makeNamedType('ID')))],
          makeNamedType(def.name.value),
        ),
      );
    }

    if (shouldMakeList) {
      this.generateModelXConnectionType(ctx, def);

      // Create the list resolver
      const listResolver = this.resources.makeListResolver(def.name.value, listFieldNameOverride, isSyncEnabled, ctx.getQueryTypeName());
      const resourceId = ResolverResourceIDs.DynamoDBListResolverResourceID(typeName);
      ctx.setResource(resourceId, listResolver);
      ctx.mapResourceToStack(typeName, resourceId);

      queryFields.push(makeConnectionField(listResolver.Properties.FieldName.toString(), def.name.value));
      this.generateFilterInputs(ctx, def);
    }

    ctx.addQueryFields(queryFields);
  };

  private generateModelXConnectionType(ctx: TransformerContext, def: ObjectTypeDefinitionNode, isSync: Boolean = false): void {
    const tableXConnectionName = ModelResourceIDs.ModelConnectionTypeName(def.name.value);
    if (this.typeExist(tableXConnectionName, ctx)) {
      return;
    }

    // Create the ModelXConnection
    const connectionType = blankObject(tableXConnectionName);
    ctx.addObject(connectionType);
    ctx.addObjectExtension(makeModelConnectionType(def.name.value, isSync));
  }

  private generateFilterInputs(ctx: TransformerContext, def: ObjectTypeDefinitionNode): void {
    const scalarFilters = makeScalarFilterInputs(this.supportsConditions(ctx));
    for (const filter of scalarFilters) {
      if (!this.typeExist(filter.name.value, ctx)) {
        ctx.addInput(filter);
      }
    }

    // Create the Enum filters
    const enumFilters = makeEnumFilterInputObjects(def, ctx, this.supportsConditions(ctx));
    for (const filter of enumFilters) {
      if (!this.typeExist(filter.name.value, ctx)) {
        ctx.addInput(filter);
      }
    }

    // Create the ModelXFilterInput
    const tableXQueryFilterInput = makeModelXFilterInputObject(def, ctx, this.supportsConditions(ctx));
    if (!this.typeExist(tableXQueryFilterInput.name.value, ctx)) {
      ctx.addInput(tableXQueryFilterInput);
    }

    if (this.supportsConditions(ctx)) {
      const attributeTypeEnum = makeAttributeTypeEnum();
      if (!this.typeExist(attributeTypeEnum.name.value, ctx)) {
        ctx.addType(attributeTypeEnum);
      }
    }
  }

  private addTimestampFields(def: ObjectTypeDefinitionNode, directive: DirectiveNode, ctx: TransformerContext): void {
    const createdAtField = 'createdAt';
    const updatedAtField = 'updatedAt';
    const existingUpdatedAtField = def.fields?.find(f => f.name.value === updatedAtField);
    const existingCreatedAtField = def.fields?.find(f => f.name.value === createdAtField);
    // Todo: Consolidate how warnings are shown. Instead of printing them here, the invoker of transformer should get
    // all the warnings together and decide how to render those warning
    if (existingCreatedAtField && !SingleTableTransformer.isTimestampCompatibleField(existingCreatedAtField)) {
      console.log(
        `${def.name.value}.${existingCreatedAtField.name.value} is of type ${getBaseType(
          existingCreatedAtField.type,
        )}. To support auto population change the type to AWSDateTime or String`,
      );
    }

    if (existingUpdatedAtField && !SingleTableTransformer.isTimestampCompatibleField(existingUpdatedAtField)) {
      console.log(
        `${def.name.value}.${existingUpdatedAtField.name.value} is of type ${getBaseType(
          existingUpdatedAtField.type,
        )}. To support auto population change the type to AWSDateTime or String`,
      );
    }
    const obj = ctx.getObject(def.name.value);
    if (!obj) return;

    const newObj: ObjectTypeDefinitionNode = {
      ...obj,
      fields: [
        ...obj && obj.fields ? obj.fields : [],
        ...(createdAtField && !existingCreatedAtField ? [makeField(createdAtField, [], wrapNonNull(makeNamedType('AWSDateTime')))] : []), // createdAt field
        ...(updatedAtField && !existingUpdatedAtField ? [makeField(updatedAtField, [], wrapNonNull(makeNamedType('AWSDateTime')))] : []), // updated field
      ],
    };
    ctx.updateObject(newObj);
  }

  private static isTimestampCompatibleField(field?: FieldDefinitionNode): boolean {
    if (field && !(getBaseType(field.type) === 'AWSDateTime' || getBaseType(field.type) === 'String')) {
      return false;
    }
    return true;
  }
}