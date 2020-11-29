const { AwsCdkConstructLibrary } = require('projen');

const project = new AwsCdkConstructLibrary({
  authorAddress: "kcswinner@gmail.com",
  authorName: "Ken Winner",
  name: "cdk-appsync-transformer",
  repository: "https://github.com/ken/cdk-appsync-transformer.git",
  stability: "experimental",
  catalog: {
    twitter: 'KenWin0x539'
  },
  license: 'Apache-2.0',
  workflowNodeVersion: '12.17.0',
  defaultReleaseBranch: 'main',
  typescriptVersion: '^4.1.2',
  keywords: [
    "aws",
    "cdk",
    "aws-cdk",
    "appsync",
    "amplify",
    "transformer"
  ],
  eslint: false,
  mergify: false,
  dependabot: false,
  codeCov: true,
  npmignore: [
    'appsync/*'
  ],
  gitignore: [
    'appsync/*'
  ],

  // Jsii packaging
  python: {
    distName: "cdk-appsync-transformer",
    module: "cdk_appsync_transformer"
  },

  // Dependency information
  cdkVersion: '1.69.0',
  cdkVersionPinning: true,
  cdkDependencies: [
    '@aws-cdk/aws-appsync',
    '@aws-cdk/aws-cognito',
    '@aws-cdk/aws-dynamodb',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/core'
  ],
  devDeps: [
    "@types/jest",
    "@types/node",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "eslint",
    "jest",
    "ts-jest"
  ],
  deps: [
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
  ],
  bundledDeps: [
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
