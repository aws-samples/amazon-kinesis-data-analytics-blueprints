import { CfnOutput, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { aws_msk as msk } from 'aws-cdk-lib';
export interface MSKServerlessContructProps extends StackProps {
    account: string;
    region: string;
    vpc: ec2.Vpc;
    clusterName: string;
    mskSG: ec2.SecurityGroup;
}
export declare class MSKServerlessContruct extends Construct {
    cfnMskServerlessCluster: msk.CfnServerlessCluster;
    cfnClusterArnOutput: CfnOutput;
    bootstrapServersOutput: CfnOutput;
    constructor(scope: Construct, id: string, props: MSKServerlessContructProps);
}
