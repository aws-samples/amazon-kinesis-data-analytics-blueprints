package com.amazonaws.services.kinesisanalytics.orders;

import org.apache.avro.generic.GenericRecord;
import org.apache.flink.core.io.SimpleVersionedSerializer;
import org.apache.flink.streaming.api.functions.sink.filesystem.BucketAssigner;
import org.apache.flink.streaming.api.functions.sink.filesystem.bucketassigners.SimpleVersionedStringSerializer;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class OrderDateBucketAssigner implements BucketAssigner<Order, String> {
    private final String prefix;
    private final String partitionFormat;
    private transient DateTimeFormatter dtFormatForWrite;

    public OrderDateBucketAssigner(String partitionFormat, String prefix) {
        this.prefix = prefix;
        this.partitionFormat = partitionFormat;
    }

    @Override
    public String getBucketId(Order orderInfo, Context context) {
        this.dtFormatForWrite = DateTimeFormatter.ofPattern(partitionFormat);

        String eventTimeStr = orderInfo.order_time;
        LocalDateTime eventTime = LocalDateTime.parse(eventTimeStr.replace(" ", "T"));

        String formattedDate = eventTime.format(this.dtFormatForWrite);

        return String.format("%sts=%s",
                prefix,
                formattedDate
        );
    }

    @Override
    public SimpleVersionedSerializer<String> getSerializer() {
        return SimpleVersionedStringSerializer.INSTANCE;
    }
}