import * as pino from "pino"
import { OddsItem } from "./Odds"
import mqtt from "mqtt"
import { memo, useEffect } from "react"

type MQTTServerConfig = {
    url: string;
    topic: string;
}

const log = pino.pino()

export const MQTTAdapter = memo(({
    serverConfig, updateOdds
}:{
    serverConfig: MQTTServerConfig, 
    updateOdds: (odds:OddsItem) => void
}) => {

    useEffect(() => {
        log.info("connect...")

        const client = mqtt.connect(serverConfig.url)

        client.on("connect",(connAck) => {
            log.info("mqtt client connect event")
        })

        client.on("error",(error) => {
            log.info("mqtt client error event")
        })

        client.on("message",(topic,msg) => {
            const json = JSON.parse(new String(msg).toString())
            const odds = ({
                id: '',
                fstLeg: json.FIRST_LEG,
                secLeg: json.SECOND_LEG,
                pattern: json.PATTERN,
                odds: json.ODDS,
                status: json.STATUS,
                ver: json.VER,
                lastUpdate: new Date(json.LASTUPD)
            }) as OddsItem
            //log.info(`message received: ${topic} ${msg}`)
            updateOdds(odds)
        })

        client.on("close",() => {
            log.info("mqtt client close event")
        })

        client.on("end",() => {
            log.info("mqtt client end event")
        })

        client.subscribe(serverConfig.topic)

        return () => {
            log.info("end...")
            client.unsubscribe(serverConfig.topic)
            client.end();
        }
    },[serverConfig])

    return (<></>)
},({serverConfig:prev},{serverConfig:next}) => {
    var _ = require('lodash');
    return _.isEqual(prev,next);
})
