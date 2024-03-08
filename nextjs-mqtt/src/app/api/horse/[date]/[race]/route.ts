
import { OddsItem, RaceHorse } from "@/components/Odds";
import moment from "moment";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "redis";
import * as pino from "pino"

const REDIS_HOST = process.env.REDIS_HOST
const log = pino.pino()

export const GET = async (
    request: NextRequest, {params}: { params: { date: string; race: string } }): Promise<NextResponse> => {
    const { searchParams } = new URL(request.url);
    //const date = moment(searchParams.get('date'), "YYYYMMDD");
    //const race = searchParams.get('race');
    const date = moment(params.date,"YYYYMMDD");
    const race = params.race;

    console.log(`params: date:${date} race:${race}`);

    const client = createClient({
        url: `redis://${REDIS_HOST}`
    });

    client.on('error', err => console.log('redis client error:', err));

    await client.connect();

    //await client.ping();
    const epoch = Math.floor(date.unix() / 86400);
    console.log(`epoch date: ${epoch}`)

    const result = await client.ft.search('horse', `(@race_date:[${epoch} ${epoch}] @race_no:[${race} ${race}])`, {
        LIMIT: { from: 0, size: 30 },
        SORTBY: { BY: "draw", DIRECTION: "ASC"}
    });

    //console.log(typeof result);
    console.log(`ft.search result - total:${result.total} #result:${result.documents.length}`);

    type horseSearchResult = {
        DRAW: number;
        HORSE: string;
        JOCKEY: string;
        VER: number;
        LASTUPD: number;           
    }

    const horseList = result.documents.map(({ id, value }) => ({
        id: id,
        draw: value.DRAW,
        horse: value.HORSE,
        jockey: value.JOCKEY,
        ver: value.VER,
        lastUpdate: new Date(value.LASTUPD as number)
    } as RaceHorse));

    return NextResponse.json(horseList);
}