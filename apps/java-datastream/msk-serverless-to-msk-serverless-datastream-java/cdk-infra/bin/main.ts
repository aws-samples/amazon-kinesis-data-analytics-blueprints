#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CdkInfraKdaKafkaToKafkaStack } from "../lib/cdk-infra-kda-kafka-to-kafka";

const app = new cdk.App();

const kdaAppName = app.node.tryGetContext('kdaAppName');
const appBucket = app.node.tryGetContext('appBucket');
const appFileKeyOnS3 = app.node.tryGetContext('appFileKeyOnS3');
const runtimeEnvironment = app.node.tryGetContext('runtimeEnvironment');
const glueDatabaseName = app.node.tryGetContext('glueDatabaseName');
const flinkVersion = app.node.tryGetContext('flinkVersion');
const zepFlinkVersion = app.node.tryGetContext('zepFlinkVersion');
const deployDataGen = app.node.tryGetContext('deployDataGen');
const kdaLogGroup = app.node.tryGetContext('kdaLogGroup');
const kdaLogStream = app.node.tryGetContext('kdaLogStream');
const sourceMskClusterName = app.node.tryGetContext('sourceMskClusterName');
const sinkMskClusterName = app.node.tryGetContext('sinkMskClusterName');

// NOTE: We're not creating a bucket to hold the application jar; we
//       expect there to be a pre-existing bucket. You can modify this stack
//       to also create a bucket instead.
//       Same goes for the bucket that this app will be writing to.
new CdkInfraKdaKafkaToKafkaStack(app, 'CdkInfraKdaKafkaToKafkaStack', {
  region: app.region,
  account: app.account,
  kdaAppName: kdaAppName,
  appBucket: appBucket,
  appFileKeyOnS3: appFileKeyOnS3,
  runtimeEnvironment: runtimeEnvironment,
  deployDataGen: deployDataGen,
  glueDatabaseName: glueDatabaseName,
  flinkVersion: flinkVersion,
  zepFlinkVersion: zepFlinkVersion,
  kdaLogGroup: kdaLogGroup,
  kdaLogStream: kdaLogStream,
  sourceMskClusterName: sourceMskClusterName,
  sinkMskClusterName: sinkMskClusterName,
});