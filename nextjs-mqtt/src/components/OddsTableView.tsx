import { ReactElement } from "react"
import { OddsItem, RaceHorse } from "./Odds"
import "./OddsTable.css"
import classNames from "classnames"
import moment from "moment"

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

    const justUpdated = (date?:Date):boolean => {
        if (date===undefined) {
            return false
        } else {
            return moment().subtract(5,'second').isBefore(date)
        }
    }
 
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
                    if (item==undefined) {
                        oddsCells.push(<div key={key}>-</div>)
                    } else {
                        let cellClass = classNames({
                            "cell": true,
                            "max": item.odds >= maxOdds,
                            "min": item.odds <= minOdds,
                            "updated": justUpdated(item.lastUpdate)
                        })
                        oddsCells.push(<div key={key} className={cellClass}>{item.odds}</div>)
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

export default OddsTableView