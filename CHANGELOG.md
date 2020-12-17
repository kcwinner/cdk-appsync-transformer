# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 1.77.3 (2020-12-17)


### Bug Fixes

* Add in new prop to support xray on appsync api ([#74](https://github.com/ken/cdk-appsync-transformer/issues/74)) ([af87250](https://github.com/ken/cdk-appsync-transformer/commit/af872503ff6c67a0bc887bbeb4720a7774d573be))

### 1.77.2 (2020-12-10)


### Bug Fixes

* adding in [@http](https://github.com/http) directive support ([#65](https://github.com/ken/cdk-appsync-transformer/issues/65)) ([edc0a78](https://github.com/ken/cdk-appsync-transformer/commit/edc0a78c3db5d964eed23323c3b0b33219bd235f))

### 1.77.1 (2020-12-10)


### Features

* added a convenience method for adding lambda datasource and resolvers

### Bug Fixes

* added much needed type safety
* added in additional unit tests
* upgraded some packages

### BREAKING CHANGES

* makes FUNCTION_RESOLVERS output a map of function names with an array of resolvers for ease of use
* renamed a lot of interfaces to use camelCase to satisfy jsii

## 1.77.0 (2020-12-09)


### Features

* bump cdk version ^1.77.0 ([#58](https://github.com/ken/cdk-appsync-transformer/issues/58)) ([5bc0dae](https://github.com/ken/cdk-appsync-transformer/commit/5bc0daea7498dc096391b2d1acfcf8d17a9f5dd3))

## 1.76.0 (2020-12-09)


### Features

* bump cdk version 1.76.0 ([#57](https://github.com/ken/cdk-appsync-transformer/issues/57)) ([88ec501](https://github.com/ken/cdk-appsync-transformer/commit/88ec501a6eac2ff9e03b6a07c5e1a158521b4c62))

## 1.75.0 (2020-12-09)


### Features

* bump cdk version to 1.75.0 ([#56](https://github.com/ken/cdk-appsync-transformer/issues/56)) ([9ce67e7](https://github.com/ken/cdk-appsync-transformer/commit/9ce67e7f390205bf37d8f0b4a30cbf0172faced1))

## 1.74.0 (2020-12-09)


### Features

* bump cdk version to 1.74 ([#55](https://github.com/ken/cdk-appsync-transformer/issues/55)) ([4ef13a4](https://github.com/ken/cdk-appsync-transformer/commit/4ef13a43f69bbcdddf47c71864d64e5d24b6c474))

## 1.73.0 (2020-12-09)


### Features

* bump cdk version to 1.73.0 ([#54](https://github.com/ken/cdk-appsync-transformer/issues/54)) ([0be9665](https://github.com/ken/cdk-appsync-transformer/commit/0be966528b51e86307e2f567e8e661b54e786a47))

## 1.72.0 (2020-12-09)


### Features

* bump cdk version to 1.72.0 ([#53](https://github.com/ken/cdk-appsync-transformer/issues/53)) ([c3dce49](https://github.com/ken/cdk-appsync-transformer/commit/c3dce49b2e1cae50fa05cd73cd3d6ec4dff6e2e8))

## 1.71.0 (2020-12-08)


### Features

* Bump cdk version to 1.71.0 ([34720a4](https://github.com/ken/cdk-appsync-transformer/commit/34720a4dea6314570f734fb674ad93852933305f))

### 1.70.1 (2020-11-29)


### Bug Fixes

* fixing the cdk transformer so that it won't operate on null fields ([#45](https://github.com/ken/cdk-appsync-transformer/issues/45)) ([b181070](https://github.com/ken/cdk-appsync-transformer/commit/b1810709c63da24f0b810b89866bf0c225047d4b))

## 1.70.0 (2020-11-29)


### Features

* bumping cdk version to 1.70.0 ([#44](https://github.com/ken/cdk-appsync-transformer/issues/44)) ([46346e5](https://github.com/ken/cdk-appsync-transformer/commit/46346e5d64c3bcacab4fe6f8c9a34b97f3a15216))

### 1.68.1 (2020-11-29)

## 1.68.0 (2020-11-29)


### Features

* bumping cdk version to 1.68.0 ([#42](https://github.com/ken/cdk-appsync-transformer/issues/42)) ([f6bb045](https://github.com/ken/cdk-appsync-transformer/commit/f6bb0454c796fda107cca1011677c4ea160a3439))

## 1.67.0 (2020-11-29)

### 1.66.1 (2020-11-29)

### 1.65.2 (2020-11-29)

### 1.65.1 (2020-11-09)

## 1.65.0 (2020-11-08)

### Changes

* Upgrading to 1.65.0 of the CDK

## 1.64.0 (2020-11-01)

### Changes

* Upgrading to 1.64.0 of the CDK
* Configured by _projen_ now

## 1.63.0-rc.3 (2020-09-30)

### Changes

* Pinning AWS CDK version to 1.63.0

## 1.63.0-rc.2 (2020-09-30)

### Bugfixes

* Fixed a bug with @key directive where it wouldn't properly create resolvers when the @key had a custom query field
  * Cleaned up the way resolvers are mapped to tables

## 1.63.0-rc.1 (2020-09-24)

### Updates / Bugfixes

* Updating for changes to CDK v1.63+

## 1.50.0-rc.1 (2020-08-30)

### Features

* Adding in experimental support for function directives. See README for details.

## 1.50.0-alpha (2020-07-07)

### Bugfixes

* Fixed circular reference with the nested stack
* Changed scope of the `appsyncGraphQLEndpointOutput` to correctly be the main stack

## 1.49.1-alpha (2020-07-06)

### Features

* Initial release
