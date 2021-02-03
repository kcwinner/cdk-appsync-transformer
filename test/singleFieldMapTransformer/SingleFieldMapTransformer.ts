import { Fn, AppSync } from 'cloudform-types';
import Resolver from 'cloudform-types/types/appSync/resolver';
import { Kind, FieldDefinitionNode } from 'graphql';
import { raw, print, obj, str, toJson } from 'graphql-mapping-template';
import {
  getDirectiveArgument,
  ResolverResourceIDs,
  ResourceConstants,
} from 'graphql-transformer-common';
import { Transformer, gql, TransformerContext } from 'graphql-transformer-core';

const MAP_STACK_NAME = 'MapStack';
// /**
//  * Returns the type of the field with the field name specified by finding it from the array of fields
//  * and returning its type.
//  * @param fields Array of FieldDefinitionNodes to search within.
//  * @param fieldName Name of the field whose type is to be fetched.
//  */
// function getFieldType(relatedType: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode, fieldName: string) {
//   const foundField = relatedType.fields?.find((f) => f.name.value === fieldName);
//   if (!foundField) {
//     throw new InvalidDirectiveError(`${fieldName} is not defined in ${relatedType.name.value}.`);
//   }
//   return foundField.type;
// }

/**
 * Create a get item resolver for singular connections.
 * @param type The parent type name.
 * @param field The connection field name.
 */
/*eslint-disable @typescript-eslint/no-explicit-any */
function makeResolver(type: string, field: string, fromFieldName: string): Resolver {
  return new Resolver({
    ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
    DataSourceName: 'NONE',
    FieldName: field,
    TypeName: type,
    RequestMappingTemplate: print(
      obj({
        version: str('2018-05-29'),
      }),
    ),
    ResponseMappingTemplate: print(toJson(raw(`$ctx.source.${fromFieldName}`))),
  }).dependsOn(ResourceConstants.RESOURCES.GraphQLSchemaLogicalID);
}

function noneDataSource() {
  return new AppSync.DataSource({
    ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, 'ApiId'),
    Name: 'NONE',
    Type: 'NONE',
  });
}

export class SingleFieldMapTransformer extends Transformer {
  private httpFieldsWithArgs: FieldDefinitionNode[] = [];

  constructor() {
    super(
      'MapFieldTransformer',
      gql`
        directive @from(field: String) on FIELD_DEFINITION
      `,
    );
  }

  public before = (acc: TransformerContext): void => {
    acc.mergeResources({});
    acc.mergeParameters({});
    acc.mergeOutputs({});

    // search for all http directives, should be resolved by now with datasources
    for (const def of acc.inputDocument.definitions) {
      if (def.kind === Kind.OBJECT_TYPE_DEFINITION && def.fields) {
        for (const field of def.fields) {
          if (field.directives) {
            const httpDirective = field.directives.find(
              (dir: { name: { value: string } }) => dir.name.value === 'restApi',
            );
            if (httpDirective) {
              const args = field.arguments?.length;
              // console.log(field.arguments);
              if (args && args > 0) this.httpFieldsWithArgs.push(field);
            }
          }
        }
      }
    }
  };

  /*eslint-disable @typescript-eslint/no-explicit-any */
  public field = (parent: any, field: any, directive: any, acc: TransformerContext): void => {
    const parentTypeName = parent.name.value;
    const fieldName = field.name.value;

    // add none ds if that does not exist
    const noneDS = acc.getResource(ResourceConstants.RESOURCES.NoneDataSource);
    if (!noneDS) {
      acc.setResource(ResourceConstants.RESOURCES.NoneDataSource, noneDataSource());
    }

    acc.mapResourceToStack(MAP_STACK_NAME, ResolverResourceIDs.ResolverResourceID(parentTypeName, fieldName));

    const fromFieldName = getDirectiveArgument(directive, 'field');
    const fieldMappingResolver = makeResolver(parentTypeName, fieldName, fromFieldName);
    acc.setResource(ResolverResourceIDs.ResolverResourceID(parentTypeName, fieldName), fieldMappingResolver);
    const templateResources = acc.template.Resources;
    if (!templateResources) return;
  };
}
