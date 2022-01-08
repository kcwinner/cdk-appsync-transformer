import {
  DirectiveNode,
  ObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  FieldDefinitionNode,
} from 'graphql';
import { compoundExpression, Expression, methodCall, printBlock, qref, set, ref } from 'graphql-mapping-template';
import { ResolverResourceIDs, getDirectiveArgument } from 'graphql-transformer-common';
import {
  Transformer,
  gql,
  TransformerContext,
  InvalidDirectiveError,
} from 'graphql-transformer-core';
export class MappedTransformer extends Transformer {
  constructor() {
    super(
      'MappedTransformer',
      gql`
        directive @mapped(mappings: [FieldMapping] = []) on FIELD_DEFINITION
        input FieldMapping {
          from: String!
          to: String!
        }
      `,
    );
  }

  public field = (
    parent: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode,
    field: FieldDefinitionNode,
    directive: DirectiveNode,
    acc: TransformerContext,
  ): void => {
    this.validate(field);
    const fieldName = field.name.value;
    const templateResources = acc.template.Resources;
    if (!templateResources) return;

    for (const [_, resource] of Object.entries(templateResources)) {
      if (resource.Type === 'AWS::AppSync::Resolver' && resource.Properties?.FieldName === fieldName) {
        const logicalResourceId = ResolverResourceIDs.ResolverResourceID(parent.name.value, field.name.value);
        const mappings: { to: string; from: string }[] = getDirectiveArgument(directive, 'mappings');

        for (const mapping of mappings) {
          const snippet: string = this.createSingleFieldVTLSnippet(mapping.to, mapping.from);
          this.augmentResolver(acc, logicalResourceId, snippet);
        }
      }
    }
  };

  private createSingleFieldVTLSnippet = (fieldName: string, fromFieldName: string): string => {
    const statements: Expression[] = [
      set(ref('mappedBody'), methodCall(ref('util.parseJson'), ref('ctx.result.body'))),
      qref(`$mappedBody.put('${fieldName}', $mappedBody['${fromFieldName}'])`),
      set(ref('ctx.result.body'), methodCall(ref('util.toJson'), ref('mappedBody'))),
    ];

    return printBlock(`Mapping "${fieldName}" from ${fromFieldName}`)(
      compoundExpression(statements),
    );
  };

  private augmentResolver = (
    acc: TransformerContext,
    resolverLogicalId: string,
    snippet: string,
  ): void => {
    const resolver = acc.getResource(resolverLogicalId);
    if (resolver) {
      resolver.Properties!.ResponseMappingTemplate = snippet + '\n\n' + resolver.Properties!.ResponseMappingTemplate;
      acc.setResource(resolverLogicalId, resolver);
    }
  };

  private validate = (field: FieldDefinitionNode) => {
    const directives = field.directives;
    const httpDirective = directives?.filter(dir => dir.name.value === 'http');
    if (!httpDirective) throw new InvalidDirectiveError('@mapped directive must be used alongside @http directive');
  };
}

