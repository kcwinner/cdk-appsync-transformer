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
    "appsync",
    "amplify",
  ],
  eslint: false,
  mergify: false,
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
  cdkVersion: '1.75.0',
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
    "@types/node@^10.17.48",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "eslint",
    "jest",
    "ts-jest"
  ],
  bundledDeps: [
    "graphql",
    "graphql-auth-transformer@6.22.1",
    "graphql-connection-transformer@4.19.1",
    "graphql-dynamodb-transformer@6.21.1",
    "graphql-function-transformer@2.4.1",
    "graphql-key-transformer@2.20.1",
    "graphql-mapping-template@4.18.1",
    "graphql-relational-schema-transformer@2.16.1",
    "graphql-transformer-common@4.18.1",
    "graphql-transformer-core@6.23.1",
    "graphql-versioned-transformer@4.16.1"
  ]
});

// Override the @types/node version so dependabot leaves us alone
project.addDevDeps('@types/node@^10.17.48');

project.synth();
