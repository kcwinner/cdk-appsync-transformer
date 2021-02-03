import {
  DirectiveNode,
  FieldDefinitionNode,
  InterfaceTypeDefinitionNode,
  ObjectTypeDefinitionNode,
} from 'graphql';

// import {
//   getNonModelObjectArray,
//   makeNonModelInputObject,
// } from 'graphql-dynamodb-transformer/lib/definitions';

import { ResourceFactory } from 'graphql-dynamodb-transformer/lib/resources';

import {
  gql,
  // getDirectiveArguments,
  //   getFieldArguments,
  Transformer,
  TransformerContext,
} from 'graphql-transformer-core';

// import { getDirectiveArgument } from 'graphql-transformer-common';

const directiveDefinition = gql`
    directive @pk(
      name: String
    ) on FIELD_DEFINITION
  `;

export interface tableType {
  [name: string]: any;
}

export class PrimaryKeyTransformer extends Transformer {
  resources: ResourceFactory;
  tableTypes: { [name: string]: tableType };
  schemaTypes: tableType;

  constructor() {
    super('PrimaryKeyTransformer', directiveDefinition);
    this.resources = new ResourceFactory();
    this.tableTypes = {};
    this.schemaTypes = {};
  }

  public field = (
    parent: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode,
    def: FieldDefinitionNode,
    _: DirectiveNode,
    ctx: TransformerContext,
  ) => {
    const parentName = parent.name.value;
    const metadata = ctx.metadata.get(parentName);

    const fieldName = def.name.value;

    ctx.metadata.set(parentName, {
      ...metadata,
      pk: fieldName,
    });
  }
}