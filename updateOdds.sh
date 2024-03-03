#!/bin/bash

function runSQL() {
    docker exec -it postgres-db \
        psql --host=localhost --username=admin --dbname=db1 \
        -c "$1"
}

runSQL "update odds_forecast\
 set odds = random()*100, ver = ver + 1, lastupd=current_timestamp\
 where race_id = (select id from race where race_date = '2024-02-09' and race_no = 1);"

for i in {1..10000}
do
    runSQL "call updateRandomOdds('2024-02-09',1);"
    
    sleep $((RANDOM%5)) #$((200+RANDOM%1000)) 
done