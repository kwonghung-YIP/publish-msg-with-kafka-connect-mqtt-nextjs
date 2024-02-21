# publish-msg-with-kafka-connect-mqtt-nextjs
Message publishing with Kafka Connect, MQTT(HiveMQ) and Nextjs

## Introduction

This repo demostrate how to publish message from Postgresql backend to Reactjs frontend via the flow below:

postgresql => kafka-connect-jdbc-source => ksqldb => kafka-connect-redis-sink => redis <= nextjs api route <= reactjs
                                                  => kafka-connect-mqtt-sink => hiveMQ => mqtt.js => reactjs 

## How to run this demo (Overview)

1. Start docker-compose.yml and spin up the infastructure
1. Define the backend tables in postgresql
1. Install the following kafka-connectors
1. Create kafka-jdbc-source-connector to populate postgresql tables into kafka
1. Create KStream and KTable in ksqlDB
1. Create kafka-redis-sink-connector to publish KStream to redis
1. Create redisSearch index for seaching odds data by date and race no
1. Create kafka-mqtt-sink-connector to publish KStream to HiveMq
1. Update postgres table with with postgres-cli
1. Test redisSearch and redisJSON with redis-cli
1. Test mqtt subscription with hivemq-cli
1. Start nextjs server and run the front-end

## Start docker-compose.yml
To clear up the docker runtime:
```bash
docker compose down
#or
docker rm -f `docker ps -a -q`
```

Start the docker compose:
```bash
docker compose up -d
```

## Create kafka-jdbc-source-connector
Create the connector with kafka-connect REST API
```bash
curl -i -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
      "name": "my-postgres-source-connector",
      "config": {
        "connector.class": "io.confluent.connect.jdbc.JdbcSourceConnector",
        "connection.url": "jdbc:postgresql://postgres-db/db1",
        "connection.user": "admin",
        "connection.password": "passwd",
        "table.whitelist": "race,v_race_horse,odds_forecast",
        "mode": "timestamp+incrementing",
        "incrementing.column.name": "ver",
        "timestamp.column.name": "lastupd",
        "poll.interval.ms": 2000,
        "topic.prefix": "postgres_src_",
        "transforms": "ValueToKey,ExtractValue",
        "transforms.ValueToKey.type": "org.apache.kafka.connect.transforms.ValueToKey",
        "transforms.ValueToKey.fields": "id",
        "transforms.ExtractValue.type": "org.apache.kafka.connect.transforms.ExtractField$Key",
        "transforms.ExtractValue.field": "id",
        "key.converter": "org.apache.kafka.connect.storage.StringConverter",
        "value.converter": "io.confluent.connect.avro.AvroConverter",
        "value.converter.schema.registry.url": "http://schema-registry:8081"
      }
     }'
```

Check the connector status after created
```bash
curl localhost:8083/connectors/my-postgres-source-connector/status
```

Or, check the connector configuration
```bash
curl localhost:8083/connectors/my-postgres-source-connector/config
```

Or, delete the connector if necessary
```bash
curl -i -X DELETE http://localhost:8083/connectors/my-postgres-source-connector/
```

List all installed connectors
```bash
curl localhost:8083/connectors?expand=status&expand=info
```

#### Resource and References

## Create KStream and KTable in ksqlDB
Run the ksql-cli embedded into the ksqlDB
```bash
docker exec -it ksqldb /bin/ksql http://localhost:8088
```

Create kStream odds from postgres DB odds_forecast table
```sql
CREATE STREAM odds (
  id string key,
  race_id string,
  first_leg decimal(2,0),
  second_leg decimal(2,0),
  odds decimal(5,3),
  sts string,
  ver int,
  lastUpd timestamp
) WITH (
  kafka_topic = 'postgres_src_odds_forecast',
  value_format = 'AVRO'
);
```

Create kTable race from postgres DB races table 
```sql
CREATE TABLE race (
  id string primary key,
  race_no decimal(2,0),
  race_date date,
  race_time time,
  racecourse string,
  ver int,
  lastUpd timestamp
) WITH (
  kafka_topic = 'postgres_src_races',
  value_format = 'AVRO'
);
```

Create a KStream odds_forecast by joining both odds KStrean and race KTable
```sql
CREATE OR REPLACE STREAM odds_forecast
WITH (
  KAFKA_TOPIC = 'all_odds',
  VALUE_FORMAT = 'AVRO'
) AS
SELECT
  o.id as odds_id,
  o.race_id,
  r.race_date,
  r.race_time,
  cast(r.race_no as int) as race_no,
  r.racecourse,
  cast(o.first_leg as int) as first_leg,
  cast(o.second_leg as int) as second_leg,
  'forecast' as type,
  cast(o.first_leg as varchar)+ '-' + cast(o.second_leg as varchar) as pattern,
  cast(o.odds as double) as odds,
  o.sts,
  o.ver as ver,
  o.lastUpd as lastupd
FROM odds o
  INNER JOIN race r on o.race_id = r.id
PARTITION BY o.id
EMIT CHANGES;
```

