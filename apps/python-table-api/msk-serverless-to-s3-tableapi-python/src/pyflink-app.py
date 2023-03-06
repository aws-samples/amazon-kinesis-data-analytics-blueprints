from pyflink.table import EnvironmentSettings, StreamTableEnvironment, TableEnvironment
from pyflink.common import Configuration
from pyflink.table import DataTypes
from pyflink.table.udf import udf
from pyflink.table.expressions import lit, col, call
import os
from pathlib import Path
import json


env_settings = EnvironmentSettings \
    .new_instance() \
    .in_streaming_mode() \
    .build()

table_env = TableEnvironment.create(env_settings)

APPLICATION_PROPERTIES_FILE_PATH = "/etc/flink/application_properties.json"  # on kda

# TODO: See if there's a better way to determine whether we're running
#       in the cloud
is_local = (
    # set this env var in your local environment
    True if os.environ.get("IS_LOCAL") else False
)

print("IS_LOCAL: " + str(is_local))

if is_local:
    # only for local, overwrite variable to properties and pass in your jars delimited by a semicolon (;)
    APPLICATION_PROPERTIES_FILE_PATH = "local_application_properties.json"  # local

    CURRENT_DIR = os.path.dirname(os.path.realpath(__file__))

    connectors = ['flink-sql-connector-kafka-1.15.2.jar',
                  'flink-connector-files-1.15.2.jar',
                  'flink-sql-parquet-1.15.2.jar',
                  'hadoop-common-2.10.1.jar',
                  'hadoop-mapreduce-client-core-2.10.1.jar'
                  ]
    
    pipeline_jars_var = ""
    for cp in connectors:
        pipeline_jars_var = f"{pipeline_jars_var}file://{CURRENT_DIR}/lib/{cp};"

    # kafka_connector_path = "file:///Users/karthit/code/aws/kda/kda-blueprints-internal/apps/python-table-api/msk-serverless-to-s3-tableapi-python/src/lib/flink-sql-connector-kafka-1.15.2.jar"
    # filesystem_connector_path = "file:///Users/karthit/code/aws/kda/kda-blueprints-internal/apps/python-table-api/msk-serverless-to-s3-tableapi-python/src/lib/flink-connector-files-1.15.2.jar"
    # flink_parquet_lib_path = "file:///Users/karthit/code/aws/kda/kda-blueprints-internal/apps/python-table-api/msk-serverless-to-s3-tableapi-python/src/lib/flink-sql-parquet-1.15.2.jar"
    # hadoop_common_lib_path = "file:///Users/karthit/code/aws/kda/kda-blueprints-internal/apps/python-table-api/msk-serverless-to-s3-tableapi-python/src/lib/hadoop-common-2.10.1.jar"
    # hadoop_mapreduce_core_path = "file:///Users/karthit/code/aws/kda/kda-blueprints-internal/apps/python-table-api/msk-serverless-to-s3-tableapi-python/src/lib/hadoop-mapreduce-client-core-2.10.1.jar"

    #table_env.get_config().get_configuration().set_string("pipeline.jars", f"{kafka_connector_path};{hadoop_common_lib_path};{hadoop_mapreduce_core_path};{flink_parquet_lib_path}")

    pipeline_jars_var = pipeline_jars_var.rstrip(";")
    print(pipeline_jars_var)
    table_env.get_config().get_configuration().set_string("pipeline.jars", pipeline_jars_var)

    table_env.get_config().get_configuration().set_string("execution.checkpointing.mode", "AT_LEAST_ONCE")
    table_env.get_config().get_configuration().set_string("execution.checkpointing.interval", "5sec")


def get_application_properties():
    if os.path.isfile(APPLICATION_PROPERTIES_FILE_PATH):
        with open(APPLICATION_PROPERTIES_FILE_PATH, "r") as file:
            contents = file.read()
            properties = json.loads(contents)
            return properties
    else:
        print('A file at "{}" was not found'.format(APPLICATION_PROPERTIES_FILE_PATH))


def property_map(props, property_group_id):
    for prop in props:
        if prop["PropertyGroupId"] == property_group_id:
            return prop["PropertyMap"]


def msk_to_s3():

    app_props = get_application_properties()
    source_config_props = property_map(app_props, "source.config")
    sink_config_props = property_map(app_props, "sink.config")

    print(sink_config_props)

    table_env.execute_sql("DROP TABLE IF EXISTS source_kafka")
    source_ddl = f"""
        CREATE TABLE IF NOT EXISTS source_kafka (
            product_id   BIGINT,
            order_number BIGINT,
            quantity     INT,
            price        DECIMAL(32,2),
            buyer        STRING,
            order_time   TIMESTAMP(3)
        )
        WITH (
        'connector'= 'kafka',
        'format' = '{source_config_props["source.format"]}',
        'topic' = '{source_config_props["source.topic"]}',
        'scan.startup.mode' = 'earliest-offset',
        'properties.bootstrap.servers' = '{source_config_props["source.bootstrap_servers"]}',
        'properties.group.id' = 'testGroup'
        )
        """

    table_env.execute_sql("DROP TABLE IF EXISTS sink_s3")
    sink_ddl = f"""
        CREATE TABLE IF NOT EXISTS sink_s3 (
            product_id   BIGINT,
            order_number BIGINT,
            quantity     INT,
            price        DECIMAL(32,2),
            buyer        STRING,
            order_time   TIMESTAMP(3)
        )
        WITH (
        'connector'= 'filesystem',
        'format' = 'parquet',
        'path' = '{sink_config_props["sink.path"]}'
        )
        """

    final_load_query = """
    INSERT INTO sink_s3
    SELECT
       product_id,
       order_number,
       quantity,
       price,
       buyer,
       order_time
    FROM source_kafka
    """

    table_env.execute_sql(source_ddl)
    table_env.execute_sql(sink_ddl)

    exec_response = table_env.execute_sql(final_load_query)
    if is_local:
        exec_response.wait()


def main():
    msk_to_s3()


if __name__ == "__main__":
    main()
