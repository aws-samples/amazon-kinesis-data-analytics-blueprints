"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KDAConstruct = void 0;
const constructs_1 = require("constructs");
const ec2 = require("aws-cdk-lib/aws-ec2");
const kinesisanalyticsv2 = require("aws-cdk-lib/aws-kinesisanalyticsv2");
class KDAConstruct extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // application properties (actual app is below)
        this.cfnApplicationProps = {
            runtimeEnvironment: props.runtimeEnvironment,
            // TODO: clearly enumerate list of permissions
            // that this role needs. For instance, for deploying in VPC
            // the KDA app needs VPC read access
            serviceExecutionRole: props.serviceExecutionRole,
            applicationName: props.kdaAppName,
            applicationConfiguration: {
                flinkApplicationConfiguration: {
                    checkpointConfiguration: {
                        configurationType: 'CUSTOM',
                        checkpointingEnabled: true,
                        checkpointInterval: 60000,
                        minPauseBetweenCheckpoints: 5000
                    },
                    monitoringConfiguration: {
                        configurationType: "CUSTOM",
                        metricsLevel: "OPERATOR",
                        logLevel: "INFO"
                    },
                    parallelismConfiguration: {
                        configurationType: "CUSTOM",
                        parallelism: 2,
                        parallelismPerKpu: 1,
                        autoScalingEnabled: true
                    }
                },
                vpcConfigurations: [
                    {
                        subnetIds: props.vpc.selectSubnets({
                            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                        }).subnetIds,
                        securityGroupIds: [props.mskSG.securityGroupId]
                    }
                ],
                environmentProperties: {
                    propertyGroups: [
                        {
                            propertyGroupId: "FlinkApplicationProperties",
                            propertyMap: {
                                "S3DestinationBucket": props.appSinkBucket,
                                "MSKBootstrapServers": props.bootstrapServersString,
                                "ServerlessMSKBootstrapServers": props.serverlessBootstrapServersString,
                                "KafkaSourceTopic": "DatagenJsonTopic",
                                "KafkaConsumerGroupId": "KDAFlinkConsumerGroup",
                            }
                        },
                        {
                            propertyGroupId: "PropertyGroup2",
                            propertyMap: {
                                "Key1": "Value1",
                                "Key2": "Value2"
                            }
                        }
                    ]
                },
                applicationCodeConfiguration: {
                    codeContent: {
                        s3ContentLocation: {
                            bucketArn: `arn:aws:s3:::${props.appBucket}`,
                            fileKey: props.appFileKeyOnS3
                        }
                    },
                    codeContentType: "ZIPFILE"
                },
                applicationSnapshotConfiguration: {
                    snapshotsEnabled: false
                }
            }
        };
        // application
        this.kdaApp =
            new kinesisanalyticsv2.CfnApplication(this, 'KDAApp', this.cfnApplicationProps);
        // https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/iam-access-control-overview-cwl.html
        const logStreamArn = `arn:aws:logs:${props.region}` +
            `:${props.account}:log-group:` +
            `${props.logGroup.logGroupName}:log-stream:${props.logStream.logStreamName}`;
        // cw logging config for app
        this.cwlogsOption = new kinesisanalyticsv2.CfnApplicationCloudWatchLoggingOption(this, 'KDACWLogs', {
            applicationName: props.kdaAppName,
            cloudWatchLoggingOption: {
                logStreamArn: logStreamArn
            }
        });
        this.cwlogsOption.addDependsOn(this.kdaApp);
    }
}
exports.KDAConstruct = KDAConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2RhLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImtkYS1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsMkNBQXVDO0FBQ3ZDLDJDQUEyQztBQUMzQyx5RUFBeUU7QUFxQnpFLE1BQWEsWUFBYSxTQUFRLHNCQUFTO0lBS3ZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBdUI7UUFDN0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQiwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDLG1CQUFtQixHQUFHO1lBQ3ZCLGtCQUFrQixFQUFFLEtBQUssQ0FBQyxrQkFBa0I7WUFFNUMsOENBQThDO1lBQzlDLDJEQUEyRDtZQUMzRCxvQ0FBb0M7WUFDcEMsb0JBQW9CLEVBQUUsS0FBSyxDQUFDLG9CQUFvQjtZQUNoRCxlQUFlLEVBQUUsS0FBSyxDQUFDLFVBQVU7WUFFakMsd0JBQXdCLEVBQUU7Z0JBQ3RCLDZCQUE2QixFQUFFO29CQUMzQix1QkFBdUIsRUFBRTt3QkFDckIsaUJBQWlCLEVBQUUsUUFBUTt3QkFDM0Isb0JBQW9CLEVBQUUsSUFBSTt3QkFDMUIsa0JBQWtCLEVBQUUsS0FBSzt3QkFDekIsMEJBQTBCLEVBQUUsSUFBSTtxQkFDbkM7b0JBQ0QsdUJBQXVCLEVBQUU7d0JBQ3JCLGlCQUFpQixFQUFFLFFBQVE7d0JBQzNCLFlBQVksRUFBRSxVQUFVO3dCQUN4QixRQUFRLEVBQUUsTUFBTTtxQkFDbkI7b0JBQ0Qsd0JBQXdCLEVBQUU7d0JBQ3RCLGlCQUFpQixFQUFFLFFBQVE7d0JBQzNCLFdBQVcsRUFBRSxDQUFDO3dCQUNkLGlCQUFpQixFQUFFLENBQUM7d0JBQ3BCLGtCQUFrQixFQUFFLElBQUk7cUJBQzNCO2lCQUNKO2dCQUNELGlCQUFpQixFQUFFO29CQUNmO3dCQUNJLFNBQVMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQzs0QkFDL0IsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CO3lCQUMvQyxDQUFDLENBQUMsU0FBUzt3QkFDZCxnQkFBZ0IsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDO3FCQUNsRDtpQkFDSjtnQkFDRCxxQkFBcUIsRUFBRTtvQkFDbkIsY0FBYyxFQUFFO3dCQUNaOzRCQUNJLGVBQWUsRUFBRSw0QkFBNEI7NEJBQzdDLFdBQVcsRUFBRTtnQ0FDVCxxQkFBcUIsRUFBRSxLQUFLLENBQUMsYUFBYTtnQ0FDMUMscUJBQXFCLEVBQUUsS0FBSyxDQUFDLHNCQUFzQjtnQ0FDbkQsK0JBQStCLEVBQUUsS0FBSyxDQUFDLGdDQUFnQztnQ0FDdkUsa0JBQWtCLEVBQUUsa0JBQWtCO2dDQUN0QyxzQkFBc0IsRUFBRSx1QkFBdUI7NkJBQ2xEO3lCQUNKO3dCQUNEOzRCQUNJLGVBQWUsRUFBRSxnQkFBZ0I7NEJBQ2pDLFdBQVcsRUFBRTtnQ0FDVCxNQUFNLEVBQUUsUUFBUTtnQ0FDaEIsTUFBTSxFQUFDLFFBQVE7NkJBQ2xCO3lCQUNKO3FCQUNKO2lCQUNKO2dCQUNELDRCQUE0QixFQUFFO29CQUMxQixXQUFXLEVBQUU7d0JBQ1QsaUJBQWlCLEVBQUU7NEJBQ2YsU0FBUyxFQUFFLGdCQUFnQixLQUFLLENBQUMsU0FBUyxFQUFFOzRCQUM1QyxPQUFPLEVBQUUsS0FBSyxDQUFDLGNBQWM7eUJBQ2hDO3FCQUNKO29CQUNELGVBQWUsRUFBRSxTQUFTO2lCQUM3QjtnQkFDRCxnQ0FBZ0MsRUFBRTtvQkFDOUIsZ0JBQWdCLEVBQUUsS0FBSztpQkFDMUI7YUFDSjtTQUNKLENBQUE7UUFFRCxjQUFjO1FBQ2QsSUFBSSxDQUFDLE1BQU07WUFDUixJQUFJLGtCQUFrQixDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBRW5GLGdHQUFnRztRQUNoRyxNQUFNLFlBQVksR0FBRyxnQkFBZ0IsS0FBSyxDQUFDLE1BQU0sRUFBRTtZQUNuRCxJQUFJLEtBQUssQ0FBQyxPQUFPLGFBQWE7WUFDOUIsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLFlBQVksZUFBZSxLQUFLLENBQUMsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBRTdFLDRCQUE0QjtRQUM1QixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksa0JBQWtCLENBQUMscUNBQXFDLENBQzVFLElBQUksRUFDSixXQUFXLEVBQ1g7WUFDSSxlQUFlLEVBQUUsS0FBSyxDQUFDLFVBQVU7WUFDakMsdUJBQXVCLEVBQUU7Z0JBQ3JCLFlBQVksRUFBRSxZQUFZO2FBQzdCO1NBQ0osQ0FDSixDQUFDO1FBRUYsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWhELENBQUM7Q0FDSjtBQTFHRCxvQ0EwR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcyB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMga2luZXNpc2FuYWx5dGljc3YyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1raW5lc2lzYW5hbHl0aWNzdjInO1xuaW1wb3J0IHsgYXdzX2xvZ3MgYXMgbG9ncyB9IGZyb20gJ2F3cy1jZGstbGliJztcblxuXG5leHBvcnQgaW50ZXJmYWNlIEtEQUNvbnRydWN0UHJvcHMgZXh0ZW5kcyBTdGFja1Byb3BzIHtcbiAgICBhY2NvdW50OiBzdHJpbmcsXG4gICAgcmVnaW9uOiBzdHJpbmcsXG4gICAgdnBjOiBlYzIuVnBjLFxuICAgIG1za1NHOiBlYzIuU2VjdXJpdHlHcm91cCxcbiAgICBsb2dHcm91cDogbG9ncy5Mb2dHcm91cCxcbiAgICBsb2dTdHJlYW06IGxvZ3MuTG9nU3RyZWFtLFxuICAgIGtkYUFwcE5hbWU6IHN0cmluZyxcbiAgICBhcHBCdWNrZXQ6IHN0cmluZyxcbiAgICBhcHBGaWxlS2V5T25TMzogc3RyaW5nLFxuICAgIGFwcFNpbmtCdWNrZXQ6IHN0cmluZyxcbiAgICBydW50aW1lRW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgICBzZXJ2aWNlRXhlY3V0aW9uUm9sZTogc3RyaW5nLFxuICAgIGJvb3RzdHJhcFNlcnZlcnNTdHJpbmc6IHN0cmluZyxcbiAgICBzZXJ2ZXJsZXNzQm9vdHN0cmFwU2VydmVyc1N0cmluZzogc3RyaW5nLFxufVxuXG5leHBvcnQgY2xhc3MgS0RBQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgICBwdWJsaWMgY2ZuQXBwbGljYXRpb25Qcm9wczoga2luZXNpc2FuYWx5dGljc3YyLkNmbkFwcGxpY2F0aW9uUHJvcHM7XG4gICAgcHVibGljIGtkYUFwcDoga2luZXNpc2FuYWx5dGljc3YyLkNmbkFwcGxpY2F0aW9uO1xuICAgIHB1YmxpYyBjd2xvZ3NPcHRpb246IGtpbmVzaXNhbmFseXRpY3N2Mi5DZm5BcHBsaWNhdGlvbkNsb3VkV2F0Y2hMb2dnaW5nT3B0aW9uO1xuXG4gICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEtEQUNvbnRydWN0UHJvcHMpIHtcbiAgICAgICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgICAgICAvLyBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIChhY3R1YWwgYXBwIGlzIGJlbG93KVxuICAgICAgICB0aGlzLmNmbkFwcGxpY2F0aW9uUHJvcHMgPSB7XG4gICAgICAgICAgICBydW50aW1lRW52aXJvbm1lbnQ6IHByb3BzLnJ1bnRpbWVFbnZpcm9ubWVudCxcblxuICAgICAgICAgICAgLy8gVE9ETzogY2xlYXJseSBlbnVtZXJhdGUgbGlzdCBvZiBwZXJtaXNzaW9uc1xuICAgICAgICAgICAgLy8gdGhhdCB0aGlzIHJvbGUgbmVlZHMuIEZvciBpbnN0YW5jZSwgZm9yIGRlcGxveWluZyBpbiBWUENcbiAgICAgICAgICAgIC8vIHRoZSBLREEgYXBwIG5lZWRzIFZQQyByZWFkIGFjY2Vzc1xuICAgICAgICAgICAgc2VydmljZUV4ZWN1dGlvblJvbGU6IHByb3BzLnNlcnZpY2VFeGVjdXRpb25Sb2xlLFxuICAgICAgICAgICAgYXBwbGljYXRpb25OYW1lOiBwcm9wcy5rZGFBcHBOYW1lLFxuXG4gICAgICAgICAgICBhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICBmbGlua0FwcGxpY2F0aW9uQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICBjaGVja3BvaW50Q29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlndXJhdGlvblR5cGU6ICdDVVNUT00nLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2twb2ludGluZ0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjaGVja3BvaW50SW50ZXJ2YWw6IDYwMDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWluUGF1c2VCZXR3ZWVuQ2hlY2twb2ludHM6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbW9uaXRvcmluZ0NvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25UeXBlOiBcIkNVU1RPTVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWV0cmljc0xldmVsOiBcIk9QRVJBVE9SXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dMZXZlbDogXCJJTkZPXCJcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcGFyYWxsZWxpc21Db25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWd1cmF0aW9uVHlwZTogXCJDVVNUT01cIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFsbGVsaXNtOiAyLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYWxsZWxpc21QZXJLcHU6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdXRvU2NhbGluZ0VuYWJsZWQ6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdnBjQ29uZmlndXJhdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VibmV0SWRzOiBwcm9wcy52cGMuc2VsZWN0U3VibmV0cyh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuc3VibmV0SWRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VjdXJpdHlHcm91cElkczogW3Byb3BzLm1za1NHLnNlY3VyaXR5R3JvdXBJZF1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgZW52aXJvbm1lbnRQcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5R3JvdXBzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlHcm91cElkOiBcIkZsaW5rQXBwbGljYXRpb25Qcm9wZXJ0aWVzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlNYXA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJTM0Rlc3RpbmF0aW9uQnVja2V0XCI6IHByb3BzLmFwcFNpbmtCdWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTVNLQm9vdHN0cmFwU2VydmVyc1wiOiBwcm9wcy5ib290c3RyYXBTZXJ2ZXJzU3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlNlcnZlcmxlc3NNU0tCb290c3RyYXBTZXJ2ZXJzXCI6IHByb3BzLnNlcnZlcmxlc3NCb290c3RyYXBTZXJ2ZXJzU3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkthZmthU291cmNlVG9waWNcIjogXCJEYXRhZ2VuSnNvblRvcGljXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiS2Fma2FDb25zdW1lckdyb3VwSWRcIjogXCJLREFGbGlua0NvbnN1bWVyR3JvdXBcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5R3JvdXBJZDogXCJQcm9wZXJ0eUdyb3VwMlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5TWFwOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiS2V5MVwiOiBcIlZhbHVlMVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIktleTJcIjpcIlZhbHVlMlwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbkNvZGVDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGVDb250ZW50OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzM0NvbnRlbnRMb2NhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1Y2tldEFybjogYGFybjphd3M6czM6Ojoke3Byb3BzLmFwcEJ1Y2tldH1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVLZXk6IHByb3BzLmFwcEZpbGVLZXlPblMzXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvZGVDb250ZW50VHlwZTogXCJaSVBGSUxFXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uU25hcHNob3RDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIHNuYXBzaG90c0VuYWJsZWQ6IGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXBwbGljYXRpb25cbiAgICAgICAgdGhpcy5rZGFBcHAgPVxuICAgICAgICAgICBuZXcga2luZXNpc2FuYWx5dGljc3YyLkNmbkFwcGxpY2F0aW9uKHRoaXMsICdLREFBcHAnLCB0aGlzLmNmbkFwcGxpY2F0aW9uUHJvcHMpO1xuXG4gICAgICAgIC8vIGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9BbWF6b25DbG91ZFdhdGNoL2xhdGVzdC9sb2dzL2lhbS1hY2Nlc3MtY29udHJvbC1vdmVydmlldy1jd2wuaHRtbFxuICAgICAgICBjb25zdCBsb2dTdHJlYW1Bcm4gPSBgYXJuOmF3czpsb2dzOiR7cHJvcHMucmVnaW9ufWAgK1xuICAgICAgICBgOiR7cHJvcHMuYWNjb3VudH06bG9nLWdyb3VwOmAgK1xuICAgICAgICBgJHtwcm9wcy5sb2dHcm91cC5sb2dHcm91cE5hbWV9OmxvZy1zdHJlYW06JHtwcm9wcy5sb2dTdHJlYW0ubG9nU3RyZWFtTmFtZX1gO1xuXG4gICAgICAgIC8vIGN3IGxvZ2dpbmcgY29uZmlnIGZvciBhcHBcbiAgICAgICAgdGhpcy5jd2xvZ3NPcHRpb24gPSBuZXcga2luZXNpc2FuYWx5dGljc3YyLkNmbkFwcGxpY2F0aW9uQ2xvdWRXYXRjaExvZ2dpbmdPcHRpb24oXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgJ0tEQUNXTG9ncycsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb25OYW1lOiBwcm9wcy5rZGFBcHBOYW1lLFxuICAgICAgICAgICAgICAgIGNsb3VkV2F0Y2hMb2dnaW5nT3B0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ1N0cmVhbUFybjogbG9nU3RyZWFtQXJuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuY3dsb2dzT3B0aW9uLmFkZERlcGVuZHNPbih0aGlzLmtkYUFwcCk7XG5cbiAgICB9XG59Il19