const { JsiiProject } = require('projen');

const CDK_VERSION = '1.64.0';

const project = new JsiiProject({
  authorAddress: "kcswinner@gmail.com",
  authorName: "Ken Winner",
  name: "cdk-appsync-transformer",
  repository: "https://github.com/ken/cdk-appsync-transformer.git",
  stability: "experimental",
  license: 'Apache-2.0',
  keywords: [
    "aws",
    "cdk",
    "aws-cdk",
    "appsync",
    "amplify",
    "transformer"
  ],
  awscdkio: {
    twitter: "KenWin0x539"
  },
  projenDevDependency: true,
  eslint: false,
  mergify: false,
  npmignore: [
    'appsync/*'
  ],
  gitignore: [
    'appsync/*'
  ],
  python: {
    distName: "cdk-appsync-transformer",
    module: "cdk_appsync_transformer"
  },
  devDeps: [
    `aws-cdk@${CDK_VERSION}`,
    `@aws-cdk/assert@${CDK_VERSION}`,
    "@types/jest",
    "@types/node",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "eslint",
    "jest",
    "ts-jest"
  ],
  deps: [
    `@aws-cdk/aws-appsync@${CDK_VERSION}`,
    `@aws-cdk/aws-cognito@${CDK_VERSION}`,
    `@aws-cdk/aws-dynamodb@${CDK_VERSION}`,
    `@aws-cdk/aws-iam@${CDK_VERSION}`,
    `@aws-cdk/aws-lambda@${CDK_VERSION}`,
    `@aws-cdk/core@${CDK_VERSION}`,
    "@types/graphql@14.5.0",
    "graphql@14.6.0",
    "graphql-auth-transformer@^6.18.1",
    "graphql-connection-transformer@^4.18.1",
    "graphql-dynamodb-transformer@^6.19.2",
    "graphql-function-transformer@^2.3.9",
    "graphql-key-transformer@^2.19.1",
    "graphql-mapping-template@^4.13.4",
    "graphql-relational-schema-transformer@^2.15.6",
    "graphql-transformer-common@^4.17.1",
    "graphql-transformer-core@^6.19.1",
    "graphql-versioned-transformer@^4.15.9"
  ],
  peerDeps: [
    `@aws-cdk/aws-appsync@${CDK_VERSION}`,
    `@aws-cdk/aws-cognito@${CDK_VERSION}`,
    `@aws-cdk/aws-dynamodb@${CDK_VERSION}`,
    `@aws-cdk/aws-iam@${CDK_VERSION}`,
    `@aws-cdk/aws-lambda@${CDK_VERSION}`,
    `@aws-cdk/core@${CDK_VERSION}`,
    "constructs@^3.1.2"
  ],
  bundledDeps: [
    "@types/graphql",
    "graphql",
    "graphql-auth-transformer",
    "graphql-connection-transformer",
    "graphql-dynamodb-transformer",
    "graphql-function-transformer",
    "graphql-key-transformer",
    "graphql-mapping-template",
    "graphql-relational-schema-transformer",
    "graphql-transformer-common",
    "graphql-transformer-core",
    "graphql-versioned-transformer"
  ]
});

project.synth();
