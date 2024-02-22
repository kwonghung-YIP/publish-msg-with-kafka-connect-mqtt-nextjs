import { OddsItem, RaceHorse } from "@/components/Odds";
import OddsTable from "@/components/OddsTable";

async function fetchHorse(date:string,race:string) {
    const resp = await fetch(`http://localhost:3000/api/horse/${date}/${race}`);
    return resp.json()
}

async function fetchOdds(date:string,race:string) {
    const resp = await fetch(`http://localhost:3000/api/odds/${date}/${race}`);
    return resp.json()
}

const Page = async ({params}:{params:{date:string,race:string}}) => {
    const horses:RaceHorse[] = await fetchHorse(params.date,params.race);
    const odds:OddsItem[] = await fetchOdds(params.date,params.race);
    return (
        <>
            <div>TryMe!!!! {params.date} {params.race} {JSON.stringify(horses)} {JSON.stringify(odds)}</div>
            <OddsTable/>
        </>
    )
}

export default Page