import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { aws_logs as logs } from 'aws-cdk-lib';
import { KDAConstruct } from '../../../../../cdk-infra/shared/lib/kda-construct';
import { KDAZepConstruct } from '../../../../../cdk-infra/shared/lib/kda-zep-construct';
import { MSKServerlessContruct } from '../../../../../cdk-infra/shared/lib/msk-serverless-construct';
import { TopicCreationLambdaConstruct } from '../../../../../cdk-infra/shared/lib/msk-topic-creation-lambda-construct';

export interface GlobalProps extends StackProps {
  account?: string;
  region?: string;
  kdaAppName: string,
  appBucket: string,
  appFileKeyOnS3: string,
  runtimeEnvironment: string,
  appSinkBucket: string,
  deployDataGen: boolean,
  glueDatabaseName: string,
  flinkVersion: string,
  zepFlinkVersion: string,
  kdaLogGroup: string,
  kdaLogStream: string,
  mskClusterName: string,
  sourceTopicName: string,
}

export class CdkInfraKdaKafkaToS3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: GlobalProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'VPC', {
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet-1',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ]
    });

    // security group for MSK access
    const mskSG = new ec2.SecurityGroup(this, 'mskSG', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'MSK Security Group'
    });

    mskSG.connections.allowInternally(ec2.Port.allTraffic(), 'Allow all traffic between hosts having the same security group');

    // create cw log group and log stream
    // so it can be used when creating kda app
    const logGroup = new logs.LogGroup(this, 'KDALogGroup', {
      logGroupName: props!.kdaLogGroup,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const logStream = new logs.LogStream(this, 'KDALogStream', {
      logGroup: logGroup,

      logStreamName: props!.kdaLogStream,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const lambdaAssetLocation = '../../../../cdk-infra/shared/lambda/kafka-topic-gen-lambda-1.0.jar';

    const topicCreationLambda = new TopicCreationLambdaConstruct(this, 'TopicCreationLambda', {
      account: this.account,
      region: this.region,
      vpc: vpc,
      clusterNamesForPermission: [props!.mskClusterName],
      mskSG: mskSG,
      lambdaAssetLocation: lambdaAssetLocation,
    });

    // instantiate source serverless MSK cluster w/ IAM auth
    const sourceServerlessMskCluster = new MSKServerlessContruct(this, 'MSKServerlessSource', {
      account: this.account,
      region: this.region,
      vpc: vpc,
      clusterName: props!.mskClusterName,
      mskSG: mskSG,
      topicToCreate: props!.sourceTopicName,
      onEventLambdaFn: topicCreationLambda.onEventLambdaFn,
    });

    sourceServerlessMskCluster.node.addDependency(vpc);
    sourceServerlessMskCluster.node.addDependency(topicCreationLambda);

    // our KDA app needs to be the following permissions against MSK
    // - read data
    // - write data
    // - create topics
    const accessMSKPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:kafka:${this.region}:${this.account}:cluster/${props!.mskClusterName}/*`,
                      `arn:aws:kafka:${this.region}:${this.account}:topic/${props!.mskClusterName}/*`],
          actions: ['kafka-cluster:Connect',
                    'kafka-cluster:CreateTopic',
                    'kafka-cluster:DescribeTopic',
                    'kafka-cluster:WriteData',
                    'kafka-cluster:DescribeGroup',
                    'kafka-cluster:AlterGroup',
                    'kafka-cluster:ReadData',
                    ],
        }),
      ],
    });

    const accessMSKTopicsPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:kafka:${this.region}:${this.account}:topic/${props!.mskClusterName}/*`],
          actions: ['kafka-cluster:CreateTopic',
                    'kafka-cluster:DescribeTopic',
                    'kafka-cluster:WriteData',
                    'kafka-cluster:DescribeGroup',
                    'kafka-cluster:AlterGroup',
                    'kafka-cluster:ReadData',
                    ],
        }),
      ],
    });

    // our KDA app needs to be able to log
    const accessCWLogsPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:${props!.kdaLogGroup}:*`],
          actions: ['logs:PutLogEvents',
                    'logs:DescribeLogGroups',
                    'logs:DescribeLogStreams'
                   ],
        }),
      ],
    });

    // our KDA app needs access to read application jar from S3
    // as well as to write to S3 (from FileSink)
    const accessS3Policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:s3:::${props!.appBucket}`,
                      `arn:aws:s3:::${props!.appSinkBucket}`],
          actions: ['s3:ListBucket',
                    's3:PutObject',
                    's3:GetObject',
                    's3:DeleteObject'
                    ],
        }),
      ],
    });

    // our KDA app needs access to describe kinesisanalytics
    const kdaAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['kinesisanalytics:DescribeApplication']
        }),
      ],
    });

    // our KDA app needs access to access glue db
    const glueAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:glue:${this.region}:${this.account}:database/${props!.glueDatabaseName}`,
                      `arn:aws:glue:${this.region}:${this.account}:table/${props!.glueDatabaseName}/*`,
                      `arn:aws:glue:${this.region}:${this.account}:catalog`],
          actions: ['glue:*Database*', 'glue:*Table*']
        }),
      ],
    });

    // our KDA app needs to be able to GetDatabase, GetUserDefinedFunction and GetPartitions
    const glueGetDBAccessPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['glue:GetDatabase',
                    'glue:GetUserDefinedFunction',
                    'glue:GetPartitions']
        }),
      ],
    });

    // our KDA app needs access to perform VPC actions
    const accessVPCPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['ec2:DeleteNetworkInterface',
                    'ec2:DescribeDhcpOptions',
                    'ec2:DescribeSecurityGroups',
                    'ec2:CreateNetworkInterface',
                    'ec2:DescribeNetworkInterfaces',
                    'ec2:CreateNetworkInterfacePermission',
                    'ec2:DescribeVpcs',
                    'ec2:DescribeSubnets'],
        }),
      ],
    });

    const kdaAppRole = new iam.Role(this, 'kda-app-role', {
      assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com'),
      description: 'KDA app role',
      inlinePolicies: {
        AccessMSKPolicy: accessMSKPolicy,
        AccessMSKTopicsPolicy: accessMSKTopicsPolicy,
        AccessCWLogsPolicy: accessCWLogsPolicy,
        AccessS3Policy: accessS3Policy,
        AccessVPCPolicy: accessVPCPolicy,
        KDAAccessPolicy: kdaAccessPolicy,
        GlueAccessPolicy: glueAccessPolicy,
        GlueGetDBAccessPolicy: glueGetDBAccessPolicy,
      },
    });

    const flinkApplicationProps = {
      "S3DestinationBucket": props!.appSinkBucket,
      "ServerlessMSKBootstrapServers": sourceServerlessMskCluster.bootstrapServersOutput.value,
      "KafkaSourceTopic": props!.sourceTopicName,
      "KafkaConsumerGroupId": "KDAFlinkConsumerGroup",
    };

    // instantiate kda construct
    const kdaConstruct = new KDAConstruct(this, 'KDAConstruct', {
      account: this.account,
      region: this.region,
      vpc: vpc,
      mskSG: mskSG,
      logGroup: logGroup,
      logStream: logStream,
      kdaAppName: props!.kdaAppName,
      appBucket: props!.appBucket,
      appFileKeyOnS3: props!.appFileKeyOnS3,
      runtimeEnvironment: props!.runtimeEnvironment,
      serviceExecutionRole: kdaAppRole.roleArn,
      flinkApplicationProperties: flinkApplicationProps,
    });

    kdaConstruct.node.addDependency(vpc);
    kdaConstruct.node.addDependency(sourceServerlessMskCluster);
    kdaConstruct.node.addDependency(kdaAppRole);
    kdaConstruct.node.addDependency(logGroup);
    kdaConstruct.node.addDependency(logStream);

    // instantiate zep kda construct
    if (props?.deployDataGen) {
      const zepDataGenAppName = props!.kdaAppName + "-zep";

      const zepLogStream = new logs.LogStream(this, 'ZepLogStream', {
        logGroup: logGroup,
  
        logStreamName: props!.kdaLogStream + "-zep",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      const zepKdaConstruct = new KDAZepConstruct(this, 'KDAZepConstruct', {
        account: this.account,
        region: this.region,
        vpc: vpc,
        mskSG: mskSG,
        logGroup: logGroup,
        logStream: zepLogStream,
        kdaAppName: zepDataGenAppName,
        glueDatabaseName: props!.glueDatabaseName,
        runtimeEnvironment: props!.runtimeEnvironment,
        serviceExecutionRole: kdaAppRole.roleArn,
        zepFlinkVersion: props!.zepFlinkVersion,
      });

      zepKdaConstruct.node.addDependency(vpc);
      zepKdaConstruct.node.addDependency(sourceServerlessMskCluster);
      zepKdaConstruct.node.addDependency(kdaAppRole);
      zepKdaConstruct.node.addDependency(logGroup);
      zepKdaConstruct.node.addDependency(zepLogStream);
    }

  } // constructor
} // class 