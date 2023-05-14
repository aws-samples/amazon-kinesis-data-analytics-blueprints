package com.amazonaws;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.Map;

public class MSKDataGenHandler  implements RequestHandler<Map<String, String>, String> {
    Gson gson = new GsonBuilder().setPrettyPrinting().create();

    @Override
    public String handleRequest(Map<String, String> event, Context context) {
        LambdaLogger logger = context.getLogger();

        String response = new String("200 OK");
        // log execution details
        logger.log("ENVIRONMENT VARIABLES: " + gson.toJson(System.getenv()));
        logger.log("CONTEXT: " + gson.toJson(context));
        // process event
        logger.log("EVENT 2: " + gson.toJson(event) + "\n");
        logger.log("EVENT TYPE: " + event.getClass().toString() + "\n");

        try {
            String broker = event.get("Broker");
            String topic = event.get("Topic");

            logger.log("Broker: " + broker + "\n");
            logger.log("Topic: " + topic + "\n");

            MSKDataGen dataGen = new MSKDataGen(broker, topic);
            dataGen.run();

            return new String("Success");
        } catch(Exception ex) {
            logger.log(ex.getMessage());
            return new String("Failed");
        }
    } // handleRequest
} // class MSKDataGenHandler