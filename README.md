## Introduction

This repo demostrate publishing DB change in PostgreSQL to Reactjs frontend via Kafka Connect and MQTT:

![Application Architecture](/odds-publish-mqtt-architecture.jpg)

## How to run this demo

Assume that you have install docker compose, curl and jq, and then run [./run.sh](/run.sh), that's it.

The run.sh did the following:

1. Start the infrastructure defined in docker-compose.yml.
1. Wait until the ksqlDB was ready, then run the [init.sql](/ksqldb/init.sql) to create kStream, kTable and Connectors.
1. Create the Redis Search index with ft.create.
1. Run the [updateOdds.sh](/updateOdds.sh) to generate random change in odds table

## Stream Flow

Launch the odds table react (http://localhost:3000/odds/20240209/1)

![Stream Flow](/odds-publish-mqtt-stream-flow.jpg)

## Docker compose and infrasturcture
To clear up the docker runtime:
```bash
docker compose down
```
or
```bash
docker rm -f `docker ps -a -q`
```

Start the docker compose:
```bash
docker compose up -d --build
```

### Resource and References
- [kafka broker and controller server configuration reference](https://docs.confluent.io/platform/current/installation/configuration/broker-configs.html)
- [Kafka Connect Configurations for Confluent Platform](https://docs.confluent.io/platform/current/installation/configuration/connect/index.html)
- [ksqlDB server configuration reference](https://docs.ksqldb.io/en/latest/reference/server-configuration/)
- [Docker image - redis-stack for RedisJSON](https://hub.docker.com/r/redis/redis-stack)

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
        "table.types": "TABLE,VIEW",
        "table.whitelist": "race,v_race_horse,odds_forecast",
        "mode": "timestamp",
        "timestamp.column.name": "lastupd",
        "validate.non.null": "false",
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

### Resource and References
- [Kafka Connect Deep Dive - Converters and Serialization Explained](https://www.confluent.io/en-gb/blog/kafka-connect-deep-dive-converters-serialization-explained)
- [Kafka Connect Self-managed Connectors for Confluent Platform](https://docs.confluent.io/platform/current/connect/kafka_connectors.html)
- [Kafka Connect Single Message Transforms for Confluent](https://docs.confluent.io/platform/current/connect/transforms/overview.html)
- [Kafka Connect - How to use Single Message Transforms in Kafka Connect](https://www.confluent.io/blog/kafka-connect-single-message-transformation-tutorial-with-examples/)
- [Debezium - open source change data capture project](https://debezium.io/)
- [JDBC Source Connector for Confluent Platform](https://docs.confluent.io/kafka-connectors/jdbc/current/source-connector/overview.html)
- [JDBC Source Connector Configuration Properties](https://docs.confluent.io/kafka-connectors/jdbc/current/source-connector/source_config_options.html)
- [PostgresSQL Source (JDBC) Connector for Confluent Cloud](https://docs.confluent.io/cloud/current/connectors/cc-postgresql-source.html)

## Create KStream and KTable in ksqlDB
Run the ksql-cli embedded into the ksqlDB
```bash
docker exec -it ksqldb /bin/ksql http://localhost:8088

docker exec -it ksqldb /bin/ksql --file /home/appuser/init-sql/init.sql http://localhost:8088
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
  race_date date,
  race_no decimal(2,0),
  race_time time,
  racecourse string,
  ver int,
  lastUpd timestamp
) WITH (
  kafka_topic = 'postgres_src_race',
  value_format = 'AVRO'
);
```

```sql
CREATE TABLE race_horse_tbl (
  id String primary key,
  race_date date,
  race_no decimal(2,0),
  draw decimal(2,0),
  horse string,
  jockey string,
  ver int,
  lastUpd timestamp
) WITH (
  KAFKA_TOPIC = 'postgres_src_v_race_horse',
  VALUE_FORMAT = 'AVRO'
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
  o.lastUpd as lastupd,
  'odds/forecast/' + format_date(r.race_date,'yyyyMMdd') + '/' + cast(r.race_no as varchar) as mqtt_topic
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

```sql
CREATE OR REPLACE TABLE race_horse
WITH (
  KAFKA_TOPIC = 'race_horse',
  VALUE_FORMAT = 'JSON'
) AS
SELECT *
FROM race_horse_tbl
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

### Resource and References
- [ksqlDB SQL quick refrence](https://docs.ksqldb.io/en/latest/developer-guide/ksqldb-reference/quick-reference/)

## Create kafka-redis-sink-connector to push message from topic all_odds to redis cache

Create redis-sink-connector with kafka-connect REST API
```bash
curl -i -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
      "name": "my-redis-sink-arvo",
      "config": {
        "connector.class": "com.redis.kafka.connect.RedisSinkConnector",
        "tasks.max": "1",
        "topics": "all_odds",
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

```bash
curl -i -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
      "name": "my-redis-sink-json",
      "config": {
        "connector.class": "com.redis.kafka.connect.RedisSinkConnector",
        "tasks.max": "1",
        "topics": "race_horse",
        "redis.uri": "redis://redis:6379",
        "redis.key": "${topic}",
        "redis.command": "JSONSET",
        "key.converter": "org.apache.kafka.connect.storage.StringConverter",
        "value.converter": "org.apache.kafka.connect.storage.StringConverter"
      }
    }'
```

Check connector status and configuration
```bash
curl localhost:8083/connectors/my-redis-sink-avro/status
curl localhost:8083/connectors/my-redis-sink-json/status
```
```bash
curl localhost:8083/connectors/my-redis-sink-avro/config
curl localhost:8083/connectors/my-redis-sink-json/status
```

Delete connector
```bash
curl -i -X DELETE http://localhost:8083/connectors/my-redis-sink-avro/
curl -i -X DELETE http://localhost:8083/connectors/my-redis-sink-json/
```

### Resource and References
- [Redis Sink Connector for Confluent Platfrom](https://docs.confluent.io/kafka-connectors/redis/current/overview.html)
- [Redis Sink Connector Configuration Properties](https://docs.confluent.io/kafka-connectors/redis/current/connector_config.html)

## Create redisSearch index

Tips!!! convert ksqlDB date to redis epoch year value

Run the redis-cli embedded into the redis docker image
```bash
docker exec -it redis redis-cli

docker exec -it redis redis-cli keys *
```

Create redisSearch index (Tips!!! the JSON properties defined in ft.create statement is case-sensitive)
```bash
ft.create odds PREFIX 1 all_odds: on json schema $.RACE_DATE as race_date numeric $.RACE_NO as race_no numeric
ft.create horse PREFIX 1 race_horse: on json schema $.RACE_DATE as race_date numeric $.RACE_NO as race_no numeric $.DRAW as draw numeric sortable
```

Search queries for testing the index
```bash
ft.search odds '@no:(1)'
ft.search odds '@pattern:(1-2)'
ft.search odds '@venue:(Sandown)'
ft.search odds '(@race_date:[19762 19762] @race_no:[1 1])'
```

Operations for redisSearch index: List all, show info, delete
```bash
ft._list
ft.info odds
ft.dropindex odds
ft.dropindex horse
```

Other useful redis commands
```bash
keys *
json.get postgres_src_odds_forecast:bef34f7f-d784-4995-ac82-e4840902b9a1 $
json.get all_odds:e3dcd46b-9d55-435d-9cb5-c0198be9a211 $
```

### Resource and References
- [Redis Search - Query data](https://redis.io/docs/interact/search-and-query/query/)
- [Redis command - ft.create](https://redis.io/commands/ft.create/)
- [Redis command - ft.search](https://redis.io/commands/ft.search/)
- [Redis command - ft.explain](https://redis.io/commands/ft.explain/)
- [Redis command - json.get](https://redis.io/commands/json.get/)
- [Redis command - json.set](https://redis.io/commands/json.set/)


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
        "transforms": "extractTopic",
        "transforms.extractTopic.type": "io.confluent.connect.transforms.ExtractTopic$Key",
        "transforms.extractTopic.field": "mqtt_topic",
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

### Resource and References
- [MQTT Sink Connector for Confluent Platform](https://docs.confluent.io/kafka-connectors/mqtt/current/mqtt-sink-connector/overview.html)

## Test MQTT topic subscription with hivemq-cli

Run HiveMQ-cli with with docker imae
```bash
docker run -it \
  --rm --name=hivemq-cli2 \
  --network publish-msg-with-kafka-connect-mqtt-nextjs_default --link hivemq \
  hivemq/mqtt-cli shell
```

Check server config file in HiveMQ
```bash
docker exec -it hivemq cat conf/config.xml
```

Connect to hiveMQ broker
```bash
connect --host=hivemq --port=1883
```

Subscribe the all_odds topic and waiting for the messages
```bash
sub -t all_odds_json --stay --jsonOutput
```

Publish to all_odd topic if necessary
```bash
pub -t all_odds_json -m 'Try Me!!'
```

### Resource and References
- [HiveMQ CLI - Reference](https://www.hivemq.com/blog/mqtt-cli/)
- [HiveMQ and Docker](https://docs.hivemq.com/hivemq/latest/user-guide/docker.html)
- [Docker Hub hivemq/hivemq4 docker image](https://hub.docker.com/r/hivemq/hivemq4)


## Update postgres DB tables with postgresql-cli

Run psql embedded in the postgres db server
```bash
docker exec -it postgres-db psql --host=localhost --username=admin --dbname=db1
```

update all odds with random odds
```sql
update odds_forecast set odds = random()*100, ver = ver + 1, lastupd=current_timestamp;

update odds_forecast set odds = random()*100, ver = ver + 1, lastupd=current_timestamp
where race_id = (select id from race where race_date = '2024-02-09' and race_no = 1);

update odds_forecast set odds = random()*100, ver = ver + 1, lastupd=current_timestamp
where first_leg = 2 and second_leg = 1 
and race_id = (select id from race where race_date = '2024-02-09' and race_no = 1);

update race_horse_jockey set ver = ver + 1, lastupd=current_timestamp;

select r.race_date, r.race_no, 
  o.first_leg, o.second_leg, o.odds, o.ver, o.lastupd
from odds_forecast o
join race r on r.id = o.race_id
where r.race_date = '2024-02-09'
and race_no = 1
order by lastupd desc limit 5;
```

### Resource and References
- [postgres SQL command](https://www.postgresql.org/docs/current/sql-commands.html)

## Nextjs front-end

Subsrcibe to HiveMQ "all_odds_json" topic in mqtt(tcp) protocol with MQTT.js package 
```bash
npx mqtt sub -t 'all_odds_json' -h 'localhost' -p '1883' -l 'mqtt' -i 'mqttjs-client-1' -v
```
```bash
npx mqtt sub -t 'odds-forecast-20240209-1-json' -h 'localhost' -p '1883' -l 'mqtt' -i 'mqttjs-client-1' -v
```
Subsrcibe to HiveMQ "all_odds_json" topic in ws(websocket) protocol with MQTT.js package (not working) 
```bash
npx mqtt sub -t 'all_odds_json' -h 'localhost/mqtt' -p '8000' -l 'ws' -i 'mqttjs-client-1' -v
```
### Testing URLs
- (http://192.168.19.130:3000/api/horse/20240210/1)
- (http://192.168.19.130:3000/api/odds/20240210/1)
- (http://192.168.19.130:3000/odds/20240209/1)

### Resource and References
- [moment.js - Doc](https://momentjs.com/docs/#/displaying/unix-timestamp-milliseconds/)
- [mqtt.js - GitHub + Doc](https://github.com/mqttjs)
- [npm - classnames](https://www.npmjs.com/package/classnames)


## GitHub sample project
- [Confluent Inc - demo-scene - building-a-stream-pipeline](https://github.com/confluentinc/demo-scene/blob/master/build-a-streaming-pipeline/demo_build-a-streaming-pipeline.adoc)
- [Confluent Inc - demo-scene - kafka-connect-zero-to-hero](https://github.com/confluentinc/demo-scene/blob/24218457ca35eae6b17b547ea7e0048fbd183678/kafka-connect-zero-to-hero/README.adoc#L4)
## YouTube tutorial
- [Robin Moffatt - From Zero to Hero with Kafka Connect](https://www.youtube.com/watch?v=dXXfkoXXBbs&t=1728s)
- [Robin Moffatt - Apache Kafka and ksqlDB in Action: Let's Build a Streaming Data Pipeline](https://www.youtube.com/watch?v=2fUOi9wJPhk&t=38s)
- [Robin Moffatt - Twelve Days of SMT - Day 2:ValueToKey and ExtractField](https://www.youtube.com/watch?v=gSaCtaHt1k4)
- [ksqlDB and Stream Processing Tutorials|ksqlDB 101](https://www.youtube.com/watch?v=UBUddayuPL8&list=PLa7VYi0yPIH3ulxsOf5g43_QiB-HOg5_Y)
- [ksqlDB & Advanced Stream Processing Tutorials|Inside ksqlDB](https://www.youtube.com/watch?v=IPJXIKrohww&list=PLa7VYi0yPIH0SG2lvtS2Aoa12F22jKYYJ)




