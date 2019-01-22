import {NomadRTE, NomadTE} from "@ignition/nomad";

import {v4 as uuid} from "uuid";
import {CatalogsEffect, EffectDetails} from "./index";

export type Timed = {
    readonly type: "Timed"
    readonly id: string
    readonly name: string
    readonly timeMs: number
    readonly details: EffectDetails
}

export function Timed(id: string, name: string, details: EffectDetails, time: [number, number]): Timed {
    const timeMs = (time[0] * 1000) + (time[1] / 1000000);
    return {
        type: "Timed",
        id: id,
        name: name,
        timeMs: timeMs,
        details: details
    };
}

export function timed<E, L, A>(name: string, details: EffectDetails, timed: (e: E) => NomadTE<CatalogsEffect, L, A>): NomadRTE<E, CatalogsEffect, L, A> {
    const id = uuid();

    const startTime = process.hrtime();
    return new NomadRTE(timed)
        .concatL(() => Timed(id, name, details, process.hrtime(startTime)));
}
