"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSKContruct = void 0;
const cdk = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const ec2 = require("aws-cdk-lib/aws-ec2");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const cr = require("aws-cdk-lib/custom-resources");
class MSKContruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // msk cluster
        this.cfnMskCluster = new aws_cdk_lib_1.aws_msk.CfnCluster(this, 'MSKCluster', {
            clusterName: props.clusterName,
            kafkaVersion: props.kafkaVersion,
            numberOfBrokerNodes: 3,
            // unauthenticated
            clientAuthentication: {
                unauthenticated: {
                    enabled: true,
                },
            },
            encryptionInfo: {
                encryptionInTransit: {
                    clientBroker: 'TLS_PLAINTEXT',
                    inCluster: true,
                }
            },
            brokerNodeGroupInfo: {
                instanceType: props.instanceType,
                clientSubnets: props.vpc.selectSubnets({
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                }).subnetIds,
                securityGroups: [props.mskSG.securityGroupId],
                storageInfo: {
                    ebsStorageInfo: {
                        volumeSize: 512,
                    },
                },
            } // brokerNodeGroupInfo
        }); // CfnCluster
        // 👇 create an output for cluster ARN
        this.cfnClusterArnOutput = new cdk.CfnOutput(this, 'ClusterArnOutput', {
            value: this.cfnMskCluster.attrArn,
            description: 'The ARN of our MSK cluster',
            exportName: 'MSKClusterARN',
        });
        this.cfnClusterArnOutput.node.addDependency(this.cfnMskCluster);
        // custom resource policy to get bootstrap brokers for our cluster
        const getBootstrapBrokers = new cr.AwsCustomResource(this, 'BootstrapBrokersLookup', {
            onUpdate: {
                service: 'Kafka',
                action: 'getBootstrapBrokers',
                parameters: {
                    ClusterArn: this.cfnMskCluster.attrArn
                },
                region: props.region,
                physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString())
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE })
        });
        getBootstrapBrokers.node.addDependency(this.cfnMskCluster);
        // 👇 create an output for bootstrap servers
        this.bootstrapServersOutput = new cdk.CfnOutput(this, 'BootstrapServersOutput', {
            value: getBootstrapBrokers.getResponseField('BootstrapBrokerString'),
            description: 'List of bootstrap servers for our MSK cluster',
            exportName: 'MSKBootstrapServers',
        });
        this.bootstrapServersOutput.node.addDependency(getBootstrapBrokers);
    } // constructor
} // class MSKConstruct
exports.MSKContruct = MSKContruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXNrLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1zay1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsbUNBQW1DO0FBQ25DLDJDQUF1QztBQUN2QywyQ0FBMkM7QUFDM0MsNkNBQTZDO0FBQzdDLG1EQUFtRDtBQWFuRCxNQUFhLFdBQVksU0FBUSxzQkFBUztJQUt0QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQzdELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsY0FBYztRQUNkLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxxQkFBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3hELFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztZQUM5QixZQUFZLEVBQUUsS0FBSyxDQUFDLFlBQVk7WUFFaEMsbUJBQW1CLEVBQUUsQ0FBQztZQUV0QixrQkFBa0I7WUFDbEIsb0JBQW9CLEVBQUU7Z0JBQ2xCLGVBQWUsRUFBRTtvQkFDYixPQUFPLEVBQUUsSUFBSTtpQkFDaEI7YUFDSjtZQUVELGNBQWMsRUFBRTtnQkFDWixtQkFBbUIsRUFBRTtvQkFDakIsWUFBWSxFQUFFLGVBQWU7b0JBQzdCLFNBQVMsRUFBRSxJQUFJO2lCQUNsQjthQUNKO1lBRUQsbUJBQW1CLEVBQUU7Z0JBQ2pCLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtnQkFDaEMsYUFBYSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO29CQUNuQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7aUJBQ2pELENBQUMsQ0FBQyxTQUFTO2dCQUNaLGNBQWMsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDO2dCQUM3QyxXQUFXLEVBQUU7b0JBQ1QsY0FBYyxFQUFFO3dCQUNaLFVBQVUsRUFBRSxHQUFHO3FCQUNsQjtpQkFDSjthQUNKLENBQUMsc0JBQXNCO1NBRTNCLENBQUMsQ0FBQyxDQUFDLGFBQWE7UUFFakIsc0NBQXNDO1FBQ3RDLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ25FLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDakMsV0FBVyxFQUFFLDRCQUE0QjtZQUN6QyxVQUFVLEVBQUUsZUFBZTtTQUM5QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFaEUsa0VBQWtFO1FBQ2xFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQ2pGLFFBQVEsRUFBRTtnQkFDTixPQUFPLEVBQUUsT0FBTztnQkFDaEIsTUFBTSxFQUFFLHFCQUFxQjtnQkFDN0IsVUFBVSxFQUFFO29CQUNSLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU87aUJBQ3pDO2dCQUNELE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtnQkFDcEIsa0JBQWtCLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUM7YUFDdEU7WUFDRCxNQUFNLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFlBQVksQ0FBQyxFQUFFLFNBQVMsRUFBRSxFQUFFLENBQUMsdUJBQXVCLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDMUcsQ0FBQyxDQUFDO1FBRUgsbUJBQW1CLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFM0QsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFO1lBQzVFLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyx1QkFBdUIsQ0FBQztZQUNwRSxXQUFXLEVBQUUsK0NBQStDO1lBQzVELFVBQVUsRUFBRSxxQkFBcUI7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsQ0FBQztJQUV4RSxDQUFDLENBQUMsY0FBYztDQUNuQixDQUFDLHFCQUFxQjtBQS9FdkIsa0NBK0VDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2ZuT3V0cHV0LCBTZWNyZXRWYWx1ZSwgU3RhY2ssIFN0YWNrUHJvcHMgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBhd3NfbXNrIGFzIG1zayB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNyIGZyb20gJ2F3cy1jZGstbGliL2N1c3RvbS1yZXNvdXJjZXMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1TS0NvbnRydWN0UHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgICBhY2NvdW50OiBzdHJpbmcsXG4gICAgcmVnaW9uOiBzdHJpbmcsXG4gICAgdnBjOiBlYzIuVnBjLFxuICAgIGNsdXN0ZXJOYW1lOiBzdHJpbmcsXG4gICAga2Fma2FWZXJzaW9uOiBzdHJpbmcsXG4gICAgaW5zdGFuY2VUeXBlOiBzdHJpbmcsXG4gICAgbXNrU0c6IGVjMi5TZWN1cml0eUdyb3VwLFxuICAgIHNzaFNHOiBlYzIuU2VjdXJpdHlHcm91cCxcbn1cblxuZXhwb3J0IGNsYXNzIE1TS0NvbnRydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgICBwdWJsaWMgY2ZuTXNrQ2x1c3RlcjogbXNrLkNmbkNsdXN0ZXI7XG4gICAgcHVibGljIGNmbkNsdXN0ZXJBcm5PdXRwdXQ6IENmbk91dHB1dDtcbiAgICBwdWJsaWMgYm9vdHN0cmFwU2VydmVyc091dHB1dDogQ2ZuT3V0cHV0O1xuXG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE1TS0NvbnRydWN0UHJvcHMpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICAvLyBtc2sgY2x1c3RlclxuICAgICAgICB0aGlzLmNmbk1za0NsdXN0ZXIgPSBuZXcgbXNrLkNmbkNsdXN0ZXIodGhpcywgJ01TS0NsdXN0ZXInLCB7XG4gICAgICAgICAgICBjbHVzdGVyTmFtZTogcHJvcHMuY2x1c3Rlck5hbWUsXG4gICAgICAgICAgICBrYWZrYVZlcnNpb246IHByb3BzLmthZmthVmVyc2lvbixcblxuICAgICAgICAgICAgbnVtYmVyT2ZCcm9rZXJOb2RlczogMyxcblxuICAgICAgICAgICAgLy8gdW5hdXRoZW50aWNhdGVkXG4gICAgICAgICAgICBjbGllbnRBdXRoZW50aWNhdGlvbjoge1xuICAgICAgICAgICAgICAgIHVuYXV0aGVudGljYXRlZDoge1xuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBlbmNyeXB0aW9uSW5mbzoge1xuICAgICAgICAgICAgICAgIGVuY3J5cHRpb25JblRyYW5zaXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgY2xpZW50QnJva2VyOiAnVExTX1BMQUlOVEVYVCcsXG4gICAgICAgICAgICAgICAgICAgIGluQ2x1c3RlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBicm9rZXJOb2RlR3JvdXBJbmZvOiB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2VUeXBlOiBwcm9wcy5pbnN0YW5jZVR5cGUsXG4gICAgICAgICAgICAgICAgY2xpZW50U3VibmV0czogcHJvcHMudnBjLnNlbGVjdFN1Ym5ldHMoe1xuICAgICAgICAgICAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgICAgICAgIH0pLnN1Ym5ldElkcyxcbiAgICAgICAgICAgICAgICBzZWN1cml0eUdyb3VwczogW3Byb3BzLm1za1NHLnNlY3VyaXR5R3JvdXBJZF0sXG4gICAgICAgICAgICAgICAgc3RvcmFnZUluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgZWJzU3RvcmFnZUluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZvbHVtZVNpemU6IDUxMixcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSAvLyBicm9rZXJOb2RlR3JvdXBJbmZvXG5cbiAgICAgICAgfSk7IC8vIENmbkNsdXN0ZXJcblxuICAgICAgICAvLyDwn5GHIGNyZWF0ZSBhbiBvdXRwdXQgZm9yIGNsdXN0ZXIgQVJOXG4gICAgICAgIHRoaXMuY2ZuQ2x1c3RlckFybk91dHB1dCA9IG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbHVzdGVyQXJuT3V0cHV0Jywge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMuY2ZuTXNrQ2x1c3Rlci5hdHRyQXJuLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUaGUgQVJOIG9mIG91ciBNU0sgY2x1c3RlcicsXG4gICAgICAgICAgICBleHBvcnROYW1lOiAnTVNLQ2x1c3RlckFSTicsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuY2ZuQ2x1c3RlckFybk91dHB1dC5ub2RlLmFkZERlcGVuZGVuY3kodGhpcy5jZm5Nc2tDbHVzdGVyKTtcblxuICAgICAgICAvLyBjdXN0b20gcmVzb3VyY2UgcG9saWN5IHRvIGdldCBib290c3RyYXAgYnJva2VycyBmb3Igb3VyIGNsdXN0ZXJcbiAgICAgICAgY29uc3QgZ2V0Qm9vdHN0cmFwQnJva2VycyA9IG5ldyBjci5Bd3NDdXN0b21SZXNvdXJjZSh0aGlzLCAnQm9vdHN0cmFwQnJva2Vyc0xvb2t1cCcsIHtcbiAgICAgICAgICAgIG9uVXBkYXRlOiB7ICAgLy8gd2lsbCBhbHNvIGJlIGNhbGxlZCBmb3IgYSBDUkVBVEUgZXZlbnRcbiAgICAgICAgICAgICAgICBzZXJ2aWNlOiAnS2Fma2EnLFxuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2dldEJvb3RzdHJhcEJyb2tlcnMnLFxuICAgICAgICAgICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgQ2x1c3RlckFybjogdGhpcy5jZm5Nc2tDbHVzdGVyLmF0dHJBcm5cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHJlZ2lvbjogcHJvcHMucmVnaW9uLFxuICAgICAgICAgICAgICAgIHBoeXNpY2FsUmVzb3VyY2VJZDogY3IuUGh5c2ljYWxSZXNvdXJjZUlkLm9mKERhdGUubm93KCkudG9TdHJpbmcoKSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwb2xpY3k6IGNyLkF3c0N1c3RvbVJlc291cmNlUG9saWN5LmZyb21TZGtDYWxscyh7IHJlc291cmNlczogY3IuQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3kuQU5ZX1JFU09VUkNFIH0pXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGdldEJvb3RzdHJhcEJyb2tlcnMubm9kZS5hZGREZXBlbmRlbmN5KHRoaXMuY2ZuTXNrQ2x1c3Rlcik7XG5cbiAgICAgICAgLy8g8J+RhyBjcmVhdGUgYW4gb3V0cHV0IGZvciBib290c3RyYXAgc2VydmVyc1xuICAgICAgICB0aGlzLmJvb3RzdHJhcFNlcnZlcnNPdXRwdXQgPSBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQm9vdHN0cmFwU2VydmVyc091dHB1dCcsIHtcbiAgICAgICAgICAgIHZhbHVlOiBnZXRCb290c3RyYXBCcm9rZXJzLmdldFJlc3BvbnNlRmllbGQoJ0Jvb3RzdHJhcEJyb2tlclN0cmluZycpLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdMaXN0IG9mIGJvb3RzdHJhcCBzZXJ2ZXJzIGZvciBvdXIgTVNLIGNsdXN0ZXInLFxuICAgICAgICAgICAgZXhwb3J0TmFtZTogJ01TS0Jvb3RzdHJhcFNlcnZlcnMnLFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmJvb3RzdHJhcFNlcnZlcnNPdXRwdXQubm9kZS5hZGREZXBlbmRlbmN5KGdldEJvb3RzdHJhcEJyb2tlcnMpO1xuXG4gICAgfSAvLyBjb25zdHJ1Y3RvclxufSAvLyBjbGFzcyBNU0tDb25zdHJ1Y3QiXX0=