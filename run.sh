#!/bin/bash

docker compose up -d

echo "wait until ksqldb ready..."
for i in {1..90}
do
    status=`curl --http1.1 -s -v "http://localhost:8088/info" | jq -r '.KsqlServerInfo.serverStatus'`
    echo $status
    if [[ "$status" == 'RUNNING' ]]
    then
        sleep 30s
        curl --http1.1 -s -v "http://localhost:8088/info" | jq '.'
        break
    fi
    sleep 2s
done

docker exec -it ksqldb /bin/ksql --file /home/appuser/init-sql/init.sql http://localhost:8088

echo "create redis indexes..."

docker exec -it redis redis-cli ft.create odds PREFIX 1 all_odds: on json schema $.RACE_DATE as race_date numeric $.RACE_NO as race_no numeric

docker exec -it redis redis-cli ft.create horse PREFIX 1 race_horse: on json schema $.RACE_DATE as race_date numeric $.RACE_NO as race_no numeric $.DRAW as draw numeric sortable