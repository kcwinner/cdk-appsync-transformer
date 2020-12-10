import { GraphQLTransform, TransformConfig, TRANSFORM_CURRENT_VERSION, TRANSFORM_CONFIG_FILE_NAME, ConflictHandlerType } from 'graphql-transformer-core';
import { DynamoDBModelTransformer } from 'graphql-dynamodb-transformer';
import { ModelConnectionTransformer } from 'graphql-connection-transformer';
import { KeyTransformer } from 'graphql-key-transformer';
import { VersionedModelTransformer } from 'graphql-versioned-transformer';
import { ModelAuthTransformer, ModelAuthTransformerConfig } from 'graphql-auth-transformer'

// Import this way because FunctionTransformer.d.ts types were throwing an eror. And we didn't write this package so hope for the best :P
const { FunctionTransformer } = require('graphql-function-transformer');

// Rebuilt this from cloudform-types because it has type errors
import { Resource } from './resource';
import { SchemaTransformerOutputs } from './transformerTypes';
import { CdkTransformer } from './cdk-transformer';

import { normalize, join } from 'path';
import * as fs from 'fs';

export interface SchemaTransformerProps {
    /**
     * File path to the graphql schema
     *
     * @default schema.graphql
     */
    schemaPath?: string

    /**
     * Path where transformed schema and resolvers will be placed
     *
     * @default appsync
     */
    outputPath?: string

    /**
     * Set deletion protection on DynamoDB tables
     *
     * @default true
     */
    deletionProtectionEnabled?: boolean

    /**
     * Whether to enable DataStore or not
     *
     * @default false
     */
    syncEnabled?: boolean
}

export class SchemaTransformer {
    public readonly schemaPath: string
    public readonly outputPath: string
    public readonly isSyncEnabled: boolean
    public readonly authTransformerConfig: ModelAuthTransformerConfig

    outputs: SchemaTransformerOutputs
    resolvers: any
    authRolePolicy: Resource | undefined
    unauthRolePolicy: Resource | undefined

    constructor(props: SchemaTransformerProps) {
        this.schemaPath = props.schemaPath || './schema.graphql';
        this.outputPath = props.outputPath || './appsync';
        this.isSyncEnabled = props.syncEnabled || false

        this.outputs = {};
        this.resolvers = {};

        // TODO: Make this better?
        this.authTransformerConfig = {
            authConfig: {
                defaultAuthentication: {
                    authenticationType: 'AMAZON_COGNITO_USER_POOLS',
                    userPoolConfig: {
                        userPoolId: '12345xyz'
                    }
                },
                additionalAuthenticationProviders: [
                    {
                        authenticationType: 'API_KEY',
                        apiKeyConfig: {
                            description: 'Testing',
                            apiKeyExpirationDays: 100
                        }
                    },
                    {
                        authenticationType: 'AWS_IAM'
                    }
                ]
            }
        }
    }

    public transform() {
        const transformConfig = this.isSyncEnabled ? this.loadConfigSync() : {}

        // Note: This is not exact as we are omitting the @searchable transformer, and some others.
        const transformer = new GraphQLTransform({
            transformConfig: transformConfig,
            transformers: [
                new DynamoDBModelTransformer(),
                new VersionedModelTransformer(),
                new FunctionTransformer(),
                new KeyTransformer(),
                new ModelConnectionTransformer(),
                new ModelAuthTransformer(this.authTransformerConfig),
                new CdkTransformer(),
            ]
        });

        const schema = fs.readFileSync(this.schemaPath);
        const cfdoc = transformer.transform(schema.toString());

        // TODO: Get Unauth Role and Auth Role policies for authorization stuff
        this.unauthRolePolicy = cfdoc.rootStack.Resources?.UnauthRolePolicy01 as Resource || undefined

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
        const statements = ['Query', 'Mutation', 'Subscription'];
        const resolversDirPath = normalize('./appsync/resolvers');
        if (fs.existsSync(resolversDirPath)) {
            const files = fs.readdirSync(resolversDirPath);
            files.forEach(file => {
                // Example: Mutation.createChannel.response
                let args = file.split('.');
                let typeName: string = args[0];
                let name: string = args[1];
                let templateType = args[2]; // request or response
                let filepath = normalize(`${resolversDirPath}/${file}`);

                if (statements.indexOf(typeName) >= 0 || (this.outputs.noneResolvers && this.outputs.noneResolvers[name])) {
                    if (!this.resolvers[name]) {
                        this.resolvers[name] = {
                            typeName: typeName,
                            fieldName: name,
                        }
                    }

                    if (templateType === 'req') {
                        this.resolvers[name]['requestMappingTemplate'] = filepath;
                    } else if (templateType === 'res') {
                        this.resolvers[name]['responseMappingTemplate'] = filepath;
                    }

                } else { // This is a GSI
                    if (!this.resolvers['gsi']) {
                        this.resolvers['gsi'] = {};
                    }

                    let mapName = `${typeName}${name}`
                    if (!this.resolvers['gsi'][mapName]) {
                        this.resolvers['gsi'][mapName] = {
                            typeName: typeName,
                            fieldName: name,
                            tableName: name.charAt(0).toUpperCase() + name.slice(1)
                        }
                    }

                    if (templateType === 'req') {
                        this.resolvers['gsi'][mapName]['requestMappingTemplate'] = filepath;
                    } else if (templateType === 'res') {
                        this.resolvers['gsi'][mapName]['responseMappingTemplate'] = filepath;
                    }
                }
            })
        }

        return this.resolvers;
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
                    ConflictDetection: 'VERSION'
                }
            }
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