Create another KStream on top of odds_forecast, which value is serialized as JSON instead of AVRO.
It is for MQTT sink connector which does not suppor AVRO serialization.
```sql
CREATE OR REPLACE STREAM odds_json
WITH (
  KAFKA_TOPIC = 'all_odds_json',
  VALUE_FORMAT = 'JSON'
) AS 
SELECT *
FROM odds_forecast
EMIT CHANGES;
```

Other commands for ksqlDB, list different objects in ksqlDB
```sql
show connectors;
show topics;
show streams;
show tables;
describe odds_forecast extended;
```

Operations related to Query
```sql
show queries;
pause all;
resume all;
terminate all;
```

Set the query to read from the beginning of the topic
```sql
SET 'auto.offset.reset' = 'earliest';
```

#### Resource and References

## Create kafka-redis-sink-connector to push message from topic all_odds to redis cache

Create redis-sink-connector with kafka-connect REST API
```bash
curl -i -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
      "name": "my-redis-sink",
      "config": {
        "connector.class": "com.redis.kafka.connect.RedisSinkConnector",
        "tasks.max": "1",
        "topics": "all_odds,postgres_src_odds_forecast",
        "redis.uri": "redis://redis:6379",
        "redis.key": "${topic}",
        "redis.command": "JSONSET",
        "key.converter": "org.apache.kafka.connect.storage.StringConverter",
        "value.converter": "io.confluent.connect.avro.AvroConverter",
        "value.converter.schemas.enable": "true",
        "value.converter.schema.registry.url": "http://schema-registry:8081"
      }
    }'
```

Check connector status and configuration
```bash
curl localhost:8083/connectors/my-redis-sink/status
```
```bash
curl localhost:8083/connectors/my-redis-sink/config
```

Delete connector
```bash
curl -i -X DELETE http://localhost:8083/connectors/my-redis-sink/
```

#### Resource and References

## Create redisSearch index

Tips!!! convert ksqlDB date to redis epoch year value

Run the redis-cli embedded into the redis docker image
```bash
docker exec -it redis redis-cli
```

Create redisSearch index (Tips!!! the JSON properties defined in ft.create statement is case-sensitive)
```bash
ft.create odds on json schema $.RACE_DATE as race_date numeric $.RACE_NO as race_no numeric $.RACECOURSE as racecourse text
```

Search queries for testing the index
```bash
ft.search odds '@no:(1)'
ft.search odds '@pattern:(1-2)'
ft.search odds '@venue:(Sandown)'
ft.search odds '(@race_date:[19756 19756] @race_no:[1 1])'
```

Operations for redisSearch index: List all, show info, delete
```bash
ft._list
ft.info odds
ft.dropindex odds
```

Other useful redis commands
```bash
keys *
json.get postgres_src_odds_forecast:bef34f7f-d784-4995-ac82-e4840902b9a1 $
json.get all_odds:e3dcd46b-9d55-435d-9cb5-c0198be9a211 $
```

#### Resource and References

## Create kafka-mqtt-sink-connector to push message from all_odds_json to hivemq

Create mqtt-sink connector
(Tips!!! kafka-mqtt-sink-connector does not support AVRO serialization) 
```bash
curl -i -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
      "name": "my-mqtt-sink",
      "config": {
        "connector.class": "io.confluent.connect.mqtt.MqttSinkConnector",
        "tasks.max": "1",
        "topics": "all_odds_json",
        "mqtt.server.uri": "tcp://hivemq:1883",
        "mqtt.qos": "2",
        "key.converter": "org.apache.kafka.connect.storage.StringConverter",
        "value.converter": "org.apache.kafka.connect.storage.StringConverter",
        "confluent.topic.bootstrap.servers": "kafka-broker:29092",
        "confluent.topic.replication.factor": "1"
      }
    }'
```

Check connector status and configuration
```bash
curl localhost:8083/connectors/my-mqtt-sink/status

curl localhost:8083/connectors/my-mqtt-sink/config
```

Delete connector
```bash
curl -i -X DELETE http://localhost:8083/connectors/my-mqtt-sink/
```

#### Resource and References

## Test MQTT topic subscription with hivemq-cli

