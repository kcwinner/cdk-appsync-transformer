import * as fs from 'fs';
import { normalize, join } from 'path';
import { ModelAuthTransformer, ModelAuthTransformerConfig } from 'graphql-auth-transformer';
import { ModelConnectionTransformer } from 'graphql-connection-transformer';
import { DynamoDBModelTransformer } from 'graphql-dynamodb-transformer';
import { HttpTransformer } from 'graphql-http-transformer';
import { KeyTransformer } from 'graphql-key-transformer';
import { GraphQLTransform, TransformConfig, TRANSFORM_CURRENT_VERSION, TRANSFORM_CONFIG_FILE_NAME, ConflictHandlerType, ITransformer } from 'graphql-transformer-core';
import TtlTransformer from 'graphql-ttl-transformer';
import { VersionedModelTransformer } from 'graphql-versioned-transformer';

import {
  CdkTransformer,
  CdkTransformerTable,
  CdkTransformerResolver,
  CdkTransformerFunctionResolver,
  CdkTransformerHttpResolver,
} from './cdk-transformer';

// Rebuilt this from cloudform-types because it has type errors
import { Resource } from './resource';

// Import this way because FunctionTransformer.d.ts types were throwing an eror. And we didn't write this package so hope for the best :P
// eslint-disable-next-line
const { FunctionTransformer } = require('graphql-function-transformer');

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
}

export interface SchemaTransformerOutputs {
  readonly cdkTables?: { [name: string]: CdkTransformerTable };
  readonly noneResolvers?: { [name: string]: CdkTransformerResolver };
  readonly functionResolvers?: { [name: string]: CdkTransformerFunctionResolver[] };
  readonly httpResolvers?: { [name: string]: CdkTransformerHttpResolver[] };
  readonly queries?: { [name: string]: string };
  readonly mutations?: { [name: string]: CdkTransformerResolver };
  readonly subscriptions?: { [name: string]: CdkTransformerResolver };
}

export class SchemaTransformer {
  public readonly schemaPath: string
  public readonly outputPath: string
  public readonly isSyncEnabled: boolean

  private readonly authTransformerConfig: ModelAuthTransformerConfig

  outputs: SchemaTransformerOutputs
  resolvers: any
  authRolePolicy: Resource | undefined
  unauthRolePolicy: Resource | undefined

  constructor(props: SchemaTransformerProps) {
    this.schemaPath = props.schemaPath || './schema.graphql';
    this.outputPath = props.outputPath || './appsync';
    this.isSyncEnabled = props.syncEnabled || false;

    this.outputs = {};
    this.resolvers = {};

    // TODO: Make this better?
    this.authTransformerConfig = {
      authConfig: {
        defaultAuthentication: {
          authenticationType: 'AMAZON_COGNITO_USER_POOLS',
          userPoolConfig: {
            userPoolId: '12345xyz',
          },
        },
        additionalAuthenticationProviders: [
          {
            authenticationType: 'API_KEY',
            apiKeyConfig: {
              description: 'Testing',
              apiKeyExpirationDays: 100,
            },
          },
          {
            authenticationType: 'AWS_IAM',
          },
        ],
      },
    };
  }

  public transform(preCdkTransformers: ITransformer[] = [], postCdkTransformers: ITransformer[] = []) {
    const transformConfig = this.isSyncEnabled ? this.loadConfigSync() : {};

    // Note: This is not exact as we are omitting the @searchable transformer as well as some others.
    const transformer = new GraphQLTransform({
      transformConfig: transformConfig,
      transformers: [
        new DynamoDBModelTransformer(),
        new TtlTransformer(),
        new VersionedModelTransformer(),
        new FunctionTransformer(),
        new KeyTransformer(),
        new ModelConnectionTransformer(),
        new ModelAuthTransformer(this.authTransformerConfig),
        new HttpTransformer(),
        ...preCdkTransformers,
        new CdkTransformer(),
        ...postCdkTransformers,
      ],
    });

    const schema = fs.readFileSync(this.schemaPath);
    const cfdoc = transformer.transform(schema.toString());

    // TODO: Get Unauth Role and Auth Role policies for authorization stuff
    this.unauthRolePolicy = cfdoc.rootStack.Resources?.UnauthRolePolicy01 as Resource || undefined;

    this.writeSchema(cfdoc.schema);
    this.writeResolversToFile(cfdoc.resolvers);

    // Outputs shouldn't be null but default to empty map
    this.outputs = cfdoc.rootStack.Outputs ?? {};

    return this.outputs;
  }

