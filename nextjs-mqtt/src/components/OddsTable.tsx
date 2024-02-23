"use client"

import { useImmer } from "use-immer"
import { OddsItem, RaceHorse } from "./Odds"
import OddsTableView from "./OddsTableView"
import MQTTAdapter from "./MQTTAdapter"

const getKey = (odds:OddsItem):string => odds.fstLeg+"-"+odds.secLeg

const OddsTable = ({
    horses,initOdds
}:{
    horses:RaceHorse[],
    initOdds:OddsItem[]
}) => {

    let [oddsMap,setOddsMap] = useImmer(new Map(initOdds.map(odds=>[getKey(odds),odds])))

    const updateOdds = (odds:OddsItem) => {
        setOddsMap(draft => draft.set(getKey(odds),odds))
    }

    return (
        <>
            <OddsTableView horses={horses} odds={oddsMap}/>
            <MQTTAdapter updateOdds={updateOdds}/>
        </>
        
    )
}

export default OddsTable