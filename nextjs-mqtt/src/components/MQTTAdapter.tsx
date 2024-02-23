import * as pino from "pino"
import { OddsItem } from "./Odds"
import mqtt from "mqtt"
import { useEffect } from "react"

const log = pino.pino()

export const MQTTAdapter = ({
    updateOdds
}:{
    updateOdds: (odds:OddsItem) => void
}) => {

    useEffect(() => {
        const client = mqtt.connect("mqtt://localhost:1883")

        client.on("connect",(connack) => {
            log.info("mqtt client connected")
        })

        return () => {
            client.end();
        }
    },[])
}
