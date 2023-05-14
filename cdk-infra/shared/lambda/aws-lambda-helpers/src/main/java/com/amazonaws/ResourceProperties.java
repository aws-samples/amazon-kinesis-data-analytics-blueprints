package com.amazonaws;

import java.util.Map;

public class ResourceProperties {
    public String Broker;

    public String Topic;

    public int NumPartitions;

    public short ReplicationFactor;

    public static ResourceProperties fromMap(Map<String, Object> resourceProperties) {
        ResourceProperties retVal = new ResourceProperties();

        retVal.Broker = resourceProperties.get("Broker").toString();
        retVal.Topic = resourceProperties.get("Topic").toString();
        retVal.NumPartitions = Integer.parseInt(resourceProperties.get("NumPartitions").toString());
        retVal.ReplicationFactor = Short.parseShort(resourceProperties.get("ReplicationFactor").toString());

        return retVal;
    }
}