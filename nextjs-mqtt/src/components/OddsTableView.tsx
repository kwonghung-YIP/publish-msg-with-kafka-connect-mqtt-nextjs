import { ReactElement } from "react"
import { OddsItem, RaceHorse } from "./Odds"
import "./OddsTable.css"

const OddsTableView = ({
    horses,odds
}:{
    horses:RaceHorse[],
    odds:Map<string,OddsItem>
}) => {

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
                        oddsCells.push(<div key={key} className="cell">{item.odds}</div>)
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