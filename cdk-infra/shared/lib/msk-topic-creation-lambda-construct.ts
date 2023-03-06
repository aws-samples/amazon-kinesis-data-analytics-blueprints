import { StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface TopicCreationLambdaConstructProps extends StackProps {
    account: string,
    region: string,
    vpc: ec2.Vpc,
    clusterNamesForPermission: string[],
    mskSG: ec2.SecurityGroup,
    lambdaAssetLocation: string,
}

export class TopicCreationLambdaConstruct extends Construct {
    public onEventLambdaFn: lambda.SingletonFunction;

    constructor(scope: Construct, id: string, props: TopicCreationLambdaConstructProps) {
        super(scope, id);

        let mskResourcesForPolicy = [];
        for(let i = 0; i < props!.clusterNamesForPermission.length; i++) {
            let clusterResource = `arn:aws:kafka:${props!.region}:${props!.account}:cluster/${props!.clusterNamesForPermission[i]}/*`;
            let topicResource = `arn:aws:kafka:${props!.region}:${props!.account}:topic/${props!.clusterNamesForPermission[i]}/*`;
            mskResourcesForPolicy.push(clusterResource);
            mskResourcesForPolicy.push(topicResource);
        }

        const mskSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'existingMskSG', props.mskSG.securityGroupId, {
            mutable: false
        });

        // Run topic creation lambda
        this.onEventLambdaFn = new lambda.SingletonFunction(this, 'TopicCreationFunction', {
            uuid: 'f7d4f730-4ee1-11e8-9c2d-fa7ae01bbebc',
            code: lambda.Code.fromAsset(props!.lambdaAssetLocation),
            handler: "com.amazonaws.Handler",
            initialPolicy: [
                new iam.PolicyStatement(
                    {
                        actions: ['kafka-cluster:Connect',
                            'kafka-cluster:CreateTopic',
                            'kafka-cluster:DescribeTopic',
                            'kafka-cluster:DeleteTopic',],
                        resources: mskResourcesForPolicy
                    })
            ],
            timeout: cdk.Duration.seconds(300),
            runtime: lambda.Runtime.JAVA_11,
            memorySize: 1024, // need extra memory for kafka-client
            vpc: props!.vpc,
            // 👇 place lambda in private subnet so 
            // we can reach MSK broker
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [mskSecurityGroup],
        });
    }
}