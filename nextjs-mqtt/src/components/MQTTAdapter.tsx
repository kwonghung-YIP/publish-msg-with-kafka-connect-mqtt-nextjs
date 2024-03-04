import * as pino from "pino"
import { OddsItem } from "./Odds"
import { useContext, useEffect } from "react"
import { MQTTClientContext } from "./MQTTClientApp"

const log = pino.pino()

export const MQTTAdapter = ({
    topic,updateOdds
}:{
    topic: string;
    updateOdds: (odds:OddsItem) => void;
}) => {

    const { client } = useContext(MQTTClientContext) as MQTTClientContext

    useEffect(() => {
        client?.on("message",(topic,msg) => {
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

        log.info(`client.subscribe topic:${topic}...`)
        client?.subscribe(topic)

        return () => {
            log.info("client.unsubscribe...")
            client?.unsubscribe(topic)
        }
    },[topic,client?.connected])

    return (<></>)
}
