package com.amazonaws.services.kinesisanalytics.orders;

import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.api.common.serialization.AbstractDeserializationSchema;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.io.IOException;

public class OrderDeserializationSchema extends AbstractDeserializationSchema<Order> {
    private static final long serialVersionUID = 1L;

    private transient ObjectMapper objectMapper;

    @Override
    public void open(InitializationContext context) {
        objectMapper = JsonMapper.builder().build().registerModule(new JavaTimeModule());
    }

    @Override
    public Order deserialize(byte[] bytes) throws IOException {
        return objectMapper.readValue(bytes, Order.class);
    }
} // class