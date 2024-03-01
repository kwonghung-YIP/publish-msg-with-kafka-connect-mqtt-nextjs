import { ReactElement } from "react"
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

    let horseCells: Array<ReactElement> = []
    let oddsCells: Array<ReactElement> = []

    for (let row=0;row<=horses.length;row++) { //first-leg
        for (let col=0;col<=horses.length;col++) { //second-leg
            const key = row+"-"+col
            if (col==0) {
                if (row==0) {
                    horseCells.push(<div key={"h-"+row}>-</div>)
                    oddsCells.push(<div key={key}>-<input id="rb-0-0" type="radio"/></div>)
                } else {
                    const h = horses[row-1]
                    horseCells.push(<div key={"h-"+row}>{h.horse}</div>)
                    oddsCells.push(<div key={key}>{h.draw}</div>)
                }
            } else {
                if (row==0) {
                    oddsCells.push(<div key={key}>{col}</div>)
                } else {
                    const item = odds.get(key)
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
        <div className="table-wrapper">
            <div className="horse-col-wrapper">
                {horseCells}
            </div>
            <div className="odds-table-wrapper" style={{"--no-of-horse":horses.length} as React.CSSProperties}>
                {oddsCells}
            </div>
        </div>
    )
}

const OddsTableCell = ({
    oddsItem,maxOdds,minOdds
}:{
    oddsItem:OddsItem,maxOdds:number,minOdds:number
}) => {

    const cellClass = classNames({
        "cell": true,
        "max": oddsItem.odds >= maxOdds,
        "min": oddsItem.odds <= minOdds
    })

    return (
        <div className={cellClass}>
            {oddsItem.odds}
            <input id={"rb-"+oddsItem.fstLeg+"-"+oddsItem.secLeg} type="radio"/>
        </div>
    )
}

export default OddsTableView