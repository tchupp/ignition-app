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

function Timed(id: string, name: string, details: EffectDetails, startTime: [number, number], endTime: [number, number]): Timed {
    const startTimeMs = (startTime[0] * 1000) + (startTime[1] / 1000000);
    const endTimeMs = (endTime[0] * 1000) + (endTime[1] / 1000000);
    return {
        type: "Timed",
        id: id,
        name: name,
        timeMs: endTimeMs - startTimeMs,
        details: details
    };
}

export function timed<E, L, A>(name: string, details: EffectDetails, timed: (e: E) => NomadTE<CatalogsEffect, L, A>): NomadRTE<E, CatalogsEffect, L, A> {
    const id = uuid();

    const startTime = process.hrtime();
    return new NomadRTE(timed)
        .concatL(() => Timed(id, name, details, startTime, process.hrtime()));
}
