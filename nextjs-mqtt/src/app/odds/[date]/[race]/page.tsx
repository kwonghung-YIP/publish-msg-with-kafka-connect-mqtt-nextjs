import { MQTTClientApp } from "@/components/MQTTClientApp";
import { OddsItem, RaceHorse } from "@/components/Odds";
import OddsTable from "@/components/OddsTable";
import * as pino from "pino"

const MQTT_URL = process.env.MQTT_URL
const LOCAL_NEXTJS = process.env.LOCAL_NEXTJS

const log = pino.pino()

async function fetchHorse(date:string,race:string) {
    const resp = await fetch(`http://${LOCAL_NEXTJS}/api/horse/${date}/${race}`, {cache:"no-cache"});
    return resp.json()
}

async function fetchOdds(date:string,race:string) {
    const resp = await fetch(`http://${LOCAL_NEXTJS}/api/odds/${date}/${race}`, {cache:"no-cache"});
    return resp.json()
}

const Page = async ({params}:{params:{date:string,race:string}}) => {
    const horses:RaceHorse[] = await fetchHorse(params.date,params.race);
    const odds:OddsItem[] = await fetchOdds(params.date,params.race);

    //log.info(`horses.length: ${horses.length}`)
    //log.info(`odds.length: ${odds.length}`)
    return (
        <MQTTClientApp serverConfig={{url:`${MQTT_URL}`}}>
            <OddsTable horses={horses} initOdds={odds} date={params.date} race={params.race}/>
        </MQTTClientApp>
    )
}

export default Page