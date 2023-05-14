package com.amazonaws;

public class App {
    public static void main(String[] args) throws  Exception {
        System.out.println("Starting program...");

        String bootstrapServers = "boot-8vkw6qcx.c1.kafka-serverless.us-east-1.amazonaws.com:9098";
        String topic = "sourceTopic";
        MSKDataGen mskDataGen = new MSKDataGen(bootstrapServers, topic, 100);
        mskDataGen.run();
    }
}