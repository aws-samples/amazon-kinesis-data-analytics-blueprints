"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KDAZepConstruct = void 0;
const constructs_1 = require("constructs");
const ec2 = require("aws-cdk-lib/aws-ec2");
const kinesisanalyticsv2 = require("aws-cdk-lib/aws-kinesisanalyticsv2");
class KDAZepConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
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
                            databaseArn: props.glueDataCatalog,
                        },
                    },
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
                    ],
                },
            },
        };
        // application
        this.kdaZepApp = new kinesisanalyticsv2.CfnApplication(this, "KDAZepApp", this.cfnApplicationProps);
        // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/iam-access-control-overview-cwl.html
        const logStreamArn = `arn:aws:logs:${props.region}` +
            `:${props.account}:log-group:` +
            `${props.logGroup.logGroupName}:log-stream:${props.logStream.logStreamName}`;
        // cw logging config for app
        this.cwlogsOption =
            new kinesisanalyticsv2.CfnApplicationCloudWatchLoggingOption(this, "KDAZepCWLogs", {
                applicationName: props.kdaAppName,
                cloudWatchLoggingOption: {
                    logStreamArn: logStreamArn,
                },
            });
        this.cwlogsOption.addDependsOn(this.kdaZepApp);
    }
}
exports.KDAZepConstruct = KDAZepConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2RhLXplcC1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJrZGEtemVwLWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSwyQ0FBdUM7QUFDdkMsMkNBQTJDO0FBQzNDLHlFQUF5RTtBQWlCekUsTUFBYSxlQUFnQixTQUFRLHNCQUFTO0lBSzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQiwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLG1CQUFtQixHQUFHO1lBQ3pCLGtCQUFrQixFQUFFLG9CQUFvQjtZQUV4Qyw4Q0FBOEM7WUFDOUMsMkRBQTJEO1lBQzNELG9DQUFvQztZQUNwQyxvQkFBb0IsRUFBRSxLQUFLLENBQUMsb0JBQW9CO1lBQ2hELGVBQWUsRUFBRSxLQUFLLENBQUMsVUFBVTtZQUNqQyxlQUFlLEVBQUUsYUFBYTtZQUU5Qix3QkFBd0IsRUFBRTtnQkFDeEIsaUJBQWlCLEVBQUU7b0JBQ2pCO3dCQUNFLFNBQVMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQzs0QkFDakMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CO3lCQUMvQyxDQUFDLENBQUMsU0FBUzt3QkFDWixnQkFBZ0IsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDO3FCQUNoRDtpQkFDRjtnQkFDRCxnQ0FBZ0MsRUFBRTtvQkFDaEMsdUJBQXVCLEVBQUU7d0JBQ3ZCLFFBQVEsRUFBRSxNQUFNO3FCQUNqQjtvQkFDRCxvQkFBb0IsRUFBRTt3QkFDcEIsNEJBQTRCLEVBQUU7NEJBQzVCLFdBQVcsRUFBRSxLQUFLLENBQUMsZUFBZTt5QkFDbkM7cUJBQ0Y7b0JBQ0QsNEJBQTRCLEVBQUU7d0JBQzVCOzRCQUNFLFlBQVksRUFBRSxnQkFBZ0I7NEJBQzlCLGNBQWMsRUFBRTtnQ0FDZCxPQUFPLEVBQUUsa0JBQWtCO2dDQUMzQixVQUFVLEVBQUUsNEJBQTRCO2dDQUN4QyxPQUFPLEVBQUUsUUFBUTs2QkFDbEI7eUJBQ0Y7d0JBQ0Q7NEJBQ0UsWUFBWSxFQUFFLGdCQUFnQjs0QkFDOUIsY0FBYyxFQUFFO2dDQUNkLE9BQU8sRUFBRSxxQkFBcUI7Z0NBQzlCLFVBQVUsRUFBRSxrQkFBa0I7Z0NBQzlCLE9BQU8sRUFBRSxPQUFPOzZCQUNqQjt5QkFDRjtxQkFDRjtpQkFDRjthQUNGO1NBQ0YsQ0FBQztRQUVGLGNBQWM7UUFDZCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksa0JBQWtCLENBQUMsY0FBYyxDQUNwRCxJQUFJLEVBQ0osV0FBVyxFQUNYLElBQUksQ0FBQyxtQkFBbUIsQ0FDekIsQ0FBQztRQUVGLGdHQUFnRztRQUNoRyxNQUFNLFlBQVksR0FDaEIsZ0JBQWdCLEtBQUssQ0FBQyxNQUFNLEVBQUU7WUFDOUIsSUFBSSxLQUFLLENBQUMsT0FBTyxhQUFhO1lBQzlCLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxZQUFZLGVBQWUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztRQUUvRSw0QkFBNEI7UUFDNUIsSUFBSSxDQUFDLFlBQVk7WUFDZixJQUFJLGtCQUFrQixDQUFDLHFDQUFxQyxDQUMxRCxJQUFJLEVBQ0osY0FBYyxFQUNkO2dCQUNFLGVBQWUsRUFBRSxLQUFLLENBQUMsVUFBVTtnQkFDakMsdUJBQXVCLEVBQUU7b0JBQ3ZCLFlBQVksRUFBRSxZQUFZO2lCQUMzQjthQUNGLENBQ0YsQ0FBQztRQUVKLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNqRCxDQUFDO0NBQ0Y7QUF2RkQsMENBdUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMgfSBmcm9tIFwiYXdzLWNkay1saWJcIjtcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSBcImF3cy1jZGstbGliL2F3cy1lYzJcIjtcbmltcG9ydCAqIGFzIGtpbmVzaXNhbmFseXRpY3N2MiBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWtpbmVzaXNhbmFseXRpY3N2MlwiO1xuaW1wb3J0IHsgYXdzX2xvZ3MgYXMgbG9ncyB9IGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0ICogYXMgZ2x1ZSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWdsdWVcIjtcblxuZXhwb3J0IGludGVyZmFjZSBLREFaZXBDb250cnVjdFByb3BzIGV4dGVuZHMgU3RhY2tQcm9wcyB7XG4gIGFjY291bnQ/OiBzdHJpbmc7XG4gIHJlZ2lvbj86IHN0cmluZztcbiAgdnBjOiBlYzIuVnBjO1xuICBtc2tTRzogZWMyLlNlY3VyaXR5R3JvdXA7XG4gIGxvZ0dyb3VwOiBsb2dzLkxvZ0dyb3VwO1xuICBsb2dTdHJlYW06IGxvZ3MuTG9nU3RyZWFtO1xuICBrZGFBcHBOYW1lOiBzdHJpbmc7XG4gIGdsdWVEYXRhQ2F0YWxvZzogc3RyaW5nO1xuICBydW50aW1lRW52aXJvbm1lbnQ6IHN0cmluZztcbiAgc2VydmljZUV4ZWN1dGlvblJvbGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEtEQVplcENvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyBjZm5BcHBsaWNhdGlvblByb3BzOiBraW5lc2lzYW5hbHl0aWNzdjIuQ2ZuQXBwbGljYXRpb25Qcm9wcztcbiAgcHVibGljIGtkYVplcEFwcDoga2luZXNpc2FuYWx5dGljc3YyLkNmbkFwcGxpY2F0aW9uO1xuICBwdWJsaWMgY3dsb2dzT3B0aW9uOiBraW5lc2lzYW5hbHl0aWNzdjIuQ2ZuQXBwbGljYXRpb25DbG91ZFdhdGNoTG9nZ2luZ09wdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogS0RBWmVwQ29udHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICAvLyBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIChhY3R1YWwgYXBwIGlzIGJlbG93KVxuICAgIHRoaXMuY2ZuQXBwbGljYXRpb25Qcm9wcyA9IHtcbiAgICAgIHJ1bnRpbWVFbnZpcm9ubWVudDogXCJaRVBQRUxJTi1GTElOSy0yXzBcIixcblxuICAgICAgLy8gVE9ETzogY2xlYXJseSBlbnVtZXJhdGUgbGlzdCBvZiBwZXJtaXNzaW9uc1xuICAgICAgLy8gdGhhdCB0aGlzIHJvbGUgbmVlZHMuIEZvciBpbnN0YW5jZSwgZm9yIGRlcGxveWluZyBpbiBWUENcbiAgICAgIC8vIHRoZSBLREEgYXBwIG5lZWRzIFZQQyByZWFkIGFjY2Vzc1xuICAgICAgc2VydmljZUV4ZWN1dGlvblJvbGU6IHByb3BzLnNlcnZpY2VFeGVjdXRpb25Sb2xlLFxuICAgICAgYXBwbGljYXRpb25OYW1lOiBwcm9wcy5rZGFBcHBOYW1lLFxuICAgICAgYXBwbGljYXRpb25Nb2RlOiBcIklOVEVSQUNUSVZFXCIsXG5cbiAgICAgIGFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbjoge1xuICAgICAgICB2cGNDb25maWd1cmF0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHN1Ym5ldElkczogcHJvcHMudnBjLnNlbGVjdFN1Ym5ldHMoe1xuICAgICAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICAgICAgfSkuc3VibmV0SWRzLFxuICAgICAgICAgICAgc2VjdXJpdHlHcm91cElkczogW3Byb3BzLm1za1NHLnNlY3VyaXR5R3JvdXBJZF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgemVwcGVsaW5BcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBtb25pdG9yaW5nQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgbG9nTGV2ZWw6IFwiSU5GT1wiLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY2F0YWxvZ0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgIGdsdWVEYXRhQ2F0YWxvZ0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgZGF0YWJhc2VBcm46IHByb3BzLmdsdWVEYXRhQ2F0YWxvZyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSwgLy8gY2F0YWxvZ0NvbmZpZ3VyYXRpb25cbiAgICAgICAgICBjdXN0b21BcnRpZmFjdHNDb25maWd1cmF0aW9uOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGFydGlmYWN0VHlwZTogXCJERVBFTkRFTkNZX0pBUlwiLFxuICAgICAgICAgICAgICBtYXZlblJlZmVyZW5jZToge1xuICAgICAgICAgICAgICAgIGdyb3VwSWQ6IFwib3JnLmFwYWNoZS5mbGlua1wiLFxuICAgICAgICAgICAgICAgIGFydGlmYWN0SWQ6IFwiZmxpbmstY29ubmVjdG9yLWthZmthXzIuMTJcIixcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiBcIjEuMTMuMlwiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgYXJ0aWZhY3RUeXBlOiBcIkRFUEVOREVOQ1lfSkFSXCIsXG4gICAgICAgICAgICAgIG1hdmVuUmVmZXJlbmNlOiB7XG4gICAgICAgICAgICAgICAgZ3JvdXBJZDogXCJzb2Z0d2FyZS5hbWF6b24ubXNrXCIsXG4gICAgICAgICAgICAgICAgYXJ0aWZhY3RJZDogXCJhd3MtbXNrLWlhbS1hdXRoXCIsXG4gICAgICAgICAgICAgICAgdmVyc2lvbjogXCIxLjEuMFwiLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLCAvLyBjdXN0b21BcnRpZmFjdHNDb25maWd1cmF0aW9uXG4gICAgICAgIH0sIC8vIHplcHBlbGluQXBwbGljYXRpb25Db25maWd1cmF0aW9uXG4gICAgICB9LFxuICAgIH07XG5cbiAgICAvLyBhcHBsaWNhdGlvblxuICAgIHRoaXMua2RhWmVwQXBwID0gbmV3IGtpbmVzaXNhbmFseXRpY3N2Mi5DZm5BcHBsaWNhdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICBcIktEQVplcEFwcFwiLFxuICAgICAgdGhpcy5jZm5BcHBsaWNhdGlvblByb3BzXG4gICAgKTtcblxuICAgIC8vIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9BbWF6b25DbG91ZFdhdGNoL2xhdGVzdC9sb2dzL2lhbS1hY2Nlc3MtY29udHJvbC1vdmVydmlldy1jd2wuaHRtbFxuICAgIGNvbnN0IGxvZ1N0cmVhbUFybiA9XG4gICAgICBgYXJuOmF3czpsb2dzOiR7cHJvcHMucmVnaW9ufWAgK1xuICAgICAgYDoke3Byb3BzLmFjY291bnR9OmxvZy1ncm91cDpgICtcbiAgICAgIGAke3Byb3BzLmxvZ0dyb3VwLmxvZ0dyb3VwTmFtZX06bG9nLXN0cmVhbToke3Byb3BzLmxvZ1N0cmVhbS5sb2dTdHJlYW1OYW1lfWA7XG5cbiAgICAvLyBjdyBsb2dnaW5nIGNvbmZpZyBmb3IgYXBwXG4gICAgdGhpcy5jd2xvZ3NPcHRpb24gPVxuICAgICAgbmV3IGtpbmVzaXNhbmFseXRpY3N2Mi5DZm5BcHBsaWNhdGlvbkNsb3VkV2F0Y2hMb2dnaW5nT3B0aW9uKFxuICAgICAgICB0aGlzLFxuICAgICAgICBcIktEQVplcENXTG9nc1wiLFxuICAgICAgICB7XG4gICAgICAgICAgYXBwbGljYXRpb25OYW1lOiBwcm9wcy5rZGFBcHBOYW1lLFxuICAgICAgICAgIGNsb3VkV2F0Y2hMb2dnaW5nT3B0aW9uOiB7XG4gICAgICAgICAgICBsb2dTdHJlYW1Bcm46IGxvZ1N0cmVhbUFybixcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgdGhpcy5jd2xvZ3NPcHRpb24uYWRkRGVwZW5kc09uKHRoaXMua2RhWmVwQXBwKTtcbiAgfVxufVxuIl19