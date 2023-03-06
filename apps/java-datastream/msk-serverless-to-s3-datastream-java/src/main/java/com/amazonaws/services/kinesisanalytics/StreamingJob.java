/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.amazonaws.services.kinesisanalytics;

import com.amazonaws.services.kinesisanalytics.orders.Order;
import com.amazonaws.services.kinesisanalytics.orders.OrderDateBucketAssigner;
import com.amazonaws.services.kinesisanalytics.orders.OrderDeserializationSchema;
import com.amazonaws.services.kinesisanalytics.runtime.KinesisAnalyticsRuntime;
import org.apache.avro.Schema;
import org.apache.avro.generic.GenericRecord;
import org.apache.flink.api.common.RuntimeExecutionMode;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.connector.file.sink.FileSink;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.KafkaSourceBuilder;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.core.fs.Path;
import org.apache.flink.formats.avro.typeutils.GenericRecordAvroTypeInfo;
import org.apache.flink.formats.parquet.avro.ParquetAvroWriters;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.datastream.DataStreamSink;
import org.apache.flink.streaming.api.environment.LocalStreamEnvironment;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.functions.sink.filesystem.rollingpolicies.OnCheckpointRollingPolicy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;
import java.util.Properties;

public class StreamingJob {

	private static final Logger LOG = LoggerFactory.getLogger(StreamingJob.class);

	private static final String SERVERLESS_MSKBOOTSTRAP_SERVERS = "ServerlessMSKBootstrapServers";
	private static final String KAFKA_SOURCE_TOPIC_KEY = "KafkaSourceTopic";
	private static final String KAFKA_CONSUMER_GROUP_ID_KEY = "KafkaConsumerGroupId";
	private static final String S3_DEST_KEY = "S3DestinationBucket";
	private static final String SINK_PARALLELISM_KEY = "SinkParallelism";
	private static final String PARTITION_FORMAT_KEY = "PartitionFormat";

	private static Properties getAppProperties() throws IOException {
		// note: this won't work when running locally
		Map<String, Properties> applicationProperties = KinesisAnalyticsRuntime.getApplicationProperties();
		Properties flinkProperties = applicationProperties.get("FlinkApplicationProperties");

		if(flinkProperties == null) {
			LOG.error("Unable to retrieve FlinkApplicationProperties; please ensure that you've " +
					"supplied them via application properties.");
			return null;
		}

		if(!flinkProperties.containsKey(SERVERLESS_MSKBOOTSTRAP_SERVERS)) {
			LOG.error("Unable to retrieve property: " + SERVERLESS_MSKBOOTSTRAP_SERVERS);
			return null;
		}

		if(!flinkProperties.containsKey(KAFKA_SOURCE_TOPIC_KEY)) {
			LOG.error("Unable to retrieve property: " + KAFKA_SOURCE_TOPIC_KEY);
			return null;
		}

		if(!flinkProperties.containsKey(KAFKA_CONSUMER_GROUP_ID_KEY)) {
			LOG.error("Unable to retrieve property: " + KAFKA_CONSUMER_GROUP_ID_KEY);
			return null;
		}

		if(!flinkProperties.containsKey(S3_DEST_KEY)) {
			LOG.error("Unable to retrieve property: " + S3_DEST_KEY);
			return null;
		}

		if(!flinkProperties.containsKey(PARTITION_FORMAT_KEY)) {
			LOG.error("Unable to retrieve property: " + PARTITION_FORMAT_KEY);
			return null;
		}

		return flinkProperties;
	}

	private static boolean isLocal(StreamExecutionEnvironment env) {
		return env instanceof LocalStreamEnvironment;
	}

	private static KafkaSource<Order> getKafkaSource(StreamExecutionEnvironment env,
													 Properties appProperties) {

		KafkaSourceBuilder<Order> builder =
				KafkaSource.builder();

		// different values for local
		String brokers = "localhost:9092";
		String inputTopic = "DatagenTopic";
		String consumerGroupId = "myConsumerGroup";
		if(!isLocal(env)) {
			brokers = appProperties.get(SERVERLESS_MSKBOOTSTRAP_SERVERS).toString();
			inputTopic = appProperties.get(KAFKA_SOURCE_TOPIC_KEY).toString();
			consumerGroupId = appProperties.get(KAFKA_CONSUMER_GROUP_ID_KEY).toString();

			// setup IAM auth
			builder.setProperty("security.protocol", "SASL_SSL");
			builder.setProperty("sasl.mechanism", "AWS_MSK_IAM");
			builder.setProperty("sasl.jaas.config", "software.amazon.msk.auth.iam.IAMLoginModule required;");
			builder.setProperty("sasl.client.callback.handler.class", "software.amazon.msk.auth.iam.IAMClientCallbackHandler");
		}

		KafkaSource<Order> source = builder
				.setBootstrapServers(brokers)
				.setTopics(inputTopic)
				.setGroupId(consumerGroupId)
				.setStartingOffsets(OffsetsInitializer.earliest())
				.setValueOnlyDeserializer(new OrderDeserializationSchema())
				.build();

		return source;
	}

	private static FileSink<Order> getFileSink(StreamExecutionEnvironment env,
													   Properties appProperties) {
		String outputPath = "/tmp/flinkout";
		if(!isLocal(env)) {
			outputPath = appProperties.get(S3_DEST_KEY).toString();
		}

		String partitionFormat = "yyyy-MM-dd-HH";
		if(!isLocal(env)) {
			partitionFormat = appProperties.get(PARTITION_FORMAT_KEY).toString();
		}

		Path path = new Path(outputPath);

		String prefix = String.format("%sjob_start=%s/", "app-kda-kafka-to-s3", System.currentTimeMillis());

		final FileSink<Order> sink = FileSink
				.forBulkFormat(path, ParquetAvroWriters.forReflectRecord(Order.class))
				.withBucketAssigner(new OrderDateBucketAssigner(partitionFormat, prefix))
				.withRollingPolicy(OnCheckpointRollingPolicy.build())
				.build();

		return sink;
	}

	private static void runAppWithKafkaSource(StreamExecutionEnvironment env,
											  Properties appProperties) {

		KafkaSource<Order> orderSource = getKafkaSource(env, appProperties);
		DataStream<Order> orderStream = env.fromSource(orderSource,
				WatermarkStrategy.noWatermarks(),
				"Kafka Source");

		FileSink<Order> fSink = getFileSink(env, appProperties);
		DataStreamSink<Order> sink = orderStream.sinkTo(fSink).name("File Sink");

		if(!isLocal(env) && appProperties.containsKey(SINK_PARALLELISM_KEY)) {
			int sinkParallelism = Integer.parseInt(appProperties.get(SINK_PARALLELISM_KEY).toString());

			sink.setParallelism(sinkParallelism);
		}
	}

	public static void main(String[] args) throws Exception {
		// set up the streaming execution environment
		final StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
		env.setRuntimeMode(RuntimeExecutionMode.STREAMING);

		// Only for debugging
		// TODO: remove this
		env.disableOperatorChaining();

		// Only for local
		// Configure via KDA when running in cloud
		if(isLocal(env)) {
			env.enableCheckpointing(2000);

			env.setParallelism(2);
		}

		Properties appProperties = null;
		if(!isLocal(env)) {
			appProperties = getAppProperties();
			if(appProperties == null) {
				LOG.error("Incorrectly specified application properties. Exiting...");
				return;
			}
		}

		runAppWithKafkaSource(env, appProperties);

		// execute program
		env.execute("KDA MSK to S3 Flink Streaming App");
	} // main
} // class