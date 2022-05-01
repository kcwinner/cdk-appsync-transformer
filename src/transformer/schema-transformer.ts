// @ts-nocheck
import * as fs from "fs";
import * as path from "path";
import { AuthTransformer } from "@aws-amplify/graphql-auth-transformer";
import { DefaultValueTransformer } from "@aws-amplify/graphql-default-value-transformer";
import { FunctionTransformer } from "@aws-amplify/graphql-function-transformer";
import { HttpTransformer } from "@aws-amplify/graphql-http-transformer";
import { IndexTransformer, PrimaryKeyTransformer } from "@aws-amplify/graphql-index-transformer";
import { ModelTransformer } from "@aws-amplify/graphql-model-transformer";
import { BelongsToTransformer, HasManyTransformer, HasOneTransformer } from "@aws-amplify/graphql-relational-transformer";
import { GraphQLTransform, TransformConfig } from "@aws-amplify/graphql-transformer-core";
import { AppSyncAuthConfiguration, FeatureFlagProvider } from "@aws-amplify/graphql-transformer-interfaces";

import { CdkTransformer } from "./cdk-transformer";

// import { CustomVTLTransformer } from './custom-vtl-transformer';

// Rebuilt this from cloudform-types because it has type errors
import { Resource } from "./resource";
import { CdkTransformerStack } from ".";

export interface SchemaTransformerProps {
  /**
   * File path to the graphql schema
   * @default schema.graphql
   */
  readonly schemaPath?: string;

  /**
   * Path where transformed schema and resolvers will be placed
   * @default appsync
   */
  readonly outputPath?: string;

  /**
   * Set deletion protection on DynamoDB tables
   * @default true
   */
  readonly deletionProtectionEnabled?: boolean;

  /**
   * Whether to enable DataStore or not
   * @default false
   */
  readonly syncEnabled?: boolean;

  /**
   * The root directory to use for finding custom resolvers
   * @default process.cwd()
   */
  readonly customVtlTransformerRootDirectory?: string;
}

export class SchemaTransformer {
  public readonly schemaPath: string;
  public readonly outputPath: string;
  public readonly isSyncEnabled: boolean;
  public readonly customVtlTransformerRootDirectory: string;
  public readonly stacks: { [name: string]: CdkTransformerStack };
  public readonly resolvers: any;

  private readonly authConfig: AppSyncAuthConfiguration;

  authRolePolicy: Resource | undefined;
  unauthRolePolicy: Resource | undefined;

  constructor(props: SchemaTransformerProps) {
    this.schemaPath = props.schemaPath ?? "./schema.graphql";
    this.outputPath = props.outputPath ?? "./appsync";
    this.isSyncEnabled = props.syncEnabled ?? false;
    this.customVtlTransformerRootDirectory = props.customVtlTransformerRootDirectory ?? process.cwd();

    this.stacks = {};
    this.resolvers = {};

    // TODO: Make this better?
    this.authConfig = {
      defaultAuthentication: {
        authenticationType: "AMAZON_COGNITO_USER_POOLS",
        userPoolConfig: {
          userPoolId: "12345xyz",
        },
      },
      additionalAuthenticationProviders: [
        {
          authenticationType: "API_KEY",
          apiKeyConfig: {
            description: "Testing",
            apiKeyExpirationDays: 100,
          },
        },
        {
          authenticationType: "AWS_IAM",
        },
        {
          authenticationType: "OPENID_CONNECT",
          openIDConnectConfig: {
            name: "OIDC",
            issuerUrl: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXX",
          },
        },
      ],
    };
  }