Run HiveMQ-cli with with docker imae
```bash
docker run -it \
  --rm --name=hivemq-cli2 \
  --network kafka-stack_default --link hivemq \
  hivemq/mqtt-cli shell
```

Connect to hiveMQ broker
```bash
connect --host=hivemq --port=1883
```

Subscribe the all_odds topic and waiting for the messages
```bash
sub -t all_odds --stay --jsonOutput
```

Publish to all_odd topic if necessary
```bash
pub -t all_odds -m 'Try Me!!'
```

#### Resource and References


## Update postgres DB tables with postgresql-cli

Run psql embedded in the postgres db server
```bash
docker exec -it postgres-db psql --host=localhost --username=admin --dbname=db1
```

update all odds with random odds
```sql
update odds_forecast set odds = random()*100, ver = ver + 1, lastupd=current_timestamp;
```

#### Resource and References

## GitHub sample project
- [Confluent Inc - demo-scene - building-a-stream-pipeline](https://github.com/confluentinc/demo-scene/blob/master/build-a-streaming-pipeline/demo_build-a-streaming-pipeline.adoc)
- [Confluent Inc - demo-scene - kafka-connect-zero-to-hero](https://github.com/confluentinc/demo-scene/blob/24218457ca35eae6b17b547ea7e0048fbd183678/kafka-connect-zero-to-hero/README.adoc#L4)
## YouTube tutorial
- [Robin Moffatt - From Zero to Hero with Kafka Connect](https://www.youtube.com/watch?v=dXXfkoXXBbs&t=1728s)
- [Robin Moffatt - Apache Kafka and ksqlDB in Action: Let's Build a Streaming Data Pipeline](https://www.youtube.com/watch?v=2fUOi9wJPhk&t=38s)
- [Robin Moffatt - Twelve Days of SMT - Day 2:ValueToKey and ExtractField](https://www.youtube.com/watch?v=gSaCtaHt1k4)
- [ksqlDB and Stream Processing Tutorials|ksqlDB 101](https://www.youtube.com/watch?v=UBUddayuPL8&list=PLa7VYi0yPIH3ulxsOf5g43_QiB-HOg5_Y)
- [ksqlDB & Advanced Stream Processing Tutorials|Inside ksqlDB](https://www.youtube.com/watch?v=IPJXIKrohww&list=PLa7VYi0yPIH0SG2lvtS2Aoa12F22jKYYJ)

## Document and Reference
- [Kafka Connect Deep Dive - Converters and Serialization Explained](https://www.confluent.io/en-gb/blog/kafka-connect-deep-dive-converters-serialization-explained)
- [Kafka Connect Configurations for Confluent Platform](https://docs.confluent.io/platform/current/installation/configuration/connect/index.html)
- [Kafka Connect Self-managed Connectors for Confluent Platform](https://docs.confluent.io/platform/current/connect/kafka_connectors.html)
- [Kafka Connect JDBC Source Connector for Confluent Platform](https://docs.confluent.io/kafka-connectors/jdbc/current/source-connector/overview.html)
- [Kafka Connect Redis Sink Connector for Confluent Platfrm](https://docs.confluent.io/kafka-connectors/redis/current/overview.html)
- [Kafka Connect MQTT Sink Connector for Confluent Platform](https://docs.confluent.io/kafka-connectors/mqtt/current/mqtt-sink-connector/overview.html)
- [Kafka Connect Single Message Transforms for Confluent](https://docs.confluent.io/platform/current/connect/transforms/overview.html)
- [PostgresSQL Source (JDBC) Connector for Confluent Cloud](https://docs.confluent.io/cloud/current/connectors/cc-postgresql-source.html)
- [kafka broker and controller server configuration reference](https://docs.confluent.io/platform/current/installation/configuration/broker-configs.html)
- [ksqlDB SQL quick refrence](https://docs.ksqldb.io/en/latest/developer-guide/ksqldb-reference/quick-reference/)
- [ksqlDB server configuration reference](https://docs.ksqldb.io/en/latest/reference/server-configuration/)
- [Debezium - open source change data capture project](https://debezium.io/)
- [Kafka Connect - How to use Single Message Transforms in Kafka Connect](https://www.confluent.io/blog/kafka-connect-single-message-transformation-tutorial-with-examples/)
- [Docker image - redis-stack for RedisJSON](https://hub.docker.com/r/redis/redis-stack)
- [Redis Search - Query data](https://redis.io/docs/interact/search-and-query/query/)
- [moment.js - Doc](https://momentjs.com/docs/#/displaying/unix-timestamp-milliseconds/)