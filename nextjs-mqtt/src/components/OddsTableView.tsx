import { AnimationEventHandler, ReactElement, useState } from "react"
import { OddsItem, RaceHorse } from "./Odds"
import "./OddsTable.css"
import classNames from "classnames"
import * as pino from "pino"

const log = pino.pino()

const OddsTableView = ({
    horses,odds
}:{
    horses:RaceHorse[],
    odds:Map<string,OddsItem>
}) => {

    const maxOdds = Array.from(odds.values())
        .reduce((result,item) => Math.max(item.odds,result),0);
    const minOdds = Array.from(odds.values())
        .reduce((result,item) => Math.min(item.odds,result),99999);

    let oddsCells: Array<ReactElement> = []

    for (let row=0;row<=horses.length;row++) { //first-leg
        for (let col=0;col<=horses.length;col++) { //second-leg
            const key = row+"-"+col
            if (col==0) {
                if (row==0) {
                    oddsCells.push(<div key={key}>-</div>)
                } else {
                    const h = horses[row-1]
                    oddsCells.push(<div key={key}>{h.draw}</div>)
                }
            } else {
                if (row==0) {
                    oddsCells.push(<div key={key}>{col}</div>)
                } else {
                    const item = odds.get(key)
                    //log.info(`getOdds with key ${key}`)
                    //log.info(`oddsItem: ${JSON.stringify(item)}`)
                    if (item==undefined) {
                        oddsCells.push(<div key={key}>-</div>)
                    } else {
                        oddsCells.push(<OddsTableCell key={key} oddsItem={item} maxOdds={maxOdds} minOdds={minOdds}/>)
                    }
                }
            }
        }
    }

    return (
        <>
            <div className="odds-table-wrapper" style={{"--no-of-horse":horses.length} as React.CSSProperties}>
                {oddsCells}
            </div>
        </>
    )
}

const OddsTableCell = ({
    oddsItem,maxOdds,minOdds
}:{
    oddsItem:OddsItem,maxOdds:number,minOdds:number
}) => {

    const [updated,setUpdated] = useState(() => oddsItem.updated)

    log.info(`${oddsItem.fstLeg+"-"+oddsItem.secLeg} updated? ${updated} - ${oddsItem.updated}`)

    const onAnimationEnd:AnimationEventHandler = (event) => {
        setUpdated(false)
    }

    const cellClass = classNames({
        "cell": true,
        "max": oddsItem.odds >= maxOdds,
        "min": oddsItem.odds <= minOdds,
        "updated": oddsItem.updated
    })

    return (<div className={cellClass} onAnimationEnd={onAnimationEnd}>{oddsItem.odds}</div>)
}

export default OddsTableView