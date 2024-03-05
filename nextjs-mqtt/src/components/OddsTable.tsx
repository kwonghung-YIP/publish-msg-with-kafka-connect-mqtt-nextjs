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
    horses,initOdds,date,race
}:{
    horses:RaceHorse[],
    initOdds:OddsItem[],
    date:string,
    race:string
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
            <MQTTAdapter topic={`odds-forecast-${date}-${race}-json`} updateOdds={updateOdds}/>
        </>
        
    )
}

export default OddsTable