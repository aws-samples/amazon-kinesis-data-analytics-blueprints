package com.amazonaws.services.kinesisanalytics.orders;

import org.apache.flink.api.common.serialization.SerializationSchema;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.flink.shaded.jackson2.com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;


public class OrderSerializationSchema<Order> implements SerializationSchema<Order> {

    private ObjectMapper mapper;
    private static final Logger LOG = LoggerFactory.getLogger(OrderSerializationSchema.class);

    @Override
    public byte[] serialize(Order order) {
        byte[] b = null;
        if (mapper == null) {
            mapper = new ObjectMapper();
        }
        try {
            b = mapper.writeValueAsBytes(order);
        } catch (JsonProcessingException e) {
            LOG.error("Error writing an order as bytes:", order.toString(), e.getMessage());
        }
        return b;
    }
} // class