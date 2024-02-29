import { AnimationEventHandler, ReactElement, useState } from "react"
import { OddsItem, RaceHorse } from "./Odds"
import "./OddsTable.css"
import classNames from "classnames"
import * as pino from "pino"
import moment from "moment"

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

    //const [updated2,setUpdated2] = useState(oddsItem.updated)

    //log.info(`${oddsItem.fstLeg+"-"+oddsItem.secLeg} updated? ${updated2} - ${oddsItem.updated}`)

    const justUpdated = (date?:Date):boolean => {
        if (date===undefined) {
            return false
        } else {
            return moment().subtract(5,'second').isBefore(date)
        }
    }

    const onAnimationStart2:AnimationEventHandler = (event) => {
        log.info(`animation start: ${event.animationName}`)
        //setUpdated(false)
    }

    const onAnimationEnd2:AnimationEventHandler = (event) => {
        log.info(`animation end: ${event.animationName}`)
        if (event.animationName==='cell-updated') {
            event.target.classList.remove('updated')
            event.target.offsetWidth;
        }
    }

    const cellClass = classNames({
        "cell": true,
        "max": oddsItem.odds >= maxOdds,
        "min": oddsItem.odds <= minOdds,
        "updated2": justUpdated(oddsItem.lastUpdate)
    })

    return (<div className={cellClass}
        /*onAnimationStartCapture={onAnimationStart2}
        onAnimationEndCapture={onAnimationEnd2}*/>
            {justUpdated(oddsItem.lastUpdate)?"*":"?"}{oddsItem.odds}
        </div>)
}

export default OddsTableView