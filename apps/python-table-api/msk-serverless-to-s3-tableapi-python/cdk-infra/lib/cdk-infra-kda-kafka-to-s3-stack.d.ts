import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface GlobalProps extends StackProps {
    kdaAppName: string;
    appBucket: string;
    appFileKeyOnS3: string;
    runtimeEnvironment: string;
    appSinkBucket: string;
}
export declare class CdkInfraKdaKafkaToS3Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: GlobalProps);
}
