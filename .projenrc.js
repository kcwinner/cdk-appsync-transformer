const { AwsCdkConstructLibrary } = require('projen');

const project = new AwsCdkConstructLibrary({
  authorAddress: 'kcswinner@gmail.com',
  authorName: 'Ken Winner',
  name: 'cdk-appsync-transformer',
  repository: 'https://github.com/kcwinner/cdk-appsync-transformer.git',
  stability: 'experimental',
  catalog: {
    twitter: 'KenWin0x539',
  },
  license: 'Apache-2.0',
  workflowNodeVersion: '12.17.0',
  defaultReleaseBranch: 'main',
  typescriptVersion: '^4.1.2',
  keywords: [
    'aws',
    'cdk',
    'appsync',
    'amplify',
  ],
  mergify: false,
  rebuildBot: false,
  codeCov: true,
  dependabotOptions: {
    ignore: [
      { dependencyName: '@aws-cdk*' },
    ],
  },

  jestOptions: {
    jestConfig: {
      testPathIgnorePatterns: [
        '<rootDir>/test/mappedTransformer',
      ],
    },
  },

  // Ignore our generated appsync files
  npmignore: [
    'appsync/*',
  ],
  gitignore: [
    'appsync/*',
  ],

  // Jsii packaging
  python: {
    distName: 'cdk-appsync-transformer',
    module: 'cdk_appsync_transformer',
  },

  // Dependency information
  cdkVersion: '1.77.0',
  cdkDependencies: [
    '@aws-cdk/aws-appsync',
    '@aws-cdk/aws-cognito',
    '@aws-cdk/aws-dynamodb',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/core',
  ],
  devDeps: [
    '@types/deep-diff',
    '@types/jest',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
    'eslint',
    'jest',
    'ts-jest',
  ],
  bundledDeps: [
    'graphql@^14.5.8',
    'graphql-auth-transformer',
    'graphql-connection-transformer',
    'graphql-dynamodb-transformer',
    'graphql-function-transformer',
    'graphql-http-transformer',
    'graphql-key-transformer',
    'graphql-mapping-template',
    'graphql-relational-schema-transformer',
    'graphql-transformer-common',
    'graphql-transformer-core',
    'graphql-ttl-transformer', // Community transformer
    'graphql-versioned-transformer',
  ],
});

// Override the @types/node version so dependabot leaves us alone
project.addDevDeps('@types/node@^10.17.48');

project.synth();
