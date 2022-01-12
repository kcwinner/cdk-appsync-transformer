const { awscdk, javascript } = require('projen');

const project = new awscdk.AwsCdkConstructLibrary({
  authorAddress: 'kcswinner@gmail.com',
  authorName: 'Ken Winner',
  name: 'cdk-appsync-transformer',
  repository: 'https://github.com/kcwinner/cdk-appsync-transformer.git',
  stability: 'experimental',
  catalog: {
    twitter: 'KenWin0x539',
  },
  license: 'Apache-2.0',
  defaultReleaseBranch: 'main',
  keywords: [
    'aws',
    'cdk',
    'appsync',
    'amplify',
  ],

  // Until we merge v2 into main
  majorVersion: 1,
  releaseBranches: {
    'feat/cdk-v2-upgrade': {
      majorVersion: 2,
      npmDistTag: 'next',
      prerelease: 'alpha',
      workflowName: 'release-cdk-v2',
    },
  },

  codeCov: true,
  githubOptions: {
    mergify: false,
  },

  packageManager: javascript.NodePackageManager.NPM,

  dependabot: true,
  dependabotOptions: {
    ignoreProjen: true,
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
    'customtest/*',
  ],
  gitignore: [
    'appsync/*',
    'customtest/*',
  ],

  // Jsii packaging
  python: {
    distName: 'cdk-appsync-transformer',
    module: 'cdk_appsync_transformer',
  },

  // Dependency information
  cdkVersion: '1.138.0',
  cdkDependenciesAsDeps: false,
  cdkDependencies: [
    '@aws-cdk/aws-appsync',
    '@aws-cdk/aws-cognito',
    '@aws-cdk/aws-dynamodb',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/core',
  ],
  devDeps: [
    '@aws-cdk/aws-appsync',
    '@aws-cdk/aws-cognito',
    '@aws-cdk/aws-dynamodb',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/core',
    '@types/deep-diff',
    '@types/jest',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
    'eslint',
    'jest',
    'ts-jest',
    'cloudform-types@^4.2.0',
  ],
  bundledDeps: [
    // Amplify packages rely on this pinned version
    'graphql@^14.5.8',

    // New Amplify libraries
    '@aws-amplify/graphql-auth-transformer',
    '@aws-amplify/graphql-default-value-transformer',
    '@aws-amplify/graphql-function-transformer',
    '@aws-amplify/graphql-http-transformer',
    '@aws-amplify/graphql-index-transformer',
    '@aws-amplify/graphql-model-transformer',
    '@aws-amplify/graphql-relational-transformer',
    '@aws-amplify/graphql-transformer-core',
    '@aws-amplify/graphql-transformer-interfaces',

    // Still needed
    'graphql-transformer-common',
    'graphql-mapping-template',

    'graphql-ttl-transformer', // Community transformer

    // 'graphql-auth-transformer',
    // 'graphql-connection-transformer',
    // 'graphql-dynamodb-transformer',
    // 'graphql-function-transformer',
    // 'graphql-http-transformer',
    // 'graphql-index-transformer',
    // 'graphql-key-transformer',
    // 'graphql-relational-schema-transformer',
    // 'graphql-transformer-core',
    // 'graphql-versioned-transformer',
  ],
});

// const unbumpTask = project.tasks.tryFind('unbump');
// unbumpTask.exec('git checkout package-lock.json');

project.eslint.overrides.push({
  files: [
    'custom-vtl-transformer.ts',
  ],
  rules: {
    'import/no-extraneous-dependencies': 'off',
  },
});

project.synth();
