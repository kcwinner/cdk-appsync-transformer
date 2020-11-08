const { JsiiProject } = require('projen');

const CDK_VERSION = '1.65.0';

const cdkDependencies = [
  `@aws-cdk/aws-appsync@${CDK_VERSION}`,
  `@aws-cdk/aws-cognito@${CDK_VERSION}`,
  `@aws-cdk/aws-dynamodb@${CDK_VERSION}`,
  `@aws-cdk/aws-iam@${CDK_VERSION}`,
  `@aws-cdk/aws-lambda@${CDK_VERSION}`,
  `@aws-cdk/core@${CDK_VERSION}`
]

const project = new JsiiProject({
  authorAddress: "kcswinner@gmail.com",
  authorName: "Ken Winner",
  name: "cdk-appsync-transformer",
  repository: "https://github.com/ken/cdk-appsync-transformer.git",
  stability: "experimental",
  license: 'Apache-2.0',
  workflowNodeVersion: '12.17.0',
  releaseBranches: ['main'],
  defaultReleaseBranch: 'main',
  typescriptVersion: '^4.0.3',
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
  codeCov: true,
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
    "graphql-versioned-transformer",
    ...cdkDependencies
  ],
  peerDeps: [
    "constructs@^3.2.17",
    ...cdkDependencies,
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
