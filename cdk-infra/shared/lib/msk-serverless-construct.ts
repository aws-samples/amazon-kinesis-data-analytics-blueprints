import { CfnOutput, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { aws_msk as msk } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface MSKServerlessContructProps extends StackProps {
    account: string,
    region: string,
    vpc: ec2.Vpc,
    clusterName: string,
    mskSG: ec2.SecurityGroup,
    topicToCreate: string,
    onEventLambdaFn: lambda.SingletonFunction,
}

export class MSKServerlessContruct extends Construct {
    public cfnMskServerlessCluster: msk.CfnServerlessCluster;
    public cfnClusterArnOutput: CfnOutput;
    public bootstrapServersOutput: CfnOutput;

    constructor(scope: Construct, id: string, props: MSKServerlessContructProps) {
        super(scope, id);

        // msk cluster
        this.cfnMskServerlessCluster = new msk.CfnServerlessCluster(this, 'MSKServerlessCluster', {
            clusterName: props.clusterName,

            // unauthenticated
            clientAuthentication: {
                sasl: {
                    iam: {
                        enabled: true,
                    },
                },
            },

            vpcConfigs: [{
                subnetIds: props.vpc.selectSubnets({
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                }).subnetIds,
                securityGroups: [props.mskSG.securityGroupId],
            }]

        }); // CfnCluster

        // 👇 create an output for cluster ARN
        this.cfnClusterArnOutput = new cdk.CfnOutput(this, 'ClusterArnServerlessOutput', {
            value: this.cfnMskServerlessCluster.attrArn,
            description: 'The ARN of our serverless MSK cluste: ' + props!.clusterName,
            exportName: 'ServerlessMSKClusterARN-' + props!.clusterName,
        });

        this.cfnClusterArnOutput.node.addDependency(this.cfnMskServerlessCluster);

        // custom resource policy to get bootstrap brokers for our cluster
        const getBootstrapBrokers = new cr.AwsCustomResource(this, 'BootstrapBrokersServerlessLookup', {
            onUpdate: {   // will also be called for a CREATE event
                service: 'Kafka',
                action: 'getBootstrapBrokers',
                parameters: {
                    ClusterArn: this.cfnMskServerlessCluster.attrArn
                },
                region: props.region,
                physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString())
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE })
        });

        getBootstrapBrokers.node.addDependency(this.cfnMskServerlessCluster);

        // 👇 create an output for bootstrap servers
        this.bootstrapServersOutput = new cdk.CfnOutput(this, 'ServerlessBootstrapServersOutput', {
            value: getBootstrapBrokers.getResponseField('BootstrapBrokerStringSaslIam'),
            description: 'List of bootstrap servers for our Serverless MSK cluster - ' + props!.clusterName,
            exportName: 'ServerlessMSKBootstrapServers-' + props!.clusterName,
        });

        this.bootstrapServersOutput.node.addDependency(getBootstrapBrokers);

        const resource = new cdk.CustomResource(this, 'TopicCreationResource', {
            serviceToken: props!.onEventLambdaFn.functionArn,
            properties:
            {
                Broker: this.bootstrapServersOutput.value,
                Topic: props!.topicToCreate,
                NumPartitions: 3,
                ReplicationFactor: 2,
            }
        });

        props!.onEventLambdaFn.addDependency(this.cfnMskServerlessCluster);
        resource.node.addDependency(this.cfnMskServerlessCluster);
        resource.node.addDependency(props!.onEventLambdaFn);

        // 👇 create an output for topic creation response
        const response = resource.getAtt('Response').toString();
        const topicCreationResponseOutput = new cdk.CfnOutput(this, 'TopicCreationResponseOutput', {
            value: response,
            exportName: 'MSKTopicCreationResponse',
        });

        topicCreationResponseOutput.node.addDependency(props!.onEventLambdaFn);
        topicCreationResponseOutput.node.addDependency(resource);

        // 👇 create an output for topic name
        const topicName = resource.getAtt('TopicName').toString();
        const topicNameOutput = new cdk.CfnOutput(this, 'TopicName', {
            value: topicName,
            exportName: 'MSKTopicName',
        });

        topicNameOutput.node.addDependency(props!.onEventLambdaFn);
        topicNameOutput.node.addDependency(resource);
    } // constructor
} // class MSKConstruct