package com.amazonaws;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.Properties;
import java.util.UUID;

public class MSKDataGen {
    private static final Integer DEFAULT_NUM_MSGS_TO_SEND = 10000;
    private static final Integer DEFAULT_FLUSH_BATCH_SIZE = 1000;
    private static final Boolean DEFAULT_THREAD_SLEEP_SETTING = false;
    private static final Integer DEFAULT_THREAD_SLEEP_INTERVAL_IN_MS = 100;

    private KafkaProducer<String, String> kafkaProducer = null;

    private String bootstrapServers;
    private String topicName;
    private Integer numMessagesToSend;
    private Integer flushBatchSize;
    private Boolean threadSleepSetting;
    private Integer threadSleepIntervalInMs;

    public MSKDataGen(String bootstrapServers,
                      String topicName,
                      Integer numMsgsToSend) {
        this.bootstrapServers = bootstrapServers;
        this.topicName = topicName;
        this.numMessagesToSend = numMsgsToSend;
        this.flushBatchSize = DEFAULT_FLUSH_BATCH_SIZE;
        this.threadSleepSetting = DEFAULT_THREAD_SLEEP_SETTING;
        this.threadSleepIntervalInMs = DEFAULT_THREAD_SLEEP_INTERVAL_IN_MS;
    }

    public MSKDataGen(String bootstrapServers,
                      String topicName) {
        this.bootstrapServers = bootstrapServers;
        this.topicName = topicName;
        this.numMessagesToSend = DEFAULT_NUM_MSGS_TO_SEND;
        this.flushBatchSize = DEFAULT_FLUSH_BATCH_SIZE;
        this.threadSleepSetting = DEFAULT_THREAD_SLEEP_SETTING;
        this.threadSleepIntervalInMs = DEFAULT_THREAD_SLEEP_INTERVAL_IN_MS;
    }

    public Properties getProperties() {
        Properties properties = new Properties();

        // Failed to generate data Missing required configuration "key.serializer" which has no default value.
        properties.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, this.bootstrapServers);
        properties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        properties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        properties.put(ProducerConfig.LINGER_MS_CONFIG, 100);
        properties.put("client.id", "lambda-client-datagen");
        properties.put("security.protocol", "SASL_SSL");
        properties.put("sasl.mechanism", "AWS_MSK_IAM");
        properties.put("sasl.jaas.config", "software.amazon.msk.auth.iam.IAMLoginModule required;");
        properties.put("sasl.client.callback.handler.class",
                       "software.amazon.msk.auth.iam.IAMClientCallbackHandler");

        return properties;
    }

    public void run() throws Exception {
        try {
            int trackerForFlush = 0;
            for (int i = 0; i < numMessagesToSend; i++, trackerForFlush++) {
                String key = UUID.randomUUID().toString();
                String message = UUID.randomUUID().toString();

                sendMsg(topicName, key, message);

                if(trackerForFlush >= flushBatchSize) {
                    getKafkaProducer().flush();
                    trackerForFlush = 0;
                }
            } // for
        } finally {
            close();
        }
    }

    protected void sendMsg(String topicName, String key, String message) throws Exception {
        ProducerRecord<String, String> producerRecord =
                new ProducerRecord<>(topicName, key, message);

        getKafkaProducer().send(producerRecord);
        if(this.threadSleepSetting) {
            Thread.sleep(threadSleepIntervalInMs);
        }
    }

    private KafkaProducer<String, String> getKafkaProducer() throws Exception {
        if (this.kafkaProducer == null) {
            Properties props = getProperties();
            this.kafkaProducer = new KafkaProducer<>(props);
        }

        return this.kafkaProducer;
    }

    private void close() {
        if (this.kafkaProducer != null) {
            this.kafkaProducer.close();
            this.kafkaProducer = null;
        }
    }
}