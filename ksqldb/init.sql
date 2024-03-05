CREATE SOURCE CONNECTOR IF NOT EXISTS "my-postgres-source-connector" WITH (
    "connector.class" = 'io.confluent.connect.jdbc.JdbcSourceConnector',
    "connection.url" = 'jdbc:postgresql://postgres-db/db1',
    "connection.user" = 'admin',
    "connection.password" = 'passwd',
    "table.types" = 'TABLE,VIEW',
    "table.whitelist" = 'race,v_race_horse,odds_forecast',
    "mode" = 'timestamp',
    "timestamp.column.name" = 'lastupd',
    "validate.non.null" = 'false',
    "poll.interval.ms" = 2000,
    "topic.prefix" = 'postgres_src_',
    "transforms" = 'ValueToKey,ExtractValue',
    "transforms.ValueToKey.type" = 'org.apache.kafka.connect.transforms.ValueToKey',
    "transforms.ValueToKey.fields" = 'id',
    "transforms.ExtractValue.type" = 'org.apache.kafka.connect.transforms.ExtractField$Key',
    "transforms.ExtractValue.field" = 'id',
    "key.converter" = 'org.apache.kafka.connect.storage.StringConverter',
    "value.converter" = 'io.confluent.connect.avro.AvroConverter',
    "value.converter.schema.registry.url" = 'http://schema-registry:8081'
);

ASSERT TOPIC postgres_src_odds_forecast WITH (PARTITIONS=1) TIMEOUT 90 SECONDS;

PRINT postgres_src_odds_forecast FROM BEGINNING LIMIT 3;

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

ASSERT TOPIC postgres_src_race TIMEOUT 30 SECONDS;

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

ASSERT TOPIC postgres_src_v_race_horse TIMEOUT 30 SECONDS;

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
  o.lastUpd as lastupd/*,
  'odds/forecast/' + format_date(r.race_date,'yyyyMMdd') + '/' + cast(r.race_no as varchar) as mqtt_topic*/
FROM odds o
  INNER JOIN race r on o.race_id = r.id
PARTITION BY o.id
EMIT CHANGES;

CREATE OR REPLACE STREAM odds_json
WITH (
  KAFKA_TOPIC = 'all_odds_json',
  VALUE_FORMAT = 'JSON'
) AS 
SELECT *
FROM odds_forecast
EMIT CHANGES;

CREATE OR REPLACE STREAM odds_forecast_20240209_1_json
WITH (
  KAFKA_TOPIC = 'odds-forecast-20240209-1-json',
  VALUE_FORMAT = 'JSON'
) AS 
SELECT *
FROM odds_forecast
WHERE race_date = '2024-02-09' and race_no = 1
EMIT CHANGES;

CREATE OR REPLACE STREAM odds_forecast_20240209_2_json
WITH (
  KAFKA_TOPIC = 'odds-forecast-20240209-2-json',
  VALUE_FORMAT = 'JSON'
) AS 
SELECT *
FROM odds_forecast
WHERE race_date = '2024-02-09' and race_no = 2
EMIT CHANGES;

CREATE OR REPLACE STREAM odds_forecast_20240209_3_json
WITH (
  KAFKA_TOPIC = 'odds-forecast-20240209-3-json',
  VALUE_FORMAT = 'JSON'
) AS 
SELECT *
FROM odds_forecast
WHERE race_date = '2024-02-09' and race_no = 3
EMIT CHANGES;

CREATE OR REPLACE TABLE race_horse
WITH (
  KAFKA_TOPIC = 'race_horse',
  VALUE_FORMAT = 'JSON'
) AS
SELECT *
FROM race_horse_tbl
EMIT CHANGES;

CREATE SINK CONNECTOR IF NOT EXISTS "my-redis-sink-arvo" WITH (
    "connector.class" = 'com.redis.kafka.connect.RedisSinkConnector',
    "tasks.max" = '1',
    "topics" = 'all_odds',
    "redis.uri" = 'redis://redis:6379',
    "redis.key" = '${topic}',
    "redis.command" = 'JSONSET',
    "key.converter" = 'org.apache.kafka.connect.storage.StringConverter',
    "value.converter" = 'io.confluent.connect.avro.AvroConverter',
    "value.converter.schemas.enable" = 'true',
    "value.converter.schema.registry.url" = 'http://schema-registry:8081'
);

CREATE SINK CONNECTOR IF NOT EXISTS "my-redis-sink-json" WITH (
    "connector.class" = 'com.redis.kafka.connect.RedisSinkConnector',
    "tasks.max" = '1',
    "topics" = 'race_horse',
    "redis.uri" = 'redis://redis:6379',
    "redis.key" = '${topic}',
    "redis.command" = 'JSONSET',
    "key.converter" = 'org.apache.kafka.connect.storage.StringConverter',
    "value.converter" = 'org.apache.kafka.connect.storage.StringConverter'
);

CREATE SINK CONNECTOR IF NOT EXISTS "my-mqtt-sink" WITH (
    "connector.class" = 'io.confluent.connect.mqtt.MqttSinkConnector',
    "tasks.max" = '1',
    "topics.regex" = 'odds-forecast-[0-9]{8}-[0-9]{1,2}-json',
    "mqtt.server.uri" = 'tcp://hivemq:1883',
    "mqtt.qos" = '2',
    "key.converter" = 'org.apache.kafka.connect.storage.StringConverter',
    "value.converter" = 'org.apache.kafka.connect.storage.StringConverter',
    "confluent.topic.bootstrap.servers" = 'kafka-broker:29092',
    "confluent.topic.replication.factor" = '1'
);

/*
    "transforms" = 'valueToKey,extractField,extractTopic',
    "transforms.valueToKey.type" = 'org.apache.kafka.connect.transforms.ValueToKey',
    "transforms.valueToKey.fields" = 'MQTT_TOPIC',
    "transforms.extractField.type" = 'org.apache.kafka.connect.transforms.ExtractField$Key',
    "transforms.extractField.field" = 'MQTT_TOPIC',
    "transforms.extractTopic.type" = 'io.confluent.connect.transforms.ExtractTopic$Key',

    "value.converter" = 'org.apache.kafka.connect.storage.StringConverter',

    "value.converter" = 'org.apache.kafka.connect.json.JsonConverter',
    "value.converter.schemas.enable" = 'false',

    "value.converter" = 'io.confluent.connect.avro.AvroConverter',
    "value.converter.schemas.enable" = 'true',
    "value.converter.schema.registry.url" = 'http://schema-registry:8081',

*/