  /**
     *
     */
  public getResolvers() {
    const statements = ['Query', 'Mutation'];
    const resolversDirPath = normalize('./appsync/resolvers');
    if (fs.existsSync(resolversDirPath)) {
      const files = fs.readdirSync(resolversDirPath);
      files.forEach(file => {
        // Example: Mutation.createChannel.response
        let args = file.split('.');
        let typeName: string = args[0];
        let fieldName: string = args[1];
        let templateType = args[2]; // request or response

        // default to composite key of typeName and fieldName, however if it
        // is Query, Mutation or Subscription (top level) the compositeKey is the
        // same as fieldName only
        let compositeKey = `${typeName}${fieldName}`;
        if (statements.indexOf(typeName) >= 0) {
          compositeKey = fieldName;
        }

        let filepath = normalize(`${resolversDirPath}/${file}`);

        if (statements.indexOf(typeName) >= 0 || (this.outputs.noneResolvers && this.outputs.noneResolvers[compositeKey])) {
          if (!this.resolvers[compositeKey]) {
            this.resolvers[compositeKey] = {
              typeName: typeName,
              fieldName: fieldName,
            };
          }

          if (templateType === 'req') {
            this.resolvers[compositeKey].requestMappingTemplate = filepath;
          } else if (templateType === 'res') {
            this.resolvers[compositeKey].responseMappingTemplate = filepath;
          }
        } else if (this.isHttpResolver(typeName, fieldName)) {
          if (!this.resolvers[compositeKey]) {
            this.resolvers[compositeKey] = {
              typeName: typeName,
              fieldName: fieldName,
            };
          }

          if (templateType === 'req') {
            this.resolvers[compositeKey].requestMappingTemplate = filepath;
          } else if (templateType === 'res') {
            this.resolvers[compositeKey].responseMappingTemplate = filepath;
          }
        } else { // This is a GSI
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

          if (templateType === 'req') {
            this.resolvers.gsi[compositeKey].requestMappingTemplate = filepath;
          } else if (templateType === 'res') {
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
    if (!this.outputs.httpResolvers) return false;

    for (const endpoint in this.outputs.httpResolvers) {
      for (const resolver of this.outputs.httpResolvers[endpoint]) {
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
      fs.mkdirSync(this.outputPath);
    }

    fs.writeFileSync(`${this.outputPath}/schema.graphql`, schema);
  }

  /**
     * Writes all the resolvers to the output directory for loading into the datasources later
     * @param resolvers
     */
  private writeResolversToFile(resolvers: any) {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath);
    }

    const resolverFolderPath = normalize(this.outputPath + '/resolvers');
    if (fs.existsSync(resolverFolderPath)) {
      const files = fs.readdirSync(resolverFolderPath);
      files.forEach(file => fs.unlinkSync(resolverFolderPath + '/' + file));
      fs.rmdirSync(resolverFolderPath);
    }

    if (!fs.existsSync(resolverFolderPath)) {
      fs.mkdirSync(resolverFolderPath);
    }

    Object.keys(resolvers).forEach((key: any) => {
      const resolver = resolvers[key];
      const fileName = key.replace('.vtl', '');
      const resolverFilePath = normalize(`${resolverFolderPath}/${fileName}`);
      fs.writeFileSync(resolverFilePath, resolver);
    });
  }

  /**
     * @returns {@link TransformConfig}
    */
  private loadConfigSync(projectDir: string = 'resources'): TransformConfig {
    // Initialize the config always with the latest version, other members are optional for now.
    let config: TransformConfig = {
      Version: TRANSFORM_CURRENT_VERSION,
      ResolverConfig: {
        project: {
          ConflictHandler: ConflictHandlerType.OPTIMISTIC,
          ConflictDetection: 'VERSION',
        },
      },
    };

    const configDir = join(__dirname, '..', '..', projectDir);

    try {
      const configPath = join(configDir, TRANSFORM_CONFIG_FILE_NAME);
      const configExists = fs.existsSync(configPath);
      if (configExists) {
        const configStr = fs.readFileSync(configPath);
        config = JSON.parse(configStr.toString());
      }

      return config as TransformConfig;
    } catch (err) {
      return config;
    }
  }
}
