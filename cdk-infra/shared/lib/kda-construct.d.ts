import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kinesisanalyticsv2 from 'aws-cdk-lib/aws-kinesisanalyticsv2';
import { aws_logs as logs } from 'aws-cdk-lib';
export interface KDAContructProps extends StackProps {
    account: string;
    region: string;
    vpc: ec2.Vpc;
    mskSG: ec2.SecurityGroup;
    logGroup: logs.LogGroup;
    logStream: logs.LogStream;
    kdaAppName: string;
    appBucket: string;
    appFileKeyOnS3: string;
    appSinkBucket: string;
    runtimeEnvironment: string;
    serviceExecutionRole: string;
    bootstrapServersString: string;
    serverlessBootstrapServersString: string;
}
export declare class KDAConstruct extends Construct {
    cfnApplicationProps: kinesisanalyticsv2.CfnApplicationProps;
    kdaApp: kinesisanalyticsv2.CfnApplication;
    cwlogsOption: kinesisanalyticsv2.CfnApplicationCloudWatchLoggingOption;
    constructor(scope: Construct, id: string, props: KDAContructProps);
}
