"use client"

import { useImmer } from "use-immer"
import { OddsItem, RaceHorse } from "./Odds"
import OddsTableView from "./OddsTableView"
import { MQTTAdapter } from "./MQTTAdapter"
import { enableMapSet } from "immer"
import * as pino from "pino"

enableMapSet()

const log = pino.pino()

const getKey = (odds:OddsItem):string => odds.fstLeg+"-"+odds.secLeg

const OddsTable = ({
    horses,initOdds
}:{
    horses:RaceHorse[],
    initOdds:OddsItem[]
}) => {

    const [oddsMap,setOddsMap] = useImmer(new Map(initOdds.map(odds=>[getKey(odds),odds])))

    const updateOdds = (odds:OddsItem) => {
        log.debug(`update odds ${JSON.stringify(odds)}`)
        const rbId = 'rb-'+odds.fstLeg+"-"+odds.secLeg;
        document.getElementById("rb-0-0")?.focus()
        setOddsMap(draft => {
            draft.set(getKey(odds),odds)
        })
        document.getElementById(rbId)?.focus()
    }

    return (
        <>
            <OddsTableView horses={horses} odds={oddsMap}/>
            <MQTTAdapter serverConfig={{url:"ws://192.168.19.130:8000/mqtt",topic:"all_odds_json"}} 
                updateOdds={updateOdds}/>
        </>
        
    )
}

export default OddsTable