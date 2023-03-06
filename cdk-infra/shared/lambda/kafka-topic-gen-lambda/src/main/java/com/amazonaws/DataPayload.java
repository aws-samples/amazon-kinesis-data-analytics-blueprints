package com.amazonaws;

import com.google.gson.Gson;

/*
  The purpose of this hierarchy of classes is to ensure that we properly structure our response for
  CDK: {'Data': {'attributes': {'Response': <response>}}}
 */
public class DataPayload {
    public AttributesPayload Data;

    public DataPayload() {}

    public DataPayload(String response) {
        this.Data = new AttributesPayload(response);
    }

    public String asJson() {
        Gson gson = new Gson();
        return gson.toJson(this);
    }

    public static class AttributesPayload {
        public ResponsePayload attributes;

        public AttributesPayload(String response) {
            this.attributes = new ResponsePayload(response);
        }
    }

    public static class ResponsePayload {
        public ResponsePayload(String response) {
            this.Response = response;
        }
        public String Response;
    }
}