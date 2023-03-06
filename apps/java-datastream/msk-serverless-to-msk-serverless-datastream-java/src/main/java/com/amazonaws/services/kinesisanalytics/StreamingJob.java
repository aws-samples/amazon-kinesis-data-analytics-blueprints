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
import com.amazonaws.services.kinesisanalytics.orders.OrderDeserializationSchema;
import com.amazonaws.services.kinesisanalytics.orders.OrderSerializationSchema;
import com.amazonaws.services.kinesisanalytics.runtime.KinesisAnalyticsRuntime;
import org.apache.flink.api.common.RuntimeExecutionMode;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.connector.base.DeliveryGuarantee;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.sink.KafkaSinkBuilder;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.KafkaSourceBuilder;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.datastream.DataStreamSink;
import org.apache.flink.streaming.api.environment.LocalStreamEnvironment;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;
import java.util.Properties;

public class StreamingJob {

	private static final Logger LOG = LoggerFactory.getLogger(StreamingJob.class);

	private static final String SOURCE_SERVERLESS_MSK_BOOTSTRAP_SERVERS = "SourceServerlessMSKBootstrapServers";
	private static final String SINK_SERVERLESS_MSK_BOOTSTRAP_SERVERS = "SinkServerlessMSKBootstrapServers";

	private static final String KAFKA_SOURCE_TOPIC_KEY = "KafkaSourceTopic";
	private static final String KAFKA_SINK_TOPIC_KEY = "KafkaSinkTopic";
	private static final String KAFKA_CONSUMER_GROUP_ID_KEY = "KafkaConsumerGroupId";

	private static final String SINK_PARALLELISM_KEY = "SinkParallelism";


	private static Properties getAppProperties() throws IOException {
		// note: this won't work when running locally
		Map<String, Properties> applicationProperties = KinesisAnalyticsRuntime.getApplicationProperties();
		Properties flinkProperties = applicationProperties.get("FlinkApplicationProperties");

		if(flinkProperties == null) {
			LOG.error("Unable to retrieve FlinkApplicationProperties; please ensure that you've " +
					"supplied them via application properties.");
			return null;
		}

		if(!flinkProperties.containsKey(SOURCE_SERVERLESS_MSK_BOOTSTRAP_SERVERS)) {
			LOG.error("Unable to retrieve property: " + SOURCE_SERVERLESS_MSK_BOOTSTRAP_SERVERS);
			return null;
		}

		if(!flinkProperties.containsKey(SINK_SERVERLESS_MSK_BOOTSTRAP_SERVERS)) {
			LOG.error("Unable to retrieve property: " + SINK_SERVERLESS_MSK_BOOTSTRAP_SERVERS);
			return null;
		}

		if(!flinkProperties.containsKey(KAFKA_SOURCE_TOPIC_KEY)) {
			LOG.error("Unable to retrieve property: " + KAFKA_SOURCE_TOPIC_KEY);
			return null;
		}

		if(!flinkProperties.containsKey(KAFKA_SINK_TOPIC_KEY)) {
			LOG.error("Unable to retrieve property: " + KAFKA_SINK_TOPIC_KEY);
			return null;
		}

		if(!flinkProperties.containsKey(KAFKA_CONSUMER_GROUP_ID_KEY)) {
			LOG.error("Unable to retrieve property: " + KAFKA_CONSUMER_GROUP_ID_KEY);
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
			brokers = appProperties.get(SOURCE_SERVERLESS_MSK_BOOTSTRAP_SERVERS).toString();
			inputTopic = appProperties.get(KAFKA_SOURCE_TOPIC_KEY).toString();
			consumerGroupId = appProperties.get(KAFKA_CONSUMER_GROUP_ID_KEY).toString();

			// setup IAM auth
			builder.setProperty("security.protocol", "SASL_SSL");
			builder.setProperty("sasl.mechanism", "AWS_MSK_IAM");
			builder.setProperty("sasl.jaas.config", "software.amazon.msk.auth.iam.IAMLoginModule required;");
			builder.setProperty("sasl.client.callback.handler.class", "software.amazon.msk.auth.iam.IAMClientCallbackHandler");
		}

		return builder
				.setBootstrapServers(brokers)
				.setTopics(inputTopic)
				.setGroupId(consumerGroupId)
				.setStartingOffsets(OffsetsInitializer.earliest())
				.setValueOnlyDeserializer(new OrderDeserializationSchema())
				.build();
	}

	private static KafkaSink<Order> getKafkaSink(StreamExecutionEnvironment env,
										  Properties appProperties) {

		KafkaSinkBuilder<Order> builder =
				KafkaSink.builder();

		Properties sinkProperties = new Properties();
		// different values for local
		String brokers = "localhost:9092";
		String outputTopic = "OutputTopic";

		if(!isLocal(env)) {

			brokers = appProperties.get(SINK_SERVERLESS_MSK_BOOTSTRAP_SERVERS).toString();
			outputTopic = appProperties.get(KAFKA_SINK_TOPIC_KEY).toString();

			// setup IAM auth
			sinkProperties.setProperty("security.protocol", "SASL_SSL");
			sinkProperties.setProperty("sasl.mechanism", "AWS_MSK_IAM");
			sinkProperties.setProperty("sasl.jaas.config", "software.amazon.msk.auth.iam.IAMLoginModule required;");
			sinkProperties.setProperty("sasl.client.callback.handler.class", "software.amazon.msk.auth.iam.IAMClientCallbackHandler");
		}


		return builder
				.setBootstrapServers(brokers)
				.setRecordSerializer(KafkaRecordSerializationSchema.builder()
						.setTopic(outputTopic)
						.setValueSerializationSchema(new OrderSerializationSchema<Order>())
						.build())
				.setKafkaProducerConfig(sinkProperties)
				.setDeliverGuarantee(DeliveryGuarantee.AT_LEAST_ONCE)
				.build();
	}


	private static void runAppWithKafkaSource(StreamExecutionEnvironment env,
											  Properties appProperties) {

		KafkaSource<Order> orderSource = getKafkaSource(env, appProperties);
		DataStream<Order> orderStream = env.fromSource(orderSource,
				WatermarkStrategy.noWatermarks(),
				"Kafka Source");

		KafkaSink<Order> orderSink = getKafkaSink(env, appProperties);
		DataStreamSink<Order> sink = orderStream.sinkTo(orderSink).name("Kafka Sink");

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
			env.enableCheckpointing(60000);

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
		env.execute("KDA MSK to MSK Flink Streaming App");
	} // main
} // class