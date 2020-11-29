# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
