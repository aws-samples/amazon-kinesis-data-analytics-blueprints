import { IResolvable, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kinesisanalyticsv2 from 'aws-cdk-lib/aws-kinesisanalyticsv2';
import { aws_logs as logs } from 'aws-cdk-lib';


export interface KDAContructProps extends StackProps {
    account: string,
    region: string,
    vpc: ec2.Vpc | undefined | null,
    mskSG: ec2.SecurityGroup | undefined | null,
    logGroup: logs.LogGroup,
    logStream: logs.LogStream,
    kdaAppName: string,
    appBucket: string,
    appFileKeyOnS3: string,
    runtimeEnvironment: string,
    serviceExecutionRole: string,
    flinkApplicationProperties: { [key: string]: string; } | undefined,
    pyFlinkRunOptions:  { [key: string]: string; } | undefined | null,
}

export class KDAConstruct extends Construct {
    public cfnApplicationProps: kinesisanalyticsv2.CfnApplicationProps;
    public kdaApp: kinesisanalyticsv2.CfnApplication;
    public cwlogsOption: kinesisanalyticsv2.CfnApplicationCloudWatchLoggingOption;

    constructor(scope: Construct, id: string, props: KDAContructProps) {
        super(scope, id);

        let propertyGroups = [
            {
                propertyGroupId: "FlinkApplicationProperties",
                propertyMap: props.flinkApplicationProperties
            }
        ];

        if(props!.pyFlinkRunOptions != null) {
            propertyGroups.push({
                propertyGroupId: "kinesis.analytics.flink.run.options",
                propertyMap: props!.pyFlinkRunOptions
            });
        }

        let vpcConfigurations = undefined as IResolvable | (IResolvable | kinesisanalyticsv2.CfnApplication.VpcConfigurationProperty)[] | undefined;
        if(props!.vpc != undefined &&
           props!.mskSG != undefined) {
            vpcConfigurations = [
                {
                    subnetIds: props.vpc.selectSubnets({
                        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                      }).subnetIds,
                    securityGroupIds: [props.mskSG.securityGroupId]
                }
            ]
        }

        // application properties (actual app is below)
        this.cfnApplicationProps = {
            runtimeEnvironment: props.runtimeEnvironment,

            serviceExecutionRole: props.serviceExecutionRole,
            applicationName: props.kdaAppName,

            applicationConfiguration: {
                flinkApplicationConfiguration: {
                    checkpointConfiguration: {
                        configurationType: 'CUSTOM',
                        checkpointingEnabled: true,
                        checkpointInterval: 60000,
                        minPauseBetweenCheckpoints: 5000
                    },
                    monitoringConfiguration: {
                        configurationType: "CUSTOM",
                        metricsLevel: "OPERATOR",
                        logLevel: "INFO"
                    },
                    parallelismConfiguration: {
                        configurationType: "CUSTOM",
                        parallelism: 2,
                        parallelismPerKpu: 1,
                        autoScalingEnabled: false
                    }
                },
                vpcConfigurations: vpcConfigurations,
                environmentProperties: {
                    propertyGroups: propertyGroups
                },
                applicationCodeConfiguration: {
                    codeContent: {
                        s3ContentLocation: {
                            bucketArn: `arn:aws:s3:::${props.appBucket}`,
                            fileKey: props.appFileKeyOnS3
                        }
                    },
                    codeContentType: "ZIPFILE"
                },
                applicationSnapshotConfiguration: {
                    snapshotsEnabled: false
                }
            }
        }

        // application
        this.kdaApp =
           new kinesisanalyticsv2.CfnApplication(this, 'KDAApp', this.cfnApplicationProps);

        // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/iam-access-control-overview-cwl.html
        const logStreamArn = `arn:aws:logs:${props.region}` +
        `:${props.account}:log-group:` +
        `${props.logGroup.logGroupName}:log-stream:${props.logStream.logStreamName}`;

        // cw logging config for app
        this.cwlogsOption = new kinesisanalyticsv2.CfnApplicationCloudWatchLoggingOption(
            this,
            'KDACWLogs',
            {
                applicationName: props.kdaAppName,
                cloudWatchLoggingOption: {
                    logStreamArn: logStreamArn
                }
            }
        );

        this.cwlogsOption.addDependency(this.kdaApp);

    }
}