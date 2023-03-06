"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSKServerlessContruct = void 0;
const cdk = require("aws-cdk-lib");
const constructs_1 = require("constructs");
const ec2 = require("aws-cdk-lib/aws-ec2");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const cr = require("aws-cdk-lib/custom-resources");
class MSKServerlessContruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // msk cluster
        this.cfnMskServerlessCluster = new aws_cdk_lib_1.aws_msk.CfnServerlessCluster(this, 'MSKServerlessCluster', {
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
            description: 'The ARN of our serverless MSK cluster',
            exportName: 'ServerlessMSKClusterARN-' + Date.now().toString(),
        });
        this.cfnClusterArnOutput.node.addDependency(this.cfnMskServerlessCluster);
        // custom resource policy to get bootstrap brokers for our cluster
        const getBootstrapBrokers = new cr.AwsCustomResource(this, 'BootstrapBrokersServerlessLookup', {
            onUpdate: {
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
            description: 'List of bootstrap servers for our Serverless MSK cluster',
            exportName: 'ServerlessMSKBootstrapServers-' + Date.now().toString(),
        });
        this.bootstrapServersOutput.node.addDependency(getBootstrapBrokers);
    } // constructor
} // class MSKConstruct
exports.MSKServerlessContruct = MSKServerlessContruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXNrLXNlcnZlcmxlc3MtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibXNrLXNlcnZlcmxlc3MtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLG1DQUFtQztBQUNuQywyQ0FBdUM7QUFDdkMsMkNBQTJDO0FBQzNDLDZDQUE2QztBQUM3QyxtREFBbUQ7QUFVbkQsTUFBYSxxQkFBc0IsU0FBUSxzQkFBUztJQUtoRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3ZFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsY0FBYztRQUNkLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLHFCQUFHLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ3RGLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztZQUU5QixrQkFBa0I7WUFDbEIsb0JBQW9CLEVBQUU7Z0JBQ2xCLElBQUksRUFBRTtvQkFDRixHQUFHLEVBQUU7d0JBQ0QsT0FBTyxFQUFFLElBQUk7cUJBQ2hCO2lCQUNKO2FBQ0o7WUFFRCxVQUFVLEVBQUUsQ0FBQztvQkFDVCxTQUFTLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUM7d0JBQy9CLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtxQkFDakQsQ0FBQyxDQUFDLFNBQVM7b0JBQ1osY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxlQUFlLENBQUM7aUJBQ2hELENBQUM7U0FFTCxDQUFDLENBQUMsQ0FBQyxhQUFhO1FBRWpCLHNDQUFzQztRQUN0QyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSw0QkFBNEIsRUFBRTtZQUM3RSxLQUFLLEVBQUUsSUFBSSxDQUFDLHVCQUF1QixDQUFDLE9BQU87WUFDM0MsV0FBVyxFQUFFLHVDQUF1QztZQUNwRCxVQUFVLEVBQUUsMEJBQTBCLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRTtTQUNqRSxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUUxRSxrRUFBa0U7UUFDbEUsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLEVBQUUsa0NBQWtDLEVBQUU7WUFDM0YsUUFBUSxFQUFFO2dCQUNOLE9BQU8sRUFBRSxPQUFPO2dCQUNoQixNQUFNLEVBQUUscUJBQXFCO2dCQUM3QixVQUFVLEVBQUU7b0JBQ1IsVUFBVSxFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxPQUFPO2lCQUNuRDtnQkFDRCxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07Z0JBQ3BCLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDO2FBQ3RFO1lBQ0QsTUFBTSxFQUFFLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxZQUFZLENBQUMsRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFlBQVksRUFBRSxDQUFDO1NBQzFHLENBQUMsQ0FBQztRQUVILG1CQUFtQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFFckUsNENBQTRDO1FBQzVDLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGtDQUFrQyxFQUFFO1lBQ3RGLEtBQUssRUFBRSxtQkFBbUIsQ0FBQyxnQkFBZ0IsQ0FBQyw4QkFBOEIsQ0FBQztZQUMzRSxXQUFXLEVBQUUsMERBQTBEO1lBQ3ZFLFVBQVUsRUFBRSxnQ0FBZ0MsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxFQUFFO1NBQ3ZFLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFFeEUsQ0FBQyxDQUFDLGNBQWM7Q0FDbkIsQ0FBQyxxQkFBcUI7QUFqRXZCLHNEQWlFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENmbk91dHB1dCwgU2VjcmV0VmFsdWUsIFN0YWNrLCBTdGFja1Byb3BzIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgYXdzX21zayBhcyBtc2sgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjciBmcm9tICdhd3MtY2RrLWxpYi9jdXN0b20tcmVzb3VyY2VzJztcblxuZXhwb3J0IGludGVyZmFjZSBNU0tTZXJ2ZXJsZXNzQ29udHJ1Y3RQcm9wcyBleHRlbmRzIFN0YWNrUHJvcHMge1xuICAgIGFjY291bnQ6IHN0cmluZyxcbiAgICByZWdpb246IHN0cmluZyxcbiAgICB2cGM6IGVjMi5WcGMsXG4gICAgY2x1c3Rlck5hbWU6IHN0cmluZyxcbiAgICBtc2tTRzogZWMyLlNlY3VyaXR5R3JvdXAsXG59XG5cbmV4cG9ydCBjbGFzcyBNU0tTZXJ2ZXJsZXNzQ29udHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICAgIHB1YmxpYyBjZm5Nc2tTZXJ2ZXJsZXNzQ2x1c3RlcjogbXNrLkNmblNlcnZlcmxlc3NDbHVzdGVyO1xuICAgIHB1YmxpYyBjZm5DbHVzdGVyQXJuT3V0cHV0OiBDZm5PdXRwdXQ7XG4gICAgcHVibGljIGJvb3RzdHJhcFNlcnZlcnNPdXRwdXQ6IENmbk91dHB1dDtcblxuICAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBNU0tTZXJ2ZXJsZXNzQ29udHJ1Y3RQcm9wcykge1xuICAgICAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgICAgIC8vIG1zayBjbHVzdGVyXG4gICAgICAgIHRoaXMuY2ZuTXNrU2VydmVybGVzc0NsdXN0ZXIgPSBuZXcgbXNrLkNmblNlcnZlcmxlc3NDbHVzdGVyKHRoaXMsICdNU0tTZXJ2ZXJsZXNzQ2x1c3RlcicsIHtcbiAgICAgICAgICAgIGNsdXN0ZXJOYW1lOiBwcm9wcy5jbHVzdGVyTmFtZSxcblxuICAgICAgICAgICAgLy8gdW5hdXRoZW50aWNhdGVkXG4gICAgICAgICAgICBjbGllbnRBdXRoZW50aWNhdGlvbjoge1xuICAgICAgICAgICAgICAgIHNhc2w6IHtcbiAgICAgICAgICAgICAgICAgICAgaWFtOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICB2cGNDb25maWdzOiBbe1xuICAgICAgICAgICAgICAgIHN1Ym5ldElkczogcHJvcHMudnBjLnNlbGVjdFN1Ym5ldHMoe1xuICAgICAgICAgICAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgICAgICAgIH0pLnN1Ym5ldElkcyxcbiAgICAgICAgICAgICAgICBzZWN1cml0eUdyb3VwczogW3Byb3BzLm1za1NHLnNlY3VyaXR5R3JvdXBJZF0sXG4gICAgICAgICAgICB9XVxuXG4gICAgICAgIH0pOyAvLyBDZm5DbHVzdGVyXG5cbiAgICAgICAgLy8g8J+RhyBjcmVhdGUgYW4gb3V0cHV0IGZvciBjbHVzdGVyIEFSTlxuICAgICAgICB0aGlzLmNmbkNsdXN0ZXJBcm5PdXRwdXQgPSBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2x1c3RlckFyblNlcnZlcmxlc3NPdXRwdXQnLCB7XG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5jZm5Nc2tTZXJ2ZXJsZXNzQ2x1c3Rlci5hdHRyQXJuLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUaGUgQVJOIG9mIG91ciBzZXJ2ZXJsZXNzIE1TSyBjbHVzdGVyJyxcbiAgICAgICAgICAgIGV4cG9ydE5hbWU6ICdTZXJ2ZXJsZXNzTVNLQ2x1c3RlckFSTi0nICsgRGF0ZS5ub3coKS50b1N0cmluZygpLFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmNmbkNsdXN0ZXJBcm5PdXRwdXQubm9kZS5hZGREZXBlbmRlbmN5KHRoaXMuY2ZuTXNrU2VydmVybGVzc0NsdXN0ZXIpO1xuXG4gICAgICAgIC8vIGN1c3RvbSByZXNvdXJjZSBwb2xpY3kgdG8gZ2V0IGJvb3RzdHJhcCBicm9rZXJzIGZvciBvdXIgY2x1c3RlclxuICAgICAgICBjb25zdCBnZXRCb290c3RyYXBCcm9rZXJzID0gbmV3IGNyLkF3c0N1c3RvbVJlc291cmNlKHRoaXMsICdCb290c3RyYXBCcm9rZXJzU2VydmVybGVzc0xvb2t1cCcsIHtcbiAgICAgICAgICAgIG9uVXBkYXRlOiB7ICAgLy8gd2lsbCBhbHNvIGJlIGNhbGxlZCBmb3IgYSBDUkVBVEUgZXZlbnRcbiAgICAgICAgICAgICAgICBzZXJ2aWNlOiAnS2Fma2EnLFxuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2dldEJvb3RzdHJhcEJyb2tlcnMnLFxuICAgICAgICAgICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgQ2x1c3RlckFybjogdGhpcy5jZm5Nc2tTZXJ2ZXJsZXNzQ2x1c3Rlci5hdHRyQXJuXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZWdpb246IHByb3BzLnJlZ2lvbixcbiAgICAgICAgICAgICAgICBwaHlzaWNhbFJlc291cmNlSWQ6IGNyLlBoeXNpY2FsUmVzb3VyY2VJZC5vZihEYXRlLm5vdygpLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcG9saWN5OiBjci5Bd3NDdXN0b21SZXNvdXJjZVBvbGljeS5mcm9tU2RrQ2FsbHMoeyByZXNvdXJjZXM6IGNyLkF3c0N1c3RvbVJlc291cmNlUG9saWN5LkFOWV9SRVNPVVJDRSB9KVxuICAgICAgICB9KTtcblxuICAgICAgICBnZXRCb290c3RyYXBCcm9rZXJzLm5vZGUuYWRkRGVwZW5kZW5jeSh0aGlzLmNmbk1za1NlcnZlcmxlc3NDbHVzdGVyKTtcblxuICAgICAgICAvLyDwn5GHIGNyZWF0ZSBhbiBvdXRwdXQgZm9yIGJvb3RzdHJhcCBzZXJ2ZXJzXG4gICAgICAgIHRoaXMuYm9vdHN0cmFwU2VydmVyc091dHB1dCA9IG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTZXJ2ZXJsZXNzQm9vdHN0cmFwU2VydmVyc091dHB1dCcsIHtcbiAgICAgICAgICAgIHZhbHVlOiBnZXRCb290c3RyYXBCcm9rZXJzLmdldFJlc3BvbnNlRmllbGQoJ0Jvb3RzdHJhcEJyb2tlclN0cmluZ1Nhc2xJYW0nKSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBvZiBib290c3RyYXAgc2VydmVycyBmb3Igb3VyIFNlcnZlcmxlc3MgTVNLIGNsdXN0ZXInLFxuICAgICAgICAgICAgZXhwb3J0TmFtZTogJ1NlcnZlcmxlc3NNU0tCb290c3RyYXBTZXJ2ZXJzLScgKyBEYXRlLm5vdygpLnRvU3RyaW5nKCksXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYm9vdHN0cmFwU2VydmVyc091dHB1dC5ub2RlLmFkZERlcGVuZGVuY3koZ2V0Qm9vdHN0cmFwQnJva2Vycyk7XG5cbiAgICB9IC8vIGNvbnN0cnVjdG9yXG59IC8vIGNsYXNzIE1TS0NvbnN0cnVjdCJdfQ==