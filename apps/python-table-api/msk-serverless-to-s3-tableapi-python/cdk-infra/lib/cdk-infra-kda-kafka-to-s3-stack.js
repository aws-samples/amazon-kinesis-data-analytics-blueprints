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
            logGroupName: 'ktKDALoggroup',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const logStream = new aws_cdk_lib_2.aws_logs.LogStream(this, 'KT KDA Logstream', {
            logGroup: logGroup,
            logStreamName: 'ktKDALogstream',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const zepLogStream = new aws_cdk_lib_2.aws_logs.LogStream(this, 'KT KDA Logstream Zep', {
            logGroup: logGroup,
            logStreamName: 'ktKDALogstreamZep',
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
        const zepKdaConstruct = new kda_zep_construct_1.KDAZepConstruct(this, 'KDAZepConstruct', {
            account: this.account,
            region: this.region,
            vpc: vpc,
            mskSG: mskSG,
            logGroup: logGroup,
            logStream: zepLogStream,
            kdaAppName: kdaAppName.valueAsString + '-zep',
            runtimeEnvironment: runtimeEnvironment.valueAsString,
            serviceExecutionRole: kdaAppRole.roleArn,
        });
        zepKdaConstruct.node.addDependency(vpc);
        zepKdaConstruct.node.addDependency(serverlessMskCluster);
        zepKdaConstruct.node.addDependency(kdaAppRole);
    } // constructor
} // class 
exports.CdkInfraKdaKafkaToS3Stack = CdkInfraKdaKafkaToS3Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWluZnJhLWtkYS1rYWZrYS10by1zMy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1pbmZyYS1rZGEta2Fma2EtdG8tczMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLDZDQUEyRTtBQUUzRSwyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBQzNDLDZDQUErQztBQUMvQyxxRkFBaUY7QUFDakYsNkZBQXdGO0FBQ3hGLDJHQUFxRztBQVVyRyxNQUFhLHlCQUEwQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3RELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBbUI7UUFDM0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFMUIsYUFBYTtRQUNiLE1BQU0sVUFBVSxHQUFHLElBQUksMEJBQVksQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3RELElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxVQUFVO1lBQzFCLFdBQVcsRUFBRSxtQ0FBbUM7U0FBQyxDQUFDLENBQUM7UUFFckQsTUFBTSxTQUFTLEdBQUcsSUFBSSwwQkFBWSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDcEQsSUFBSSxFQUFFLFFBQVE7WUFDZCxPQUFPLEVBQUUsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLFNBQVM7WUFDekIsV0FBVyxFQUFFLG1FQUFtRTtTQUFDLENBQUMsQ0FBQztRQUVyRixNQUFNLGNBQWMsR0FBRyxJQUFJLDBCQUFZLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzlELElBQUksRUFBRSxRQUFRO1lBQ2QsT0FBTyxFQUFFLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxjQUFjO1lBQzlCLFdBQVcsRUFBRSw0Q0FBNEM7U0FBQyxDQUFDLENBQUM7UUFFOUQsTUFB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LEdBQUcsRUFBRSxHQUFHO1lBQ1IsS0FBSyxFQUFFLEtBQUs7WUFDWixRQUFRLEVBQUUsUUFBUTtZQUNsQixTQUFTLEVBQUUsWUFBWTtZQUN2QixVQUFVLEVBQUUsVUFBVSxDQUFDLGFBQWEsR0FBRyxNQUFNO1lBQzdDLGtCQUFrQixFQUFFLGtCQUFrQixDQUFDLGFBQWE7WUFDcEQsb0JBQW9CLEVBQUUsVUFBVSxDQUFDLE9BQU87U0FDekMsQ0FBQyxDQUFDO1FBRUgsZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUN6RCxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUVqRCxDQUFDLENBQUMsY0FBYztDQUNqQixDQUFDLFNBQVM7QUEvTlgsOERBK05DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENmblBhcmFtZXRlciwgRW52aXJvbm1lbnQsIFN0YWNrLCBTdGFja1Byb3BzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBhd3NfbG9ncyBhcyBsb2dzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgS0RBQ29uc3RydWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY2RrLWluZnJhL3NoYXJlZC9saWIva2RhLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBLREFaZXBDb25zdHJ1Y3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jZGstaW5mcmEvc2hhcmVkL2xpYi9rZGEtemVwLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBNU0tTZXJ2ZXJsZXNzQ29udHJ1Y3QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jZGstaW5mcmEvc2hhcmVkL2xpYi9tc2stc2VydmVybGVzcy1jb25zdHJ1Y3QnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEdsb2JhbFByb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XG4gIGtkYUFwcE5hbWU6IHN0cmluZyxcbiAgYXBwQnVja2V0OiBzdHJpbmcsXG4gIGFwcEZpbGVLZXlPblMzOiBzdHJpbmcsXG4gIHJ1bnRpbWVFbnZpcm9ubWVudDogc3RyaW5nLFxuICBhcHBTaW5rQnVja2V0OiBzdHJpbmcsXG59XG5cbmV4cG9ydCBjbGFzcyBDZGtJbmZyYUtkYUthZmthVG9TM1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBHbG9iYWxQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gIC8vIFBhcmFtZXRlcnNcbiAgY29uc3Qga2RhQXBwTmFtZSA9IG5ldyBDZm5QYXJhbWV0ZXIodGhpcywgXCJrZGFBcHBOYW1lXCIsIHtcbiAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgIGRlZmF1bHQ6IHByb3BzPy5rZGFBcHBOYW1lLFxuICAgIGRlc2NyaXB0aW9uOiBcIlRoZSBuYW1lIG9mIHlvdXIgS0RBIGFwcGxpY2F0aW9uLlwifSk7XG5cbiAgY29uc3QgYXBwQnVja2V0ID0gbmV3IENmblBhcmFtZXRlcih0aGlzLCBcImFwcEJ1Y2tldFwiLCB7XG4gICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICBkZWZhdWx0OiBwcm9wcz8uYXBwQnVja2V0LFxuICAgIGRlc2NyaXB0aW9uOiBcIlRoZSAocHJlLWV4aXN0aW5nKSBidWNrZXQgdGhhdCB3aWxsIGhvbGQgdGhlIEtEQSBhcHBsaWNhdGlvbiBKQVIuXCJ9KTtcblxuICBjb25zdCBhcHBGaWxlS2V5T25TMyA9IG5ldyBDZm5QYXJhbWV0ZXIodGhpcywgXCJhcHBGaWxlS2V5T25TM1wiLCB7XG4gICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICBkZWZhdWx0OiBwcm9wcz8uYXBwRmlsZUtleU9uUzMsXG4gICAgZGVzY3JpcHRpb246IFwiVGhlIGZpbGUga2V5IG9mIHRoZSBhcHBsaWNhdGlvbiBKQVIgb24gUzMuXCJ9KTtcblxuICBjb25zdCBydW50aW1lRW52aXJvbm1lbnQgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwicnVudGltZUVudmlyb25tZW50XCIsIHtcbiAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgIGRlZmF1bHQ6IHByb3BzPy5ydW50aW1lRW52aXJvbm1lbnQsXG4gICAgZGVzY3JpcHRpb246IFwiRmxpbmsgcnVudGltZSBlbnZpcm9ubWVudC5cIn0pO1xuXG4gIGNvbnN0IGFwcFNpbmtCdWNrZXQgPSBuZXcgQ2ZuUGFyYW1ldGVyKHRoaXMsIFwiYXBwU2lua0J1Y2tldFwiLCB7XG4gICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICBkZWZhdWx0OiBwcm9wcz8uYXBwU2lua0J1Y2tldCxcbiAgICBkZXNjcmlwdGlvbjogXCJUaGUgKHByZS1leGlzdGluZykgYnVja2V0IHRoYXQgdGhlIEZsaW5rIGFwcCB3aWxsIHdyaXRlIHRvLlwifSk7XG5cbiAgICAvLyBWUENcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnVlBDJywge1xuICAgICAgZW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgICAgZW5hYmxlRG5zU3VwcG9ydDogdHJ1ZSxcbiAgICAgIG1heEF6czogMyxcbiAgICAgIG5hdEdhdGV3YXlzOiAxLFxuICAgICAgc3VibmV0Q29uZmlndXJhdGlvbjogW1xuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdwdWJsaWMtc3VibmV0LTEnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBVQkxJQyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgICBuYW1lOiAncHJpdmF0ZScsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gc2VjdXJpdHkgZ3JvdXAgZm9yIFNTSFxuICAgIC8vIGluIGNhc2Ugd2UgZGVjaWRlIHRvIHNldHVwIGEgaW5zdGFuY2UgdG8gJ2RvIHN0dWZmJ1xuICAgIC8vIGluIHRoZSBWUENcbiAgICBjb25zdCBzc2hTRyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnbXlTRycsIHtcbiAgICAgIHZwYzogdnBjLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU1NIIFNlY3VyaXR5IEdyb3VwJ1xuICAgIH0pO1xuXG4gICAgc3NoU0cuYWRkSW5ncmVzc1J1bGUoZWMyLlBlZXIuYW55SXB2NCgpLCBlYzIuUG9ydC50Y3AoMjIpLCAnU1NIIGZybSBhbnl3aGVyZScpO1xuXG4gICAgLy8gc2VjdXJpdHkgZ3JvdXAgZm9yIE1TSyBhY2Nlc3NcbiAgICBjb25zdCBtc2tTRyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnbXNrU0cnLCB7XG4gICAgICB2cGM6IHZwYyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ01TSyBTZWN1cml0eSBHcm91cCdcbiAgICB9KTtcblxuICAgIG1za1NHLmNvbm5lY3Rpb25zLmFsbG93SW50ZXJuYWxseShlYzIuUG9ydC5hbGxUcmFmZmljKCksICdBbGxvdyBhbGwgdHJhZmZpYyBiZXR3ZWVuIGhvc3RzIGhhdmluZyB0aGUgc2FtZSBzZWN1cml0eSBncm91cCcpO1xuXG4gICAgLy8gY3JlYXRlIGN3IGxvZyBncm91cCBhbmQgbG9nIHN0cmVhbVxuICAgIC8vIHNvIGl0IGNhbiBiZSB1c2VkIHdoZW4gY3JlYXRpbmcga2RhIGFwcFxuICAgIGNvbnN0IGxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0tUIEtEQSBMb2cgR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6ICdrdEtEQUxvZ2dyb3VwJyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG4gICAgY29uc3QgbG9nU3RyZWFtID0gbmV3IGxvZ3MuTG9nU3RyZWFtKHRoaXMsICdLVCBLREEgTG9nc3RyZWFtJywge1xuICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuXG4gICAgICBsb2dTdHJlYW1OYW1lOiAna3RLREFMb2dzdHJlYW0nLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcbiAgICBjb25zdCB6ZXBMb2dTdHJlYW0gPSBuZXcgbG9ncy5Mb2dTdHJlYW0odGhpcywgJ0tUIEtEQSBMb2dzdHJlYW0gWmVwJywge1xuICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuXG4gICAgICBsb2dTdHJlYW1OYW1lOiAna3RLREFMb2dzdHJlYW1aZXAnLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIGluc3RhbnRpYXRlIHNlcnZlcmxlc3MgTVNLIGNsdXN0ZXIgdy8gSUFNIGF1dGhcbiAgICBjb25zdCBzZXJ2ZXJsZXNzTXNrQ2x1c3RlciA9IG5ldyBNU0tTZXJ2ZXJsZXNzQ29udHJ1Y3QodGhpcywgJ01TS1NlcnZlcmxlc3MnLCB7XG4gICAgICBhY2NvdW50OiB0aGlzLmFjY291bnQsXG4gICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgdnBjOiB2cGMsXG4gICAgICBjbHVzdGVyTmFtZTogJ2t0U2VydmVybGVzc01TS0NsdXN0ZXInLFxuICAgICAgbXNrU0c6IG1za1NHLFxuICAgIH0pO1xuXG4gICAgc2VydmVybGVzc01za0NsdXN0ZXIubm9kZS5hZGREZXBlbmRlbmN5KHZwYyk7XG5cbiAgICAvLyBwb2xpY2llcyBmb3Iga2RhIHJvbGUgKFRPRE86IE5hcnJvdyBkb3duIGFjY2VzcylcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIHRvIGJlIGFibGUgdG8gcmVhZCBmcm9tIEthZmthIChzb3VyY2UpXG4gICAgY29uc3QgYWNjZXNzTVNLUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsna2Fma2EtY2x1c3RlcjoqJ10sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIHRvIGJlIGFibGUgdG8gbG9nXG4gICAgY29uc3QgYWNjZXNzQ1dMb2dzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsnbG9nczoqJ10sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIG91ciBLREEgYXBwIG5lZWRzIGFjY2VzcyB0byByZWFkIGFwcGxpY2F0aW9uIGphciBmcm9tIFMzXG4gICAgLy8gYXMgd2VsbCBhcyB0byB3cml0ZSB0byBTMyAoZnJvbSBGaWxlU2luaylcbiAgICBjb25zdCBhY2Nlc3NTM1BvbGljeSA9IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICBhY3Rpb25zOiBbJ3MzOionXSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gb3VyIEtEQSBhcHAgbmVlZHMgYWNjZXNzIHRvIGRlc2NyaWJlIGtpbmVzaXNhbmFseXRpY3NcbiAgICBjb25zdCBrZGFBY2Nlc3NQb2xpY3kgPSBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgYWN0aW9uczogWydraW5lc2lzYW5hbHl0aWNzOkRlc2NyaWJlQXBwbGljYXRpb24nXVxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBvdXIgS0RBIGFwcCBuZWVkcyBhY2Nlc3MgdG8gYWNjZXNzIGdsdWUgZGJcbiAgICBjb25zdCBnbHVlQWNjZXNzUG9saWN5ID0gbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgICAgIGFjdGlvbnM6IFsnZ2x1ZToqJ11cbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gb3VyIEtEQSBhcHAgbmVlZHMgYWNjZXNzIHRvIHBlcmZvcm0gVlBDIGFjdGlvbnNcbiAgICBjb25zdCBhY2Nlc3NWUENQb2xpY3kgPSBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgYWN0aW9uczogWydlYzI6RGVsZXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVEaGNwT3B0aW9ucycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVTZWN1cml0eUdyb3VwcycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6Q3JlYXRlTmV0d29ya0ludGVyZmFjZScsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVOZXR3b3JrSW50ZXJmYWNlcycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6Q3JlYXRlTmV0d29ya0ludGVyZmFjZVBlcm1pc3Npb24nLFxuICAgICAgICAgICAgICAgICAgICAnZWMyOkRlc2NyaWJlVnBjcycsXG4gICAgICAgICAgICAgICAgICAgICdlYzI6RGVzY3JpYmVTdWJuZXRzJ10sXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGtkYUFwcFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ2tkYS1hcHAtcm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdraW5lc2lzYW5hbHl0aWNzLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnS0RBIGFwcCByb2xlJyxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIEFjY2Vzc01TS1BvbGljeTogYWNjZXNzTVNLUG9saWN5LFxuICAgICAgICBBY2Nlc3NDV0xvZ3NQb2xpY3k6IGFjY2Vzc0NXTG9nc1BvbGljeSxcbiAgICAgICAgQWNjZXNzUzNQb2xpY3k6IGFjY2Vzc1MzUG9saWN5LFxuICAgICAgICBBY2Nlc3NWUENQb2xpY3k6IGFjY2Vzc1ZQQ1BvbGljeSxcbiAgICAgICAgS0RBQWNjZXNzUG9saWN5OiBrZGFBY2Nlc3NQb2xpY3ksXG4gICAgICAgIEdsdWVBY2Nlc3NQb2xpY3k6IGdsdWVBY2Nlc3NQb2xpY3ksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gaW5zdGFudGlhdGUga2RhIGNvbnN0cnVjdFxuICAgIGNvbnN0IGtkYUNvbnN0cnVjdCA9IG5ldyBLREFDb25zdHJ1Y3QodGhpcywgJ0tEQUNvbnN0cnVjdCcsIHtcbiAgICAgIGFjY291bnQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICB2cGM6IHZwYyxcbiAgICAgIG1za1NHOiBtc2tTRyxcbiAgICAgIGxvZ0dyb3VwOiBsb2dHcm91cCxcbiAgICAgIGxvZ1N0cmVhbTogbG9nU3RyZWFtLFxuICAgICAga2RhQXBwTmFtZToga2RhQXBwTmFtZS52YWx1ZUFzU3RyaW5nLFxuICAgICAgYXBwQnVja2V0OiBhcHBCdWNrZXQudmFsdWVBc1N0cmluZyxcbiAgICAgIGFwcEZpbGVLZXlPblMzOiBhcHBGaWxlS2V5T25TMy52YWx1ZUFzU3RyaW5nLFxuICAgICAgYXBwU2lua0J1Y2tldDogYXBwU2lua0J1Y2tldC52YWx1ZUFzU3RyaW5nLFxuICAgICAgcnVudGltZUVudmlyb25tZW50OiBydW50aW1lRW52aXJvbm1lbnQudmFsdWVBc1N0cmluZyxcbiAgICAgIHNlcnZpY2VFeGVjdXRpb25Sb2xlOiBrZGFBcHBSb2xlLnJvbGVBcm4sXG4gICAgICBib290c3RyYXBTZXJ2ZXJzU3RyaW5nOiAnbm9uZScsIC8vbXNrQ2x1c3Rlck5vQXV0aC5ib290c3RyYXBTZXJ2ZXJzT3V0cHV0LnZhbHVlLFxuICAgICAgc2VydmVybGVzc0Jvb3RzdHJhcFNlcnZlcnNTdHJpbmc6IHNlcnZlcmxlc3NNc2tDbHVzdGVyLmJvb3RzdHJhcFNlcnZlcnNPdXRwdXQudmFsdWUsXG4gICAgfSk7XG5cbiAgICBrZGFDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KHZwYyk7XG4gICAga2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeShzZXJ2ZXJsZXNzTXNrQ2x1c3Rlcik7XG4gICAga2RhQ29uc3RydWN0Lm5vZGUuYWRkRGVwZW5kZW5jeShrZGFBcHBSb2xlKTtcblxuICAgIC8vIGluc3RhbnRpYXRlIHplcCBrZGEgY29uc3RydWN0XG4gICAgY29uc3QgemVwS2RhQ29uc3RydWN0ID0gbmV3IEtEQVplcENvbnN0cnVjdCh0aGlzLCAnS0RBWmVwQ29uc3RydWN0Jywge1xuICAgICAgYWNjb3VudDogdGhpcy5hY2NvdW50LFxuICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgIHZwYzogdnBjLFxuICAgICAgbXNrU0c6IG1za1NHLFxuICAgICAgbG9nR3JvdXA6IGxvZ0dyb3VwLFxuICAgICAgbG9nU3RyZWFtOiB6ZXBMb2dTdHJlYW0sXG4gICAgICBrZGFBcHBOYW1lOiBrZGFBcHBOYW1lLnZhbHVlQXNTdHJpbmcgKyAnLXplcCcsXG4gICAgICBydW50aW1lRW52aXJvbm1lbnQ6IHJ1bnRpbWVFbnZpcm9ubWVudC52YWx1ZUFzU3RyaW5nLFxuICAgICAgc2VydmljZUV4ZWN1dGlvblJvbGU6IGtkYUFwcFJvbGUucm9sZUFybixcbiAgICB9KTtcblxuICAgIHplcEtkYUNvbnN0cnVjdC5ub2RlLmFkZERlcGVuZGVuY3kodnBjKTtcbiAgICB6ZXBLZGFDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KHNlcnZlcmxlc3NNc2tDbHVzdGVyKTtcbiAgICB6ZXBLZGFDb25zdHJ1Y3Qubm9kZS5hZGREZXBlbmRlbmN5KGtkYUFwcFJvbGUpO1xuXG4gIH0gLy8gY29uc3RydWN0b3Jcbn0gLy8gY2xhc3MgIl19