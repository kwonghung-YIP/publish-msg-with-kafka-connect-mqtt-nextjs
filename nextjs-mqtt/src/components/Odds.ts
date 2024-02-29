export interface OddsItem {
    id: string;
    fstLeg: number;
    secLeg: number;
    odds: number;
    ver: number;
    lastUpdate: Date;
}

export interface RaceHorse {
    id: string;
    draw: number;
    horse: string;
    jockey: string;
    ver: number;
    lastUpdate: Date;
}