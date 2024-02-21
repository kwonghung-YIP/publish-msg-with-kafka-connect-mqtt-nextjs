import OddsTable from "@/components/OddsTable";

async function fetchOdds(date:string,race:string) {
    const resp = await fetch(`http://localhost:3000/api/odds/${date}/${race}`);
    return resp.json()
}

const Page = async ({params}:{params:{date:string,race:string}}) => {
    const odds = await fetchOdds(params.date,params.race);
    return (
        <>
            <div>TryMe!!!! {params.date} {params.race} {JSON.stringify(odds)}</div>
            <OddsTable/>
        </>
    )
}

export default Page