  public transform(preCdkTransformers: any[] = [], postCdkTransformers: any[] = []) {
    const transformConfig = this.isSyncEnabled ? this.loadConfigSync() : {};

    const provider = new TransformerFeatureFlagProvider();

    // Note: This is not exact as we are omitting the @searchable transformer as well as some others.
    const transformer = new GraphQLTransform({
      transformConfig: transformConfig,
      authConfig: this.authConfig,
      featureFlags: provider,
      transformers: [
        new ModelTransformer(),

        new AuthTransformer(),

        new PrimaryKeyTransformer(),
        new IndexTransformer(),
        new BelongsToTransformer(),
        new HasManyTransformer(),
        new HasOneTransformer(),
        // new ManyToManyTransformer(), // TODO

        new DefaultValueTransformer(),

        new FunctionTransformer(),
        new HttpTransformer(),

        // new TtlTransformer(), // Not updated to latest way

        // new CustomVTLTransformer(this.customVtlTransformerRootDirectory), // TODO

        ...preCdkTransformers,
        ...postCdkTransformers,
      ],
    });

    const schema = fs.readFileSync(this.schemaPath);
    const deploymentResources = transformer.transform(schema.toString());

    const cdkTransformer = new CdkTransformer();
    this.stacks = cdkTransformer.transform(deploymentResources);

    // TODO: Get Unauth Role and Auth Role policies for authorization stuff
    this.unauthRolePolicy = (deploymentResources.rootStack.Resources?.UnauthRolePolicy01 as Resource) || undefined;
    this.authRolePolicy = (deploymentResources.rootStack.Resources?.AuthRolePolicy01 as Resource) || undefined;

    this.writeSchema(deploymentResources.schema);
    this.writeResolversToFile(deploymentResources.resolvers);

    return this.stacks;
  }

  /**
   * Gets the resolvers from the `./appsync/resolvers` folder
   * @returns all resolvers
   */
  public getResolvers() {
    const statements = ["Query", "Mutation"];
    const resolversDirPath = path.normalize(path.join(this.outputPath, "resolvers"));
    if (fs.existsSync(resolversDirPath)) {
      const files = fs.readdirSync(resolversDirPath);
      files.forEach((file) => {
        // Example: Mutation.createChannel.response
        let args = file.split(".");
        let typeName: string = args[0];
        let fieldName: string = args[1];
        let templateType = args.slice(-1)[0]; // get the last element, req or res

        // default to composite key of typeName and fieldName, however if it
        // is Query, Mutation or Subscription (top level) the compositeKey is the
        // same as fieldName only
        let compositeKey = `${typeName}${fieldName}`;
        if (statements.indexOf(typeName) >= 0) {
          // if (!this.outputs.noneResolvers || !this.outputs.noneResolvers[compositeKey]) compositeKey = fieldName;
        }

        let filepath = path.normalize(path.join(resolversDirPath, file));

        // if (statements.indexOf(typeName) >= 0 || (this.outputs.noneResolvers && this.outputs.noneResolvers[compositeKey])) {
        if (statements.indexOf(typeName) >= 0) {
          if (!this.resolvers[compositeKey]) {
            this.resolvers[compositeKey] = {
              typeName: typeName,
              fieldName: fieldName,
            };
          }

          if (templateType === "req") {
            this.resolvers[compositeKey].requestMappingTemplate = filepath;
          } else if (templateType === "res") {
            this.resolvers[compositeKey].responseMappingTemplate = filepath;
          }
        } else if (this.isHttpResolver(typeName, fieldName)) {
          if (!this.resolvers[compositeKey]) {
            this.resolvers[compositeKey] = {
              typeName: typeName,
              fieldName: fieldName,
            };
          }

          if (templateType === "req") {
            this.resolvers[compositeKey].requestMappingTemplate = filepath;
          } else if (templateType === "res") {
            this.resolvers[compositeKey].responseMappingTemplate = filepath;
          }
        } else {
          // This is a GSI
          if (!this.resolvers.gsi) {
            this.resolvers.gsi = {};
          }
          if (!this.resolvers.gsi[compositeKey]) {
            this.resolvers.gsi[compositeKey] = {
              typeName: typeName,
              fieldName: fieldName,
              tableName: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
            };
          }

          if (templateType === "req") {
            this.resolvers.gsi[compositeKey].requestMappingTemplate = filepath;
          } else if (templateType === "res") {
            this.resolvers.gsi[compositeKey].responseMappingTemplate = filepath;
          }
        }
      });
    }

    return this.resolvers;
  }

  /**
   * decides if this is a resolver for an HTTP datasource
   * @param typeName
   * @param fieldName
   */

  private isHttpResolver(typeName: string, fieldName: string) {
    const httpStack = this.stacks["HttpStack"];
    if (!httpStack) return false;

    for (const endpoint in httpStack.httpResolvers) {
      for (const resolver of httpStack.httpResolvers[endpoint]) {
        if (resolver.typeName === typeName && resolver.fieldName === fieldName) return true;
      }
    }

    return false;
  }

  /**
   * Writes the schema to the output directory for use with @aws-cdk/aws-appsync
   * @param schema
   */
  private writeSchema(schema: any) {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    fs.writeFileSync(`${this.outputPath}/schema.graphql`, schema);
  }

  /**
   * Writes all the resolvers to the output directory for loading into the datasources later
   * @param resolvers
   */
  private writeResolversToFile(resolvers: any) {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }

    const resolverFolderPath = path.normalize(path.join(this.outputPath, "resolvers"));
    if (fs.existsSync(resolverFolderPath)) {
      const files = fs.readdirSync(resolverFolderPath);
      files.forEach((file) => fs.unlinkSync(resolverFolderPath + "/" + file));
      fs.rmdirSync(resolverFolderPath);
    }

    if (!fs.existsSync(resolverFolderPath)) {
      fs.mkdirSync(resolverFolderPath, { recursive: true });
    }

    Object.keys(resolvers).forEach((key: any) => {
      const resolver = resolvers[key];
      const fileName = key.replace(".vtl", "");
      const resolverFilePath = path.normalize(path.join(resolverFolderPath, fileName));
      fs.writeFileSync(resolverFilePath, resolver);
    });
  }

  /**
   *
   * @param projectDir
   * @returns {@link TransformConfig}
   */
  // @ts-ignore
  private loadConfigSync(projectDir: string = "resources"): TransformConfig {
    // Initialize the config always with the latest version, other members are optional for now.
    let config: TransformConfig = {
      // Version: TRANSFORM_CURRENT_VERSION,
      // ResolverConfig: {
      //   project: {
      //     ConflictHandler: ConflictHandlerType.OPTIMISTIC,
      //     ConflictDetection: 'VERSION',
      //   },
      // },
    };

    // const configDir = path.join(__dirname, '..', '..', projectDir);

    // try {
    //   const configPath = path.join(configDir, TRANSFORM_CONFIG_FILE_NAME);
    //   const configExists = fs.existsSync(configPath);
    //   if (configExists) {
    //     const configStr = fs.readFileSync(configPath);
    //     config = JSON.parse(configStr.toString());
    //   }

    //   return config as TransformConfig;
    // } catch (err) {
    return config;
    // }
  }

  // private transformResources(resources: DeploymentResources) {
  //   Object.keys(resources.stacks).forEach((stackName) => {
  //     const template = resources.stacks[stackName];
  //     const templateResources = template.Resources ?? {};
  //     for (const resourceName of Object.keys(templateResources)) {
  //       const resource = templateResources[resourceName];
  //       console.log("## Name:", resourceName);
  //       console.log(resource);
  //     }
  //   });
  // }
}

/**
 * Grabbed from Amplify
 * https://github.com/aws-amplify/amplify-cli/blob/eb9257eaee117d0ed53ebc23aa28ecd7b7510fa1/packages/graphql-transformer-core/src/FeatureFlags.ts
 */
export class TransformerFeatureFlagProvider implements FeatureFlagProvider {
  getBoolean(featureName: string, options?: boolean): boolean {
    switch (featureName) {
      case "improvePluralization":
        return true;
      case "validateTypeNameReservedWords":
        return false;
      case "useSubUsernameForDefaultIdentityClaim":
        return true; // TODO: allow customization?
      default:
        return this.getValue<boolean>(featureName, options);
    }
  }
  getString(featureName: string, options?: string): string {
    return this.getValue<string>(featureName, options);
  }
  getNumber(featureName: string, options?: number): number {
    return this.getValue<number>(featureName, options);
  }
  getObject(): object {
    // Todo: for future extensibility
    throw new Error("Not implemented");
  }

  protected getValue<T extends string | number | boolean>(featureName: string, defaultValue?: T): T {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`No value found for feature ${featureName}`);
  }
}
