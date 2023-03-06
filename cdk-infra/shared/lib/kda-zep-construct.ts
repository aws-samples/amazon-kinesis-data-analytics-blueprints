import { StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kinesisanalyticsv2 from "aws-cdk-lib/aws-kinesisanalyticsv2";
import { aws_logs as logs } from "aws-cdk-lib";

export interface KDAZepContructProps extends StackProps {
  account?: string;
  region?: string;
  vpc: ec2.Vpc;
  mskSG: ec2.SecurityGroup;
  logGroup: logs.LogGroup;
  logStream: logs.LogStream;
  kdaAppName: string;
  glueDatabaseName: string;
  runtimeEnvironment: string;
  serviceExecutionRole: string;
  zepFlinkVersion: string;
}

export class KDAZepConstruct extends Construct {
  public cfnApplicationProps: kinesisanalyticsv2.CfnApplicationProps;
  public kdaZepApp: kinesisanalyticsv2.CfnApplication;
  public cwlogsOption: kinesisanalyticsv2.CfnApplicationCloudWatchLoggingOption;

  constructor(scope: Construct, id: string, props: KDAZepContructProps) {
    super(scope, id);

    // application properties (actual app is below)
    this.cfnApplicationProps = {
      runtimeEnvironment: "ZEPPELIN-FLINK-2_0",

      // TODO: clearly enumerate list of permissions
      // that this role needs. For instance, for deploying in VPC
      // the KDA app needs VPC read access
      serviceExecutionRole: props.serviceExecutionRole,
      applicationName: props.kdaAppName,
      applicationMode: "INTERACTIVE",

      applicationConfiguration: {
        vpcConfigurations: [
          {
            subnetIds: props.vpc.selectSubnets({
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            }).subnetIds,
            securityGroupIds: [props.mskSG.securityGroupId],
          },
        ],
        zeppelinApplicationConfiguration: {
          monitoringConfiguration: {
            logLevel: "INFO",
          },
          catalogConfiguration: {
            glueDataCatalogConfiguration: {
              databaseArn: `arn:aws:glue:${props.region}:${props.account}:database/${props.glueDatabaseName}`,
            },
          }, // catalogConfiguration
          customArtifactsConfiguration: [
            {
              artifactType: "DEPENDENCY_JAR",
              mavenReference: {
                groupId: "org.apache.flink",
                artifactId: "flink-connector-kafka_2.12",
                version: "1.13.2",
              },
            },
            {
              artifactType: "DEPENDENCY_JAR",
              mavenReference: {
                groupId: "software.amazon.msk",
                artifactId: "aws-msk-iam-auth",
                version: "1.1.0",
              },
            },
          ], // customArtifactsConfiguration
        }, // zeppelinApplicationConfiguration
      },
    };

    // application
    this.kdaZepApp = new kinesisanalyticsv2.CfnApplication(
      this,
      "KDAZepApp",
      this.cfnApplicationProps
    );

    // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/iam-access-control-overview-cwl.html
    const logStreamArn =
      `arn:aws:logs:${props.region}` +
      `:${props.account}:log-group:` +
      `${props.logGroup.logGroupName}:log-stream:${props.logStream.logStreamName}`;

    // cw logging config for app
    this.cwlogsOption =
      new kinesisanalyticsv2.CfnApplicationCloudWatchLoggingOption(
        this,
        "KDAZepCWLogs",
        {
          applicationName: props.kdaAppName,
          cloudWatchLoggingOption: {
            logStreamArn: logStreamArn,
          },
        }
      );

    this.cwlogsOption.addDependency(this.kdaZepApp);
  }
}
