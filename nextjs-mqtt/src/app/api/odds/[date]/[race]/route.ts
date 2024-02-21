
import moment from "moment";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";

export const GET = async (
    request: NextRequest, {params}: { params: { date: string; race: string } }): Promise<NextResponse> => {
    const { searchParams } = new URL(request.url);
    //const date = moment(searchParams.get('date'), "YYYYMMDD");
    //const race = searchParams.get('race');
    const date = moment(params.date,"YYYYMMDD");
    const race = params.race;

    console.log(`params: date:${date} race:${race}`);

    const client = createClient({
        url: 'redis://localhost:6379'
    });

    client.on('error', err => console.log('redis client error:', err));

    await client.connect();

    //await client.ping();
    const epoch = Math.floor(date.unix() / 86400);
    console.log(`epoch date: ${epoch}`)

    const result = await client.ft.search('odds', `(@race_date:[${epoch} ${epoch}] @race_no:[${race} ${race}])`, {
        LIMIT: { from: 0, size: 500 }
    });

    //console.log(typeof result);
    console.log(`ft.search result - total:${result.total} #result:${result.documents.length}`);

    interface OddsItem {
        id: string;
        fstLeg: number;
        secLeg: number;
        pattern: string;
        odds: number;
        status: string;
        ver: number;
        lastUpdate: Date;
    }

    const oddsList = result.documents.map(({ id, value }) => ({
        id: id,
        fstLeg: value.FIRST_LEG,
        secLeg: value.SECOND_LEG,
        pattern: value.PATTERN,
        odds: value.ODDS,
        status: value.STATUS,
        ver: value.VER,
        lastUpdate: new Date(value.LASTUPD)
    } as OddsItem));

    return NextResponse.json(oddsList);
}