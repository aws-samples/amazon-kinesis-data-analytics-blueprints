import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_kinesis as kinesis } from 'aws-cdk-lib';
import { KDAConstruct } from '../../../../../cdk-infra/shared/lib/kda-construct';
import { KDAZepConstruct } from '../../../../../cdk-infra/shared/lib/kda-zep-construct';
import { StreamMode } from 'aws-cdk-lib/aws-kinesis';

export interface GlobalProps extends StackProps {
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
  sourceKinesisStreamName: string,
}

export class CdkInfraKdaKdsToS3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: GlobalProps) {
    super(scope, id, props);

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

    const kinesisStream = new kinesis.Stream(this, 'SourceKinesisStream', {
      streamName: props!.sourceKinesisStreamName,
      streamMode: StreamMode.ON_DEMAND,
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

    // our KDA app needs to be able to write metrics
    const accessCWMetricsPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['cloudwatch:PutMetricData'],
        }),
      ],
    });

    // our KDA app needs access to read application jar from S3
    // as well as to write to S3 (from FileSink)
    const accessS3Policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:s3:::${props!.appBucket}/*`,
                      `arn:aws:s3:::${props!.appSinkBucket}/*`],
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

    // our KDA app needs to be able to read from the source Kinesis Data Stream
    const accessKdsPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [`arn:aws:kinesis:${this.region}:${this.account}:stream/${props!.sourceKinesisStreamName}`],
          actions: ['kinesis:DescribeStream',
                    'kinesis:GetShardIterator',
                    'kinesis:GetRecords',
                    'kinesis:PutRecord',
                    'kinesis:PutRecords',
                    'kinesis:ListShards']
        }),
      ],
    });

    const kdaAppRole = new iam.Role(this, 'kda-app-role', {
      assumedBy: new iam.ServicePrincipal('kinesisanalytics.amazonaws.com'),
      description: 'KDA app role',
      inlinePolicies: {
        AccessKDSPolicy: accessKdsPolicy,
        AccessCWLogsPolicy: accessCWLogsPolicy,
        AccessCWMetricsPolicy: accessCWMetricsPolicy,
        AccessS3Policy: accessS3Policy,
        KDAAccessPolicy: kdaAccessPolicy,
        GlueAccessPolicy: glueAccessPolicy,
        GlueGetDBAccessPolicy: glueGetDBAccessPolicy,
      },
    });

    const flinkApplicationProps = {
      "S3DestinationBucket": `s3://${props!.appSinkBucket}/`,
      "KinesisStreamName": props!.sourceKinesisStreamName,
      "AWSRegion": this.region,
      "StreamInitialPosition": "LATEST",
      "PartitionFormat": "yyyy-MM-dd-HH",
    };

    // instantiate kda construct
    const kdaConstruct = new KDAConstruct(this, 'KDAConstruct', {
      account: this.account,
      region: this.region,
      vpc: undefined,
      mskSG: undefined,
      logGroup: logGroup,
      logStream: logStream,
      kdaAppName: props!.kdaAppName,
      appBucket: props!.appBucket,
      appFileKeyOnS3: props!.appFileKeyOnS3,
      runtimeEnvironment: props!.runtimeEnvironment,
      serviceExecutionRole: kdaAppRole.roleArn,
      flinkApplicationProperties: flinkApplicationProps,
      pyFlinkRunOptions: null,
    });

    kdaConstruct.node.addDependency(kinesisStream);
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
        vpc: undefined,
        mskSG: undefined,
        logGroup: logGroup,
        logStream: zepLogStream,
        kdaAppName: zepDataGenAppName,
        glueDatabaseName: props!.glueDatabaseName,
        runtimeEnvironment: props!.runtimeEnvironment,
        serviceExecutionRole: kdaAppRole.roleArn,
        zepFlinkVersion: props!.zepFlinkVersion,
      });

      zepKdaConstruct.node.addDependency(kinesisStream);
      zepKdaConstruct.node.addDependency(kdaAppRole);
      zepKdaConstruct.node.addDependency(logGroup);
      zepKdaConstruct.node.addDependency(zepLogStream);
    }

  } // constructor

  getParams(): void {
    const appTemplateBucket = new cdk.CfnParameter(this, "appTemplateBucket", {
      type: "String",
      description: "The (pre-existing) bucket that will hold the CFN template script and assets."
    });

  }
} // class 