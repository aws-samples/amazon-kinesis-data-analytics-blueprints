package com.amazonaws;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ExecutionException;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.ListTopicsOptions;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.admin.TopicListing;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Handler implements RequestHandler<Map<String, Object>, String> {
    private static final Logger LOG = LoggerFactory.getLogger(Handler.class);

    public String handleRequest(Map<String, Object> event, Context context) {
        String requestType = event.get("RequestType").toString();
        if (requestType.equals("Create"))
            return onCreate(event, context);
        if (requestType.equals("Update"))
            return onUpdate(event, context);
        if (requestType.equals("Delete"))
            return onDelete(event, context);
        return (new DataPayload("Invalid request type")).asJson();
    }

    private static String onCreate(Map<String, Object> event, Context context) {
        return processCreateOrUpdate(event, context);
    }

    private static String onUpdate(Map<String, Object> event, Context context) {
        return processCreateOrUpdate(event, context);
    }

    private static String processCreateOrUpdate(Map<String, Object> event, Context context) {
        LambdaLogger logger = context.getLogger();

        logger.log("EVENT: " + event);

        // need this to deal w/ ':' in broker string
        String rpString = event.get("ResourceProperties").toString();
        rpString = rpString.replace(":", "|");

        logger.log("RAW RESOURCE PROPERTIES: " + rpString);

        Gson gson = new Gson();
        ResourceProperties resourceProperties = gson.fromJson(rpString, ResourceProperties.class);
        logger.log("RESOURCE PROPERTIES: " + gson.toJson(resourceProperties));
        Properties properties = new Properties();
        properties.put("bootstrap.servers", resourceProperties.Broker.replace("|", ":"));
        properties.put("client.id", "lambda-client");
        properties.put("security.protocol", "SASL_SSL");
        properties.put("sasl.mechanism", "AWS_MSK_IAM");
        properties.put("sasl.jaas.config", "software.amazon.msk.auth.iam.IAMLoginModule required;");
        properties.put("sasl.client.callback.handler.class", "software.amazon.msk.auth.iam.IAMClientCallbackHandler");
        logger.log("PROPERTIES: " + properties);

        return createTopicIfNotExists(resourceProperties.Topic, properties, resourceProperties, context);
    }

    private static String onDelete(Map<String, Object> event, Context context) {
        return (new DataPayload("Not doing anything in onDelete")).asJson();
    }

    private static boolean doesTopicExist(String topic, Properties properties, LambdaLogger logger) {
        AdminClient client = null;

        try {
            client = AdminClient.create(properties);
            Collection<TopicListing> listings = getTopicListing(client, false);
            for (TopicListing listing : listings) {
                if (listing.name().equals(topic)) {
                    boolean bool = true;
                    return bool;
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException e) {
            String msg = String.format("Failed to get topic list %s", e.getCause());
            logger.log(msg);
        } finally {
            if (client != null) {
                client.close();
            }
        }

        return false;
    }

    private static String createTopicIfNotExists(String topic,
                                                 Properties properties,
                                                 ResourceProperties resourceProperties,
                                                 Context context) {
        LambdaLogger logger = context.getLogger();
        if (doesTopicExist(topic, properties, logger)) {
            String msg = String.format("Topic '%s' already exists; not creating.", new Object[] { topic });
            logger.log(msg);
            return (new DataPayload(msg)).asJson();
        }
        AdminClient client = null;

        try {
            client = AdminClient.create(properties);

            Collection<NewTopic> topicList = new ArrayList<>();
            topicList.add(new NewTopic(topic, resourceProperties.NumPartitions, resourceProperties.ReplicationFactor));
            client.createTopics(topicList);
            String msg = String.format("Created topic %s", new Object[]{topic});
            logger.log(msg);

            return (new DataPayload(msg)).asJson();
        } catch (Exception e) {
            String msg = String.format("Failed to create topic %s", new Object[] { e.getCause() });
            logger.log(msg);
            return (new DataPayload(msg)).asJson();
        } finally {
            if(client != null) {
                client.close();
            }
        }
    }

    private static Collection<TopicListing> getTopicListing(AdminClient client, boolean isInternal) throws
            InterruptedException,
            ExecutionException {
        ListTopicsOptions options = new ListTopicsOptions();
        options.listInternal(isInternal);
        return client.listTopics(options).listings().get();
    }
}
