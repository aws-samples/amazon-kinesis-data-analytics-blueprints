"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkInfraKdaKafkaToS3Stack = void 0;
const cdk = require("aws-cdk-lib");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const ec2 = require("aws-cdk-lib/aws-ec2");
const iam = require("aws-cdk-lib/aws-iam");
const aws_cdk_lib_2 = require("aws-cdk-lib");
const kda_construct_1 = require("../../../../../cdk-infra/shared/lib/kda-construct");
const kda_zep_construct_1 = require("../../../../../cdk-infra/shared/lib/kda-zep-construct");
const msk_serverless_construct_1 = require("../../../../../cdk-infra/shared/lib/msk-serverless-construct");
class CdkInfraKdaKafkaToS3Stack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Parameters
        const kdaAppName = new aws_cdk_lib_1.CfnParameter(this, "kdaAppName", {
            type: "String",
            default: props === null || props === void 0 ? void 0 : props.kdaAppName,
            description: "The name of your KDA application."
        });
        const appBucket = new aws_cdk_lib_1.CfnParameter(this, "appBucket", {
            type: "String",
            default: props === null || props === void 0 ? void 0 : props.appBucket,
            description: "The (pre-existing) bucket that will hold the KDA application JAR."
        });
        const appFileKeyOnS3 = new aws_cdk_lib_1.CfnParameter(this, "appFileKeyOnS3", {
            type: "String",
            default: props === null || props === void 0 ? void 0 : props.appFileKeyOnS3,
            description: "The file key of the application JAR on S3."
        });
        const runtimeEnvironment = new aws_cdk_lib_1.CfnParameter(this, "runtimeEnvironment", {
            type: "String",
            default: props === null || props === void 0 ? void 0 : props.runtimeEnvironment,
            description: "Flink runtime environment."
        });
        const appSinkBucket = new aws_cdk_lib_1.CfnParameter(this, "appSinkBucket", {
            type: "String",
            default: props === null || props === void 0 ? void 0 : props.appSinkBucket,
            description: "The (pre-existing) bucket that the Flink app will write to."
        });
        const zepGlueCatalog = new aws_cdk_lib_1.CfnParameter(this, "zepGlueCatalog", {
            type: "String",
            default: "myGlueCatalog",
            description: "Glue data catalog associated with Zeppelin datagen app."
        });
        const kdaLogGroup = new aws_cdk_lib_1.CfnParameter(this, "kdaLogGroup", {
            type: "String",
            default: "myLogGroup",
            description: "Log group for KDA app."
        });
        const kdaLogStream = new aws_cdk_lib_1.CfnParameter(this, "kdaLogStream", {
            type: "String",
            default: "myLogStream",
            description: "Log stream for KDA app."
        });
        const zepLogStream = new aws_cdk_lib_1.CfnParameter(this, "zepLogStream", {
            type: "String",
            default: "myZepLogStream",
            description: "Log stream for Zeppelin datagen app."
        });
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
        // security group for SSH
        // in case we decide to setup a instance to 'do stuff'
        // in the VPC
        const sshSG = new ec2.SecurityGroup(this, 'mySG', {
            vpc: vpc,
            allowAllOutbound: true,
            description: 'SSH Security Group'
        });
        sshSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH frm anywhere');
        // security group for MSK access
        const mskSG = new ec2.SecurityGroup(this, 'mskSG', {
            vpc: vpc,
            allowAllOutbound: true,
            description: 'MSK Security Group'
        });
        mskSG.connections.allowInternally(ec2.Port.allTraffic(), 'Allow all traffic between hosts having the same security group');
        // create cw log group and log stream
        // so it can be used when creating kda app
        const logGroup = new aws_cdk_lib_2.aws_logs.LogGroup(this, 'KT KDA Log Group', {
            logGroupName: kdaLogGroup.valueAsString,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const logStream = new aws_cdk_lib_2.aws_logs.LogStream(this, 'KT KDA Logstream', {
            logGroup: logGroup,
            logStreamName: kdaLogStream.valueAsString,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // instantiate serverless MSK cluster w/ IAM auth
        const serverlessMskCluster = new msk_serverless_construct_1.MSKServerlessContruct(this, 'MSKServerless', {
            account: this.account,
            region: this.region,
            vpc: vpc,
            clusterName: 'ktServerlessMSKCluster',
            mskSG: mskSG,
        });
        serverlessMskCluster.node.addDependency(vpc);
        // policies for kda role (TODO: Narrow down access)
        // our KDA app needs to be able to read from Kafka (source)
        const accessMSKPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    resources: ['*'],
                    actions: ['kafka-cluster:*'],
                }),
            ],
        });
        // our KDA app needs to be able to log
        const accessCWLogsPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    resources: ['*'],
                    actions: ['logs:*'],
                }),
            ],
        });
        // our KDA app needs access to read application jar from S3
        // as well as to write to S3 (from FileSink)
        const accessS3Policy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    resources: ['*'],
                    actions: ['s3:*'],
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
                    resources: ['*'],
                    actions: ['glue:*']
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
                AccessCWLogsPolicy: accessCWLogsPolicy,
                AccessS3Policy: accessS3Policy,
                AccessVPCPolicy: accessVPCPolicy,
                KDAAccessPolicy: kdaAccessPolicy,
                GlueAccessPolicy: glueAccessPolicy,
            },
        });
        // instantiate kda construct
        const kdaConstruct = new kda_construct_1.KDAConstruct(this, 'KDAConstruct', {
            account: this.account,
            region: this.region,
            vpc: vpc,
            mskSG: mskSG,
            logGroup: logGroup,
            logStream: logStream,
            kdaAppName: kdaAppName.valueAsString,
            appBucket: appBucket.valueAsString,
            appFileKeyOnS3: appFileKeyOnS3.valueAsString,
            appSinkBucket: appSinkBucket.valueAsString,
            runtimeEnvironment: runtimeEnvironment.valueAsString,
            serviceExecutionRole: kdaAppRole.roleArn,
            bootstrapServersString: 'none',
            serverlessBootstrapServersString: serverlessMskCluster.bootstrapServersOutput.value,
        });
        kdaConstruct.node.addDependency(vpc);
        kdaConstruct.node.addDependency(serverlessMskCluster);
        kdaConstruct.node.addDependency(kdaAppRole);
        // instantiate zep kda construct
        if (props === null || props === void 0 ? void 0 : props.deployDataGen) {
            const zepDataGenAppName = new aws_cdk_lib_1.CfnParameter(this, "zepDataGenAppName", {
                type: "String",
                default: (props === null || props === void 0 ? void 0 : props.kdaAppName) + "-zep",
                description: "The name of your Zeppelin datagen application."
            });
            const zepLogStream = new aws_cdk_lib_2.aws_logs.LogStream(this, 'KT KDA Logstream Zep', {
                logGroup: logGroup,
                logStreamName: 'ktKDALogstreamZep',
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            });
            const zepKdaConstruct = new kda_zep_construct_1.KDAZepConstruct(this, 'KDAZepConstruct', {
                account: this.account,
                region: this.region,
                vpc: vpc,
                mskSG: mskSG,
                logGroup: logGroup,
                logStream: zepLogStream,
                kdaAppName: zepDataGenAppName.valueAsString,
                glueDataCatalog: zepGlueCatalog.valueAsString,
                runtimeEnvironment: runtimeEnvironment.valueAsString,
                serviceExecutionRole: kdaAppRole.roleArn,
            });
            zepKdaConstruct.node.addDependency(vpc);
            zepKdaConstruct.node.addDependency(serverlessMskCluster);
            zepKdaConstruct.node.addDependency(kdaAppRole);
        }
    } // constructor
} // class 
exports.CdkInfraKdaKafkaToS3Stack = CdkInfraKdaKafkaToS3Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWluZnJhLWtkYS1rYWZrYS10by1zMy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1pbmZyYS1rZGEta2Fma2EtdG8tczMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLDZDQUEyRTtBQUUzRSwyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLDZDQUErQztBQUMvQyxxRkFBaUY7QUFDakYsNkZBQXdGO0FBQ3hGLDJHQUFxRztBQVdyRyxNQUFhLHlCQUEwQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3RELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBbUI7UUFDM0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsYUFBYTtRQUNiLE1BQU0sVUFBVSxHQUFHLElBQUksMEJBQVksQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3RELElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxVQUFVO1lBQzFCLFdBQVcsRUFBRSxtQ0FBbUM7U0FDakQsQ0FBQyxDQUFDO1FBRUgsTUFBTSxTQUFTLEdBQUcsSUFBSSwwQkFBWSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDcEQsSUFBSSxFQUFFLFFBQVE7WUFDZCxPQUFPLEVBQUUsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLFNBQVM7WUFDekIsV0FBVyxFQUFFLG1FQUFtRTtTQUNqRixDQUFDLENBQUM7UUFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLDBCQUFZLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzlELElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxjQUFjO1lBQzlCLFdBQVcsRUFBRSw0Q0FBNEM7U0FDMUQsQ0FBQyxDQUFDO1FBRUgsTUFB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VUFBVSxFQUFFLGlCQUFpQixDQUFDLGFBQWE7Z0JBQzNDLGVBQWUsRUFBRSxjQUFjLENBQUMsYUFBYTtnQkFDN0Msa0JBQWtCLEVBQUUsa0JBQWtCLENBQUMsYUFBYTtnQkFDcEQsb0JBQW9CLEVBQUUsVUFBVSxDQUFDLE9BQU87YUFDekMsQ0FBQyxDQUFDO1lBRUgsZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDeEMsZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsQ0FBQztZQUN6RCxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNoRDtJQUVILENBQUMsQ0FBQyxjQUFjO0NBQ2pCLENBQUMsU0FBUztBQXRRWCw4REFzUUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ2ZuUGFyYW1ldGVyLCBFbnZpcm9ubWVudCwgU3RhY2ssIFN0YWNrUHJvcHMgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGVjMiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWMyJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCB7IGF3c19sb2dzIGFzIGxvZ3MgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBLREFDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jZGstaW5mcmEvc2hhcmVkL2xpYi9rZGEtY29uc3RydWN0JztcbmltcG9ydCB7IEtEQVplcENvbnN0cnVjdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Nkay1pbmZyYS9zaGFyZWQvbGliL2tkYS16ZXAtY29uc3RydWN0JztcbmltcG9ydCB7IE1TS1NlcnZlcmxlc3NDb250cnVjdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Nkay1pbmZyYS9zaGFyZWQvbGliL21zay1zZXJ2ZXJsZXNzLWNvbnN0cnVjdCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR2xvYmFsUHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAga2RhQXBwTmFtZTogc3RyaW5nLFxuICBhcHBCdWNrZXQ6IHN0cmluZyxcbiAgYXBwRmlsZUtleU9uUzM6IHN0cmluZyxcbiAgcnVudGltZUVudmlyb25tZW50OiBzdHJpbmcsXG4gIGFwcFNpbmtCdWNrZXQ6IHN0cmluZyxcbiAgZGVwbG95RGF0YUdlbjogYm9vbGVhbixcbn1cblxuZXhwb3J0IGNsYXNzIENka0luZnJhS2RhS2Fma2FUb1MzU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IEdsb2JhbFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBQYXJhbWV0ZXJzXG4gICAgY29uc3Qga2RhQXBwTmFtZSA9IG5ldyBDZm5QYXJhbWV0ZXIodGhpcywgXCJrZGFBcHBOYW1lXCIsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZWZhdWx0OiBwcm9wcz8ua2RhQXBwTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSBuYW1lIG9mIHlvdXIgS0RBIGFwcGxpY2F0aW9uLlwiXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcHBCdWNrZXQgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwiYXBwQnVja2V0XCIsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZWZhdWx0OiBwcm9wcz8uYXBwQnVja2V0LFxuICAgICAgZGVzY3JpcHRpb246IFwiVGhlIChwcmUtZXhpc3RpbmcpIGJ1Y2tldCB0aGF0IHdpbGwgaG9sZCB0aGUgS0RBIGFwcGxpY2F0aW9uIEpBUi5cIlxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBwRmlsZUtleU9uUzMgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwiYXBwRmlsZUtleU9uUzNcIiwge1xuICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgIGRlZmF1bHQ6IHByb3BzPy5hcHBGaWxlS2V5T25TMyxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSBmaWxlIGtleSBvZiB0aGUgYXBwbGljYXRpb24gSkFSIG9uIFMzLlwiXG4gICAgfSk7XG5cbiAgICBjb25zdCBydW50aW1lRW52aXJvbm1lbnQgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwicnVudGltZUVudmlyb25tZW50XCIsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZWZhdWx0OiBwcm9wcz8ucnVudGltZUVudmlyb25tZW50LFxuICAgICAgZGVzY3JpcHRpb246IFwiRmxpbmsgcnVudGltZSBlbnZpcm9ubWVudC5cIlxuICAgIH0pO1xuXG4gICAgY29uc3QgYXBwU2lua0J1Y2tldCA9IG5ldyBDZm5QYXJhbWV0ZXIodGhpcywgXCJhcHBTaW5rQnVja2V0XCIsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZWZhdWx0OiBwcm9wcz8uYXBwU2lua0J1Y2tldCxcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRoZSAocHJlLWV4aXN0aW5nKSBidWNrZXQgdGhhdCB0aGUgRmxpbmsgYXBwIHdpbGwgd3JpdGUgdG8uXCJcbiAgICB9KTtcblxuICAgIGNvbnN0IHplcEdsdWVDYXRhbG9nID0gbmV3IENmblBhcmFtZXRlcih0aGlzLCBcInplcEdsdWVDYXRhbG9nXCIsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZWZhdWx0OiBcIm15R2x1ZUNhdGFsb2dcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkdsdWUgZGF0YSBjYXRhbG9nIGFzc29jaWF0ZWQgd2l0aCBaZXBwZWxpbiBkYXRhZ2VuIGFwcC5cIlxuICAgIH0pO1xuXG4gICAgY29uc3Qga2RhTG9nR3JvdXAgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwia2RhTG9nR3JvdXBcIiwge1xuICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgIGRlZmF1bHQ6IFwibXlMb2dHcm91cFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTG9nIGdyb3VwIGZvciBLREEgYXBwLlwiXG4gICAgfSk7XG5cbiAgICBjb25zdCBrZGFMb2dTdHJlYW0gPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwia2RhTG9nU3RyZWFtXCIsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZWZhdWx0OiBcIm15TG9nU3RyZWFtXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJMb2cgc3RyZWFtIGZvciBLREEgYXBwLlwiXG4gICAgfSk7XG5cbiAgICBjb25zdCB6ZXBMb2dTdHJlYW0gPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwiemVwTG9nU3RyZWFtXCIsIHtcbiAgICAgIHR5cGU6IFwiU3RyaW5nXCIsXG4gICAgICBkZWZhdWx0OiBcIm15WmVwTG9nU3RyZWFtXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJMb2cgc3RyZWFtIGZvciBaZXBwZWxpbiBkYXRhZ2VuIGFwcC5cIlxuICAgIH0pO1xuXG4gICAgLy8gVlBDXG4gICAgY29uc3QgdnBjID0gbmV3IGVjMi5WcGModGhpcywgJ1ZQQycsIHtcbiAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgICBtYXhBenM6IDMsXG4gICAgICBuYXRHYXRld2F5czogMSxcbiAgICAgIHN1Ym5ldENvbmZpZ3VyYXRpb246IFtcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiAncHVibGljLXN1Ym5ldC0xJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ3ByaXZhdGUnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIHNlY3VyaXR5IGdyb3VwIGZvciBTU0hcbiAgICAvLyBpbiBjYXNlIHdlIGRlY2lkZSB0byBzZXR1cCBhIGluc3RhbmNlIHRvICdkbyBzdHVmZidcbiAgICAvLyBpbiB0aGUgVlBDXG4gICAgY29uc3Qgc3NoU0cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ215U0cnLCB7XG4gICAgICB2cGM6IHZwYyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NTSCBTZWN1cml0eSBHcm91cCdcbiAgICB9KTtcblxuICAgIHNzaFNHLmFkZEluZ3Jlc3NSdWxlKGVjMi5QZWVyLmFueUlwdjQoKSwgZWMyLlBvcnQudGNwKDIyKSwgJ1NTSCBmcm0gYW55d2hlcmUnKTtcblxuICAgIC8vIHNlY3VyaXR5IGdyb3VwIGZvciBNU0sgYWNjZXNzXG4gICAgY29uc3QgbXNrU0cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ21za1NHJywge1xuICAgICAgdnBjOiB2cGMsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgICAgZGVzY3JpcHRpb246ICdNU0sgU2VjdXJpdHkgR3JvdXAnXG4gICAgfSk7XG5cbiAgICBtc2tTRy5jb25uZWN0aW9ucy5hbGxvd0ludGVybmFsbHkoZWMyLlBvcnQuYWxsVHJhZmZpYygpLCAnQWxsb3cgYWxsIHRyYWZmaWMgYmV0d2VlbiBob3N0cyBoYXZpbmcgdGhlIHNhbWUgc2VjdXJpdHkgZ3JvdXAnKTtcblxuICAgIC8vIGNyZWF0ZSBjdyBsb2cgZ3JvdXAgYW5kIGxvZyBzdHJlYW1cbiAgICAvLyBzbyBpdCBjYW4gYmUgdXNlZCB3aGVuIGNyZWF0aW5nIGtkYSBhcHBcbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdLVCBLREEgTG9nIEdyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBrZGFMb2dHcm91cC52YWx1ZUFzU3RyaW5nLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICBjb25zdCBsb2dTdHJlYW0gPSBuZXcgbG9ncy5Mb2dTdHJlYW0odGhpcywgJ0tUIEtEQSBMb2dzdHJlYW0nLCB7XG4gICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG5cbiAgICAgIGxvZ1N0cmVhbU5hbWU6IGtkYUxvZ1N0cmVhbS52YWx1ZUFzU3RyaW5nLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIGluc3RhbnRpYXRlIHNlcnZlcmxlc3MgTVNLIGNsdXN0ZXIgdy8gSUFNIGF1dGhcbiAgICBjb25zdCBzZXJ2ZXJsZXNzTXNrQ2x1c3RlciA9IG5ldyBNU0tTZXJ2ZXJsZXNzQ29udHJ1Y3QodGhpcywgJ01TS1NlcnZlcmxlc3MnLCB7XG4gICAgICBhY2NvdW50OiB0aGlzLmFjY291bnQsXG4gICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgdnBjOiB2cGMsXG4gICAgICBjbHVzdGVyTmFtZTogJ2t0U2VydmVybGVzc01TS0NsdXN0ZXInLFxuICAgICAgbXNrU0c6IG1za1NHLFxuICAgIH0pO1xuXG4gICAgc2VydmVybGVzc01za0NsdXN0ZXIubm9kZS5hZGREZXBlbmRlbmN5KHZwYyk7XG5cbiAgICAvLyBwb2xpY2llcyBmb3Iga2RhIHJvbGUgKFRPRE86IE5hcnJvdyBkb3duIGFjY2VzcylcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIHRvIGJlIGFibGUgdG8gcmVhZCBmcm9tIEthZmthIChzb3VyY2UpXG4gICAgY29uc3QgYWNjZXNzTVNLUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsna2Fma2EtY2x1c3RlcjoqJ10sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIHRvIGJlIGFibGUgdG8gbG9nXG4gICAgY29uc3QgYWNjZXNzQ1dMb2dzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsnbG9nczoqJ10sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIGFjY2VzcyB0byByZWFkIGFwcGxpY2F0aW9uIGphciBmcm9tIFMzXG4gICAgLy8gYXMgd2VsbCBhcyB0byB3cml0ZSB0byBTMyAoZnJvbSBGaWxlU2luaylcbiAgICBjb25zdCBhY2Nlc3NTM1BvbGljeSA9IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICBhY3Rpb25zOiBbJ3MzOionXSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gb3VyIEtEQSBhcHAgbmVlZHMgYWNjZXNzIHRvIGRlc2NyaWJlIGtpbmVzaXNhbmFseXRpY3NcbiAgICBjb25zdCBrZGFBY2Nlc3NQb2xpY3kgPSBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgYWN0aW9uczogWydraW5lc2lzYW5hbHl0aWNzOkRlc2NyaWJlQXBwbGljYXRpb24nXVxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBvdXIgS0RBIGFwcCBuZWVkcyBhY2Nlc3MgdG8gYWNjZXNzIGdsdWUgZGJcbiAgICBjb25zdCBnbHVlQWNjZXNzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsnZ2x1ZToqJ11cbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gb3VyIEtEQSBhcHAgbmVlZHMgYWNjZXNzIHRvIHBlcmZvcm0gVlBDIGFjdGlvbnNcbiAgICBjb25zdCBhY2Nlc3NWUENQb2xpY3kgPSBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgYWN0aW9uczogWydlYzI6RGVsZXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAnZWMyOkRlc2NyaWJlRGhjcE9wdGlvbnMnLFxuICAgICAgICAgICAgJ2VjMjpEZXNjcmliZVNlY3VyaXR5R3JvdXBzJyxcbiAgICAgICAgICAgICdlYzI6Q3JlYXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAnZWMyOkRlc2NyaWJlTmV0d29ya0ludGVyZmFjZXMnLFxuICAgICAgICAgICAgJ2VjMjpDcmVhdGVOZXR3b3JrSW50ZXJmYWNlUGVybWlzc2lvbicsXG4gICAgICAgICAgICAnZWMyOkRlc2NyaWJlVnBjcycsXG4gICAgICAgICAgICAnZWMyOkRlc2NyaWJlU3VibmV0cyddLFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBrZGFBcHBSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdrZGEtYXBwLXJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgna2luZXNpc2FuYWx5dGljcy5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0tEQSBhcHAgcm9sZScsXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBBY2Nlc3NNU0tQb2xpY3k6IGFjY2Vzc01TS1BvbGljeSxcbiAgICAgICAgQWNjZXNzQ1dMb2dzUG9saWN5OiBhY2Nlc3NDV0xvZ3NQb2xpY3ksXG4gICAgICAgIEFjY2Vzc1MzUG9saWN5OiBhY2Nlc3NTM1BvbGljeSxcbiAgICAgICAgQWNjZXNzVlBDUG9saWN5OiBhY2Nlc3NWUENQb2xpY3ksXG4gICAgICAgIEtEQUFjY2Vzc1BvbGljeToga2RhQWNjZXNzUG9saWN5LFxuICAgICAgICBHbHVlQWNjZXNzUG9saWN5OiBnbHVlQWNjZXNzUG9saWN5LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIGluc3RhbnRpYXRlIGtkYSBjb25zdHJ1Y3RcbiAgICBjb25zdCBrZGFDb25zdHJ1Y3QgPSBuZXcgS0RBQ29uc3RydWN0KHRoaXMsICdLREFDb25zdHJ1Y3QnLCB7XG4gICAgICBhY2NvdW50OiB0aGlzLmFjY291bnQsXG4gICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgdnBjOiB2cGMsXG4gICAgICBtc2tTRzogbXNrU0csXG4gICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gICAgICBsb2dTdHJlYW06IGxvZ1N0cmVhbSxcbiAgICAgIGtkYUFwcE5hbWU6IGtkYUFwcE5hbWUudmFsdWVBc1N0cmluZyxcbiAgICAgIGFwcEJ1Y2tldDogYXBwQnVja2V0LnZhbHVlQXNTdHJpbmcsXG4gICAgICBhcHBGaWxlS2V5T25TMzogYXBwRmlsZUtleU9uUzMudmFsdWVBc1N0cmluZyxcbiAgICAgIGFwcFNpbmtCdWNrZXQ6IGFwcFNpbmtCdWNrZXQudmFsdWVBc1N0cmluZyxcbiAgICAgIHJ1bnRpbWVFbnZpcm9ubWVudDogcnVudGltZUVudmlyb25tZW50LnZhbHVlQXNTdHJpbmcsXG4gICAgICBzZXJ2aWNlRXhlY3V0aW9uUm9sZToga2RhQXBwUm9sZS5yb2xlQXJuLFxuICAgICAgYm9vdHN0cmFwU2VydmVyc1N0cmluZzogJ25vbmUnLCAvL21za0NsdXN0ZXJOb0F1dGguYm9vdHN0cmFwU2VydmVyc091dHB1dC52YWx1ZSxcbiAgICAgIHNlcnZlcmxlc3NCb290c3RyYXBTZXJ2ZXJzU3RyaW5nOiBzZXJ2ZXJsZXNzTXNrQ2x1c3Rlci5ib290c3RyYXBTZXJ2ZXJzT3V0cHV0LnZhbHVlLFxuICAgIH0pO1xuXG4gICAga2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeSh2cGMpO1xuICAgIGtkYUNvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3koc2VydmVybGVzc01za0NsdXN0ZXIpO1xuICAgIGtkYUNvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3koa2RhQXBwUm9sZSk7XG5cbiAgICAvLyBpbnN0YW50aWF0ZSB6ZXAga2RhIGNvbnN0cnVjdFxuICAgIGlmIChwcm9wcz8uZGVwbG95RGF0YUdlbikge1xuICAgICAgY29uc3QgemVwRGF0YUdlbkFwcE5hbWUgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwiemVwRGF0YUdlbkFwcE5hbWVcIiwge1xuICAgICAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgICAgICBkZWZhdWx0OiBwcm9wcz8ua2RhQXBwTmFtZSArIFwiLXplcFwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJUaGUgbmFtZSBvZiB5b3VyIFplcHBlbGluIGRhdGFnZW4gYXBwbGljYXRpb24uXCJcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB6ZXBMb2dTdHJlYW0gPSBuZXcgbG9ncy5Mb2dTdHJlYW0odGhpcywgJ0tUIEtEQSBMb2dzdHJlYW0gWmVwJywge1xuICAgICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gIFxuICAgICAgICBsb2dTdHJlYW1OYW1lOiAna3RLREFMb2dzdHJlYW1aZXAnLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHplcEtkYUNvbnN0cnVjdCA9IG5ldyBLREFaZXBDb25zdHJ1Y3QodGhpcywgJ0tEQVplcENvbnN0cnVjdCcsIHtcbiAgICAgICAgYWNjb3VudDogdGhpcy5hY2NvdW50LFxuICAgICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgICB2cGM6IHZwYyxcbiAgICAgICAgbXNrU0c6IG1za1NHLFxuICAgICAgICBsb2dHcm91cDogbG9nR3JvdXAsXG4gICAgICAgIGxvZ1N0cmVhbTogemVwTG9nU3RyZWFtLFxuICAgICAgICBrZGFBcHBOYW1lOiB6ZXBEYXRhR2VuQXBwTmFtZS52YWx1ZUFzU3RyaW5nLFxuICAgICAgICBnbHVlRGF0YUNhdGFsb2c6IHplcEdsdWVDYXRhbG9nLnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIHJ1bnRpbWVFbnZpcm9ubWVudDogcnVudGltZUVudmlyb25tZW50LnZhbHVlQXNTdHJpbmcsXG4gICAgICAgIHNlcnZpY2VFeGVjdXRpb25Sb2xlOiBrZGFBcHBSb2xlLnJvbGVBcm4sXG4gICAgICB9KTtcblxuICAgICAgemVwS2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeSh2cGMpO1xuICAgICAgemVwS2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeShzZXJ2ZXJsZXNzTXNrQ2x1c3Rlcik7XG4gICAgICB6ZXBLZGFDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KGtkYUFwcFJvbGUpO1xuICAgIH1cblxuICB9IC8vIGNvbnN0cnVjdG9yXG59IC8vIGNsYXNzICJdfQ==