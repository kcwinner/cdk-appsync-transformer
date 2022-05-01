import * as fs from "fs";
import * as path from "path";
import { Fn, AppSync, IntrinsicFunction } from "cloudform-types";
import Resolver from "cloudform-types/types/appSync/resolver";
import { FieldDefinitionNode, DirectiveNode, ObjectTypeDefinitionNode, InterfaceTypeDefinitionNode, Kind } from "graphql";
import { getDirectiveArgument, ResolverResourceIDs, ResourceConstants } from "graphql-transformer-common";
import { Transformer, gql, TransformerContext } from "graphql-transformer-core";

const CUSTOM_DIRECTIVE_STACK_NAME = "CustomDirectiveStack";

/**
 * Create a get item resolver for singular connections.
 * @param type The parent type name.
 * @param field The connection field name.
 */
/*eslint-disable @typescript-eslint/no-explicit-any */
function makeResolver(type: string, field: string, request: string, response: string, datasourceName: string | IntrinsicFunction = "NONE"): Resolver {
  return new Resolver({
    ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, "ApiId"),
    DataSourceName: datasourceName,
    FieldName: field,
    TypeName: type,
    RequestMappingTemplate: request,
    ResponseMappingTemplate: response,
  }).dependsOn(ResourceConstants.RESOURCES.GraphQLSchemaLogicalID);
}

function noneDataSource() {
  return new AppSync.DataSource({
    ApiId: Fn.GetAtt(ResourceConstants.RESOURCES.GraphQLAPILogicalID, "ApiId"),
    Name: "NONE",
    Type: "NONE",
  });
}

export class CustomVTLTransformer extends Transformer {
  readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    super(
      "CustomVTLTransformer",
      gql`
        directive @custom(request: String, response: String) on FIELD_DEFINITION
      `,
    );

    this.rootDirectory = rootDirectory;
  }

  public before = (acc: TransformerContext): void => {
    const directiveList: DirectiveNode[] = [];

    // gather all the http directives
    for (const def of acc.inputDocument.definitions) {
      if (def.kind === Kind.OBJECT_TYPE_DEFINITION && def.fields) {
        for (const field of def.fields) {
          if (field.directives) {
            const customDirective = field.directives.find((dir: { name: { value: string } }) => dir.name.value === "custom");
            if (customDirective) {
              directiveList.push(customDirective);
            }
          }
        }
      }
    }
  };

  /*eslint-disable @typescript-eslint/no-explicit-any */
  public field = (parent: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode, field: FieldDefinitionNode, directive: DirectiveNode, acc: TransformerContext): void => {
    const parentTypeName = parent.name.value;
    const fieldName = field.name.value;

    // add none ds if that does not exist
    const noneDS = acc.getResource(ResourceConstants.RESOURCES.NoneDataSource);
    if (!noneDS) {
      acc.setResource(ResourceConstants.RESOURCES.NoneDataSource, noneDataSource());
    }

    acc.mapResourceToStack(CUSTOM_DIRECTIVE_STACK_NAME, ResolverResourceIDs.ResolverResourceID(parentTypeName, fieldName));

    const requestFile = getDirectiveArgument(directive, "request");
    const responseFile = getDirectiveArgument(directive, "response");

    let datasourceName: IntrinsicFunction | string = "NONE";

    if (!requestFile) {
      throw new Error(`The @custom directive on Type: ${parent.name.value} Field: ${field.name.value} is missing the request argument.`);
    }

    if (!responseFile) {
      throw new Error(`The @custom directive on Type: ${parent.name.value} Field: ${field.name.value} is missing the response argument.`);
    }

    let request, response;
    try {
      request = fs.readFileSync(path.join(this.rootDirectory, requestFile)).toString();
      response = fs.readFileSync(path.join(this.rootDirectory, responseFile)).toString();
    } catch (err) {
      throw new Error(`Couldn't load VTL files. ${(err as Error).message}`);
    }
    const fieldMappingResolver = makeResolver(parentTypeName, fieldName, request, response, datasourceName);
    acc.setResource(ResolverResourceIDs.ResolverResourceID(parentTypeName, fieldName), fieldMappingResolver);
    const templateResources = acc.template.Resources;
    if (!templateResources) return;
  };
}
