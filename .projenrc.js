const { JsiiProject } = require('projen');

const project = new JsiiProject({
  authorAddress: "kcswinner@gmail.com",
  authorName: "Ken Winner",
  name: "cdk-appsync-transformer",
  repository: "https://github.com/ken/cdk-appsync-transformer.git",
  stability: "experimental",
  license: 'Apache-2.0',
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
    "aws-cdk@1.63.0",
    "@aws-cdk/assert@1.63.0",
    "@types/jest",
    "@types/node",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/parser",
    "eslint",
    "jest",
    "jsii",
    "jsii-docgen",
    "jsii-pacmak",
    "jsii-release",
    "ts-jest"
  ],
  deps: [
    "@aws-cdk/aws-appsync@1.63.0",
    "@aws-cdk/aws-cognito@1.63.0",
    "@aws-cdk/aws-dynamodb@1.63.0",
    "@aws-cdk/aws-iam@1.63.0",
    "@aws-cdk/aws-lambda@1.63.0",
    "@aws-cdk/core@1.63.0",
    "@types/graphql@14.5.0",
    "cloudform-types@^5.0.0",
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
    "@aws-cdk/aws-appsync@1.63.0",
    "@aws-cdk/aws-cognito@1.63.0",
    "@aws-cdk/aws-dynamodb@1.63.0",
    "@aws-cdk/aws-iam@1.63.0",
    "@aws-cdk/aws-lambda@1.63.0",
    "@aws-cdk/core@1.63.0",
    "constructs"
  ],
  bundledDeps: [
    "@types/graphql",
    "cloudform-types",
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
