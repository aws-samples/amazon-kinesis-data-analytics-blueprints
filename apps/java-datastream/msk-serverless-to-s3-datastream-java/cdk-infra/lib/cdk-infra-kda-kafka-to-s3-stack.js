"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkInfraKdaKafkaToS3Stack = void 0;
const cdk = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const iam = require("aws-cdk-lib/aws-iam");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const kda_construct_1 = require("../../../../../cdk-infra/shared/lib/kda-construct");
const kda_zep_construct_1 = require("../../../../../cdk-infra/shared/lib/kda-zep-construct");
const msk_serverless_construct_1 = require("../../../../../cdk-infra/shared/lib/msk-serverless-construct");
const msk_topic_creation_lambda_construct_1 = require("../../../../../cdk-infra/shared/lib/msk-topic-creation-lambda-construct");
class CdkInfraKdaKafkaToS3Stack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const logGroup = new aws_cdk_lib_1.aws_logs.LogGroup(this, 'KDALogGroup', {
            logGroupName: props.kdaLogGroup,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const logStream = new aws_cdk_lib_1.aws_logs.LogStream(this, 'KDALogStream', {
            logGroup: logGroup,
            logStreamName: props.kdaLogStream,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // This is the code for the lambda function that auto-creates the source topic
        // We need to pass in the path from the calling location
        const lambdaAssetLocation = '../../../../cdk-infra/shared/lambda/kafka-topic-gen-lambda-1.0.jar';
        const topicCreationLambda = new msk_topic_creation_lambda_construct_1.TopicCreationLambdaConstruct(this, 'TopicCreationLambda', {
            account: this.account,
            region: this.region,
            vpc: vpc,
            clusterNamesForPermission: [props.mskClusterName],
            mskSG: mskSG,
            lambdaAssetLocation: lambdaAssetLocation,
        });
        // instantiate source serverless MSK cluster w/ IAM auth
        const sourceServerlessMskCluster = new msk_serverless_construct_1.MSKServerlessContruct(this, 'MSKServerlessSource', {
            account: this.account,
            region: this.region,
            vpc: vpc,
            clusterName: props.mskClusterName,
            mskSG: mskSG,
            topicToCreate: props.sourceTopicName,
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
                    resources: [`arn:aws:kafka:${this.region}:${this.account}:cluster/${props.mskClusterName}/*`,
                        `arn:aws:kafka:${this.region}:${this.account}:topic/${props.mskClusterName}/*`],
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
                    resources: [`arn:aws:kafka:${this.region}:${this.account}:topic/${props.mskClusterName}/*`],
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
                    resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:${props.kdaLogGroup}:*`],
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
                    resources: [`arn:aws:s3:::${props.appBucket}/*`,
                        `arn:aws:s3:::${props.appSinkBucket}/*`],
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
                    resources: [`arn:aws:glue:${this.region}:${this.account}:database/${props.glueDatabaseName}`,
                        `arn:aws:glue:${this.region}:${this.account}:table/${props.glueDatabaseName}/*`,
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
                AccessCWMetricsPolicy: accessCWMetricsPolicy,
                AccessS3Policy: accessS3Policy,
                AccessVPCPolicy: accessVPCPolicy,
                KDAAccessPolicy: kdaAccessPolicy,
                GlueAccessPolicy: glueAccessPolicy,
                GlueGetDBAccessPolicy: glueGetDBAccessPolicy,
            },
        });
        const flinkApplicationProps = {
            "S3DestinationBucket": `s3://${props.appSinkBucket}/`,
            "ServerlessMSKBootstrapServers": sourceServerlessMskCluster.bootstrapServersOutput.value,
            "KafkaSourceTopic": props.sourceTopicName,
            "KafkaConsumerGroupId": "KDAFlinkConsumerGroup",
            "PartitionFormat": "yyyy-MM-dd-HH",
        };
        // instantiate kda construct
        const kdaConstruct = new kda_construct_1.KDAConstruct(this, 'KDAConstruct', {
            account: this.account,
            region: this.region,
            vpc: vpc,
            mskSG: mskSG,
            logGroup: logGroup,
            logStream: logStream,
            kdaAppName: props.kdaAppName,
            appBucket: props.appBucket,
            appFileKeyOnS3: props.appFileKeyOnS3,
            runtimeEnvironment: props.runtimeEnvironment,
            serviceExecutionRole: kdaAppRole.roleArn,
            flinkApplicationProperties: flinkApplicationProps,
            pyFlinkRunOptions: null,
        });
        kdaConstruct.node.addDependency(vpc);
        kdaConstruct.node.addDependency(sourceServerlessMskCluster);
        kdaConstruct.node.addDependency(kdaAppRole);
        kdaConstruct.node.addDependency(logGroup);
        kdaConstruct.node.addDependency(logStream);
        // instantiate zep kda construct
        if (props === null || props === void 0 ? void 0 : props.deployDataGen) {
            const zepDataGenAppName = props.kdaAppName + "-zep";
            const zepLogStream = new aws_cdk_lib_1.aws_logs.LogStream(this, 'ZepLogStream', {
                logGroup: logGroup,
                logStreamName: props.kdaLogStream + "-zep",
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            const zepKdaConstruct = new kda_zep_construct_1.KDAZepConstruct(this, 'KDAZepConstruct', {
                account: this.account,
                region: this.region,
                vpc: vpc,
                mskSG: mskSG,
                logGroup: logGroup,
                logStream: zepLogStream,
                kdaAppName: zepDataGenAppName,
                glueDatabaseName: props.glueDatabaseName,
                runtimeEnvironment: props.runtimeEnvironment,
                serviceExecutionRole: kdaAppRole.roleArn,
                zepFlinkVersion: props.zepFlinkVersion,
            });
            zepKdaConstruct.node.addDependency(vpc);
            zepKdaConstruct.node.addDependency(sourceServerlessMskCluster);
            zepKdaConstruct.node.addDependency(kdaAppRole);
            zepKdaConstruct.node.addDependency(logGroup);
            zepKdaConstruct.node.addDependency(zepLogStream);
        }
    } // constructor
} // class 
exports.CdkInfraKdaKafkaToS3Stack = CdkInfraKdaKafkaToS3Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWluZnJhLWtkYS1rYWZrYS10by1zMy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1pbmZyYS1rZGEta2Fma2EtdG8tczMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBR25DLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsNkNBQStDO0FBQy9DLHFGQUFpRjtBQUNqRiw2RkFBd0Y7QUFDeEYsMkdBQXFHO0FBQ3JHLGlJQUF1SDtBQWtCdkgsTUFBYSx5QkFBMEIsU0FBUSxHQUFHLENBQUMsS0FBSztJQUN0RCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW1CO1FBQzNELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU07UUFDTixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtZQUNuQyxrQkFBa0IsRUFBRSxJQUFJO1lBQ3hCLGdCQUFnQixFQUFFLElBQUk7WUFDdEIsTUFBTSxFQUFFLENBQUM7WUFDVCxXQUFXLEVBQUUsQ0FBQztZQUNkLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsaUJBQWlCO29CQUN2QixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNO2lCQUNsQztnQkFDRDtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsU0FBUztvQkFDZixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7aUJBQy9DO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxnQ0FBZ0M7UUFDaEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDakQsR0FBRyxFQUFFLEdBQUc7WUFDUixnQkFBZ0IsRUFBRSxJQUFJO1lB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NUQsUUFBUSxFQUFFLFFBQVE7Z0JBRWxCLGFBQWEsRUFBRSxLQUFNLENBQUMsWUFBWSxHQUFHLE1BQU07Z0JBQzNDLGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87YUFDekMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxlQUFlLEdBQUcsSUFBSSxtQ0FBZSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtnQkFDbkUsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO2dCQUNyQixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07Z0JBQ25CLEdBQUcsRUFBRSxHQUFHO2dCQUNSLEtBQUssRUFBRSxLQUFLO2dCQUNaLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixTQUFTLEVBQUUsWUFBWTtnQkFDdkIsVUFBVSxFQUFFLGlCQUFpQjtnQkFDN0IsZ0JBQWdCLEVBQUUsS0FBTSxDQUFDLGdCQUFnQjtnQkFDekMsa0JBQWtCLEVBQUUsS0FBTSxDQUFDLGtCQUFrQjtnQkFDN0Msb0JBQW9CLEVBQUUsVUFBVSxDQUFDLE9BQU87Z0JBQ3hDLGVBQWUsRUFBRSxLQUFNLENBQUMsZUFBZTthQUN4QyxDQUFDLENBQUM7WUFFSCxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4QyxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1lBQy9ELGVBQWUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQy9DLGVBQWUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzdDLGVBQWUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQ2xEO0lBRUgsQ0FBQyxDQUFDLGNBQWM7Q0FDakIsQ0FBQyxTQUFTO0FBdlJYLDhEQXVSQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBTdGFja1Byb3BzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBhd3NfbG9ncyBhcyBsb2dzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgS0RBQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY2RrLWluZnJhL3NoYXJlZC9saWIva2RhLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBLREFaZXBDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jZGstaW5mcmEvc2hhcmVkL2xpYi9rZGEtemVwLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBNU0tTZXJ2ZXJsZXNzQ29udHJ1Y3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jZGstaW5mcmEvc2hhcmVkL2xpYi9tc2stc2VydmVybGVzcy1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgVG9waWNDcmVhdGlvbkxhbWJkYUNvbnN0cnVjdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Nkay1pbmZyYS9zaGFyZWQvbGliL21zay10b3BpYy1jcmVhdGlvbi1sYW1iZGEtY29uc3RydWN0JztcblxuZXhwb3J0IGludGVyZmFjZSBHbG9iYWxQcm9wcyBleHRlbmRzIFN0YWNrUHJvcHMge1xuICBrZGFBcHBOYW1lOiBzdHJpbmcsXG4gIGFwcEJ1Y2tldDogc3RyaW5nLFxuICBhcHBGaWxlS2V5T25TMzogc3RyaW5nLFxuICBydW50aW1lRW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgYXBwU2lua0J1Y2tldDogc3RyaW5nLFxuICBkZXBsb3lEYXRhR2VuOiBib29sZWFuLFxuICBnbHVlRGF0YWJhc2VOYW1lOiBzdHJpbmcsXG4gIGZsaW5rVmVyc2lvbjogc3RyaW5nLFxuICB6ZXBGbGlua1ZlcnNpb246IHN0cmluZyxcbiAga2RhTG9nR3JvdXA6IHN0cmluZyxcbiAga2RhTG9nU3RyZWFtOiBzdHJpbmcsXG4gIG1za0NsdXN0ZXJOYW1lOiBzdHJpbmcsXG4gIHNvdXJjZVRvcGljTmFtZTogc3RyaW5nLFxufVxuXG5leHBvcnQgY2xhc3MgQ2RrSW5mcmFLZGFLYWZrYVRvUzNTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogR2xvYmFsUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFZQQ1xuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdWUEMnLCB7XG4gICAgICBlbmFibGVEbnNIb3N0bmFtZXM6IHRydWUsXG4gICAgICBlbmFibGVEbnNTdXBwb3J0OiB0cnVlLFxuICAgICAgbWF4QXpzOiAzLFxuICAgICAgbmF0R2F0ZXdheXM6IDEsXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ3B1YmxpYy1zdWJuZXQtMScsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdwcml2YXRlJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICB9XG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBzZWN1cml0eSBncm91cCBmb3IgTVNLIGFjY2Vzc1xuICAgIGNvbnN0IG1za1NHID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdtc2tTRycsIHtcbiAgICAgIHZwYzogdnBjLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTVNLIFNlY3VyaXR5IEdyb3VwJ1xuICAgIH0pO1xuXG4gICAgbXNrU0cuY29ubmVjdGlvbnMuYWxsb3dJbnRlcm5hbGx5KGVjMi5Qb3J0LmFsbFRyYWZmaWMoKSwgJ0FsbG93IGFsbCB0cmFmZmljIGJldHdlZW4gaG9zdHMgaGF2aW5nIHRoZSBzYW1lIHNlY3VyaXR5IGdyb3VwJyk7XG5cbiAgICAvLyBjcmVhdGUgY3cgbG9nIGdyb3VwIGFuZCBsb2cgc3RyZWFtXG4gICAgLy8gc28gaXQgY2FuIGJlIHVzZWQgd2hlbiBjcmVhdGluZyBrZGEgYXBwXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnS0RBTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IHByb3BzIS5rZGFMb2dHcm91cCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgY29uc3QgbG9nU3RyZWFtID0gbmV3IGxvZ3MuTG9nU3RyZWFtKHRoaXMsICdLREFMb2dTdHJlYW0nLCB7XG4gICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG5cbiAgICAgIGxvZ1N0cmVhbU5hbWU6IHByb3BzIS5rZGFMb2dTdHJlYW0sXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gVGhpcyBpcyB0aGUgY29kZSBmb3IgdGhlIGxhbWJkYSBmdW5jdGlvbiB0aGF0IGF1dG8tY3JlYXRlcyB0aGUgc291cmNlIHRvcGljXG4gICAgLy8gV2UgbmVlZCB0byBwYXNzIGluIHRoZSBwYXRoIGZyb20gdGhlIGNhbGxpbmcgbG9jYXRpb25cbiAgICBjb25zdCBsYW1iZGFBc3NldExvY2F0aW9uID0gJy4uLy4uLy4uLy4uL2Nkay1pbmZyYS9zaGFyZWQvbGFtYmRhL2thZmthLXRvcGljLWdlbi1sYW1iZGEtMS4wLmphcic7XG5cbiAgICBjb25zdCB0b3BpY0NyZWF0aW9uTGFtYmRhID0gbmV3IFRvcGljQ3JlYXRpb25MYW1iZGFDb25zdHJ1Y3QodGhpcywgJ1RvcGljQ3JlYXRpb25MYW1iZGEnLCB7XG4gICAgICBhY2NvdW50OiB0aGlzLmFjY291bnQsXG4gICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgdnBjOiB2cGMsXG4gICAgICBjbHVzdGVyTmFtZXNGb3JQZXJtaXNzaW9uOiBbcHJvcHMhLm1za0NsdXN0ZXJOYW1lXSxcbiAgICAgIG1za1NHOiBtc2tTRyxcbiAgICAgIGxhbWJkYUFzc2V0TG9jYXRpb246IGxhbWJkYUFzc2V0TG9jYXRpb24sXG4gICAgfSk7XG5cbiAgICAvLyBpbnN0YW50aWF0ZSBzb3VyY2Ugc2VydmVybGVzcyBNU0sgY2x1c3RlciB3LyBJQU0gYXV0aFxuICAgIGNvbnN0IHNvdXJjZVNlcnZlcmxlc3NNc2tDbHVzdGVyID0gbmV3IE1TS1NlcnZlcmxlc3NDb250cnVjdCh0aGlzLCAnTVNLU2VydmVybGVzc1NvdXJjZScsIHtcbiAgICAgIGFjY291bnQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICB2cGM6IHZwYyxcbiAgICAgIGNsdXN0ZXJOYW1lOiBwcm9wcyEubXNrQ2x1c3Rlck5hbWUsXG4gICAgICBtc2tTRzogbXNrU0csXG4gICAgICB0b3BpY1RvQ3JlYXRlOiBwcm9wcyEuc291cmNlVG9waWNOYW1lLFxuICAgICAgb25FdmVudExhbWJkYUZuOiB0b3BpY0NyZWF0aW9uTGFtYmRhLm9uRXZlbnRMYW1iZGFGbixcbiAgICB9KTtcblxuICAgIHNvdXJjZVNlcnZlcmxlc3NNc2tDbHVzdGVyLm5vZGUuYWRkRGVwZW5kZW5jeSh2cGMpO1xuICAgIHNvdXJjZVNlcnZlcmxlc3NNc2tDbHVzdGVyLm5vZGUuYWRkRGVwZW5kZW5jeSh0b3BpY0NyZWF0aW9uTGFtYmRhKTtcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIHRvIGJlIHRoZSBmb2xsb3dpbmcgcGVybWlzc2lvbnMgYWdhaW5zdCBNU0tcbiAgICAvLyAtIHJlYWQgZGF0YVxuICAgIC8vIC0gd3JpdGUgZGF0YVxuICAgIC8vIC0gY3JlYXRlIHRvcGljc1xuICAgIGNvbnN0IGFjY2Vzc01TS1BvbGljeSA9IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6a2Fma2E6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmNsdXN0ZXIvJHtwcm9wcyEubXNrQ2x1c3Rlck5hbWV9LypgLFxuICAgICAgICAgICAgICAgICAgICAgIGBhcm46YXdzOmthZmthOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTp0b3BpYy8ke3Byb3BzIS5tc2tDbHVzdGVyTmFtZX0vKmBdLFxuICAgICAgICAgIGFjdGlvbnM6IFsna2Fma2EtY2x1c3RlcjpDb25uZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgJ2thZmthLWNsdXN0ZXI6Q3JlYXRlVG9waWMnLFxuICAgICAgICAgICAgICAgICAgICAna2Fma2EtY2x1c3RlcjpEZXNjcmliZVRvcGljJyxcbiAgICAgICAgICAgICAgICAgICAgJ2thZmthLWNsdXN0ZXI6V3JpdGVEYXRhJyxcbiAgICAgICAgICAgICAgICAgICAgJ2thZmthLWNsdXN0ZXI6RGVzY3JpYmVHcm91cCcsXG4gICAgICAgICAgICAgICAgICAgICdrYWZrYS1jbHVzdGVyOkFsdGVyR3JvdXAnLFxuICAgICAgICAgICAgICAgICAgICAna2Fma2EtY2x1c3RlcjpSZWFkRGF0YScsXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFjY2Vzc01TS1RvcGljc1BvbGljeSA9IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6a2Fma2E6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRvcGljLyR7cHJvcHMhLm1za0NsdXN0ZXJOYW1lfS8qYF0sXG4gICAgICAgICAgYWN0aW9uczogWydrYWZrYS1jbHVzdGVyOkNyZWF0ZVRvcGljJyxcbiAgICAgICAgICAgICAgICAgICAgJ2thZmthLWNsdXN0ZXI6RGVzY3JpYmVUb3BpYycsXG4gICAgICAgICAgICAgICAgICAgICdrYWZrYS1jbHVzdGVyOldyaXRlRGF0YScsXG4gICAgICAgICAgICAgICAgICAgICdrYWZrYS1jbHVzdGVyOkRlc2NyaWJlR3JvdXAnLFxuICAgICAgICAgICAgICAgICAgICAna2Fma2EtY2x1c3RlcjpBbHRlckdyb3VwJyxcbiAgICAgICAgICAgICAgICAgICAgJ2thZmthLWNsdXN0ZXI6UmVhZERhdGEnLFxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBvdXIgS0RBIGFwcCBuZWVkcyB0byBiZSBhYmxlIHRvIGxvZ1xuICAgIGNvbnN0IGFjY2Vzc0NXTG9nc1BvbGljeSA9IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOiR7cHJvcHMhLmtkYUxvZ0dyb3VwfToqYF0sXG4gICAgICAgICAgYWN0aW9uczogWydsb2dzOlB1dExvZ0V2ZW50cycsXG4gICAgICAgICAgICAgICAgICAgICdsb2dzOkRlc2NyaWJlTG9nR3JvdXBzJyxcbiAgICAgICAgICAgICAgICAgICAgJ2xvZ3M6RGVzY3JpYmVMb2dTdHJlYW1zJ1xuICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIHRvIGJlIGFibGUgdG8gd3JpdGUgbWV0cmljc1xuICAgIGNvbnN0IGFjY2Vzc0NXTWV0cmljc1BvbGljeSA9IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICBhY3Rpb25zOiBbJ2Nsb3Vkd2F0Y2g6UHV0TWV0cmljRGF0YSddLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBvdXIgS0RBIGFwcCBuZWVkcyBhY2Nlc3MgdG8gcmVhZCBhcHBsaWNhdGlvbiBqYXIgZnJvbSBTM1xuICAgIC8vIGFzIHdlbGwgYXMgdG8gd3JpdGUgdG8gUzMgKGZyb20gRmlsZVNpbmspXG4gICAgY29uc3QgYWNjZXNzUzNQb2xpY3kgPSBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOnMzOjo6JHtwcm9wcyEuYXBwQnVja2V0fS8qYCxcbiAgICAgICAgICAgICAgICAgICAgICBgYXJuOmF3czpzMzo6OiR7cHJvcHMhLmFwcFNpbmtCdWNrZXR9LypgXSxcbiAgICAgICAgICBhY3Rpb25zOiBbJ3MzOkxpc3RCdWNrZXQnLFxuICAgICAgICAgICAgICAgICAgICAnczM6UHV0T2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIGFjY2VzcyB0byBkZXNjcmliZSBraW5lc2lzYW5hbHl0aWNzXG4gICAgY29uc3Qga2RhQWNjZXNzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsna2luZXNpc2FuYWx5dGljczpEZXNjcmliZUFwcGxpY2F0aW9uJ11cbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gb3VyIEtEQSBhcHAgbmVlZHMgYWNjZXNzIHRvIGFjY2VzcyBnbHVlIGRiXG4gICAgY29uc3QgZ2x1ZUFjY2Vzc1BvbGljeSA9IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgcmVzb3VyY2VzOiBbYGFybjphd3M6Z2x1ZToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZGF0YWJhc2UvJHtwcm9wcyEuZ2x1ZURhdGFiYXNlTmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICAgIGBhcm46YXdzOmdsdWU6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhYmxlLyR7cHJvcHMhLmdsdWVEYXRhYmFzZU5hbWV9LypgLFxuICAgICAgICAgICAgICAgICAgICAgIGBhcm46YXdzOmdsdWU6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmNhdGFsb2dgXSxcbiAgICAgICAgICBhY3Rpb25zOiBbJ2dsdWU6KkRhdGFiYXNlKicsICdnbHVlOipUYWJsZSonXVxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBvdXIgS0RBIGFwcCBuZWVkcyB0byBiZSBhYmxlIHRvIEdldERhdGFiYXNlLCBHZXRVc2VyRGVmaW5lZEZ1bmN0aW9uIGFuZCBHZXRQYXJ0aXRpb25zXG4gICAgY29uc3QgZ2x1ZUdldERCQWNjZXNzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsnZ2x1ZTpHZXREYXRhYmFzZScsXG4gICAgICAgICAgICAgICAgICAgICdnbHVlOkdldFVzZXJEZWZpbmVkRnVuY3Rpb24nLFxuICAgICAgICAgICAgICAgICAgICAnZ2x1ZTpHZXRQYXJ0aXRpb25zJ11cbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gb3VyIEtEQSBhcHAgbmVlZHMgYWNjZXNzIHRvIHBlcmZvcm0gVlBDIGFjdGlvbnNcbiAgICBjb25zdCBhY2Nlc3NWUENQb2xpY3kgPSBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgYWN0aW9uczogWydlYzI6RGVsZXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVEaGNwT3B0aW9ucycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVTZWN1cml0eUdyb3VwcycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6Q3JlYXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVOZXR3b3JrSW50ZXJmYWNlcycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6Q3JlYXRlTmV0d29ya0ludGVyZmFjZVBlcm1pc3Npb24nLFxuICAgICAgICAgICAgICAgICAgICAnZWMyOkRlc2NyaWJlVnBjcycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVTdWJuZXRzJ10sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGtkYUFwcFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ2tkYS1hcHAtcm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdraW5lc2lzYW5hbHl0aWNzLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnS0RBIGFwcCByb2xlJyxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIEFjY2Vzc01TS1BvbGljeTogYWNjZXNzTVNLUG9saWN5LFxuICAgICAgICBBY2Nlc3NNU0tUb3BpY3NQb2xpY3k6IGFjY2Vzc01TS1RvcGljc1BvbGljeSxcbiAgICAgICAgQWNjZXNzQ1dMb2dzUG9saWN5OiBhY2Nlc3NDV0xvZ3NQb2xpY3ksXG4gICAgICAgIEFjY2Vzc0NXTWV0cmljc1BvbGljeTogYWNjZXNzQ1dNZXRyaWNzUG9saWN5LFxuICAgICAgICBBY2Nlc3NTM1BvbGljeTogYWNjZXNzUzNQb2xpY3ksXG4gICAgICAgIEFjY2Vzc1ZQQ1BvbGljeTogYWNjZXNzVlBDUG9saWN5LFxuICAgICAgICBLREFBY2Nlc3NQb2xpY3k6IGtkYUFjY2Vzc1BvbGljeSxcbiAgICAgICAgR2x1ZUFjY2Vzc1BvbGljeTogZ2x1ZUFjY2Vzc1BvbGljeSxcbiAgICAgICAgR2x1ZUdldERCQWNjZXNzUG9saWN5OiBnbHVlR2V0REJBY2Nlc3NQb2xpY3ksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgZmxpbmtBcHBsaWNhdGlvblByb3BzID0ge1xuICAgICAgXCJTM0Rlc3RpbmF0aW9uQnVja2V0XCI6IGBzMzovLyR7cHJvcHMhLmFwcFNpbmtCdWNrZXR9L2AsXG4gICAgICBcIlNlcnZlcmxlc3NNU0tCb290c3RyYXBTZXJ2ZXJzXCI6IHNvdXJjZVNlcnZlcmxlc3NNc2tDbHVzdGVyLmJvb3RzdHJhcFNlcnZlcnNPdXRwdXQudmFsdWUsXG4gICAgICBcIkthZmthU291cmNlVG9waWNcIjogcHJvcHMhLnNvdXJjZVRvcGljTmFtZSxcbiAgICAgIFwiS2Fma2FDb25zdW1lckdyb3VwSWRcIjogXCJLREFGbGlua0NvbnN1bWVyR3JvdXBcIixcbiAgICAgIFwiUGFydGl0aW9uRm9ybWF0XCI6IFwieXl5eS1NTS1kZC1ISFwiLFxuICAgIH07XG5cbiAgICAvLyBpbnN0YW50aWF0ZSBrZGEgY29uc3RydWN0XG4gICAgY29uc3Qga2RhQ29uc3RydWN0ID0gbmV3IEtEQUNvbnN0cnVjdCh0aGlzLCAnS0RBQ29uc3RydWN0Jywge1xuICAgICAgYWNjb3VudDogdGhpcy5hY2NvdW50LFxuICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIHZwYzogdnBjLFxuICAgICAgbXNrU0c6IG1za1NHLFxuICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgbG9nU3RyZWFtOiBsb2dTdHJlYW0sXG4gICAgICBrZGFBcHBOYW1lOiBwcm9wcyEua2RhQXBwTmFtZSxcbiAgICAgIGFwcEJ1Y2tldDogcHJvcHMhLmFwcEJ1Y2tldCxcbiAgICAgIGFwcEZpbGVLZXlPblMzOiBwcm9wcyEuYXBwRmlsZUtleU9uUzMsXG4gICAgICBydW50aW1lRW52aXJvbm1lbnQ6IHByb3BzIS5ydW50aW1lRW52aXJvbm1lbnQsXG4gICAgICBzZXJ2aWNlRXhlY3V0aW9uUm9sZToga2RhQXBwUm9sZS5yb2xlQXJuLFxuICAgICAgZmxpbmtBcHBsaWNhdGlvblByb3BlcnRpZXM6IGZsaW5rQXBwbGljYXRpb25Qcm9wcyxcbiAgICAgIHB5RmxpbmtSdW5PcHRpb25zOiBudWxsLFxuICAgIH0pO1xuXG4gICAga2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeSh2cGMpO1xuICAgIGtkYUNvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3koc291cmNlU2VydmVybGVzc01za0NsdXN0ZXIpO1xuICAgIGtkYUNvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3koa2RhQXBwUm9sZSk7XG4gICAga2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeShsb2dHcm91cCk7XG4gICAga2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeShsb2dTdHJlYW0pO1xuXG4gICAgLy8gaW5zdGFudGlhdGUgemVwIGtkYSBjb25zdHJ1Y3RcbiAgICBpZiAocHJvcHM/LmRlcGxveURhdGFHZW4pIHtcbiAgICAgIGNvbnN0IHplcERhdGFHZW5BcHBOYW1lID0gcHJvcHMhLmtkYUFwcE5hbWUgKyBcIi16ZXBcIjtcblxuICAgICAgY29uc3QgemVwTG9nU3RyZWFtID0gbmV3IGxvZ3MuTG9nU3RyZWFtKHRoaXMsICdaZXBMb2dTdHJlYW0nLCB7XG4gICAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgXG4gICAgICAgIGxvZ1N0cmVhbU5hbWU6IHByb3BzIS5rZGFMb2dTdHJlYW0gKyBcIi16ZXBcIixcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB6ZXBLZGFDb25zdHJ1Y3QgPSBuZXcgS0RBWmVwQ29uc3RydWN0KHRoaXMsICdLREFaZXBDb25zdHJ1Y3QnLCB7XG4gICAgICAgIGFjY291bnQ6IHRoaXMuYWNjb3VudCxcbiAgICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgdnBjOiB2cGMsXG4gICAgICAgIG1za1NHOiBtc2tTRyxcbiAgICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgICBsb2dTdHJlYW06IHplcExvZ1N0cmVhbSxcbiAgICAgICAga2RhQXBwTmFtZTogemVwRGF0YUdlbkFwcE5hbWUsXG4gICAgICAgIGdsdWVEYXRhYmFzZU5hbWU6IHByb3BzIS5nbHVlRGF0YWJhc2VOYW1lLFxuICAgICAgICBydW50aW1lRW52aXJvbm1lbnQ6IHByb3BzIS5ydW50aW1lRW52aXJvbm1lbnQsXG4gICAgICAgIHNlcnZpY2VFeGVjdXRpb25Sb2xlOiBrZGFBcHBSb2xlLnJvbGVBcm4sXG4gICAgICAgIHplcEZsaW5rVmVyc2lvbjogcHJvcHMhLnplcEZsaW5rVmVyc2lvbixcbiAgICAgIH0pO1xuXG4gICAgICB6ZXBLZGFDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KHZwYyk7XG4gICAgICB6ZXBLZGFDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KHNvdXJjZVNlcnZlcmxlc3NNc2tDbHVzdGVyKTtcbiAgICAgIHplcEtkYUNvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3koa2RhQXBwUm9sZSk7XG4gICAgICB6ZXBLZGFDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KGxvZ0dyb3VwKTtcbiAgICAgIHplcEtkYUNvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3koemVwTG9nU3RyZWFtKTtcbiAgICB9XG5cbiAgfSAvLyBjb25zdHJ1Y3RvclxufSAvLyBjbGFzcyAiXX0=