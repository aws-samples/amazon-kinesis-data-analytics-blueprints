# List of TODOs

The initial focus was on getting the overall structure and flow working. Some important TODOs:

1. Tighten up permissions for KDA IAM role (in CDK scripts).
2. Fix order schema loading (load from resource file - `OrderSchema.avsc`, instead of embedding order schema as string).
3. Fix parsing of timestamp in Order schema.
4. Clearly list Flink version and dependencies in all samples (Consider using git branches to handle multiple Flink versions).
5. Comment and refactor code in blueprints.
6. Need to break down samples by Flink version. For many blueprints, we will have to maintain entries by Flink version (for instance, v1.11 w/ StreamingFileSink and v1.13 with FileSink).
7. Use Code* tools to build and deploy (instead of having the user build it) as part of initial deployment.
8. Automated testing to ensure that the quality is good and contributions can scale. Consult Flink doc on how to test Flink apps.

## Parking lot

1. Separate - add guidance on running apps locally (may not always be possible - for instance, Kinesis - is LocalStack being kept up to date?).