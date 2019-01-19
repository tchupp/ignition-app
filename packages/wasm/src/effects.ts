import {TaskEither} from "fp-ts/lib/TaskEither";
import {fromTaskEither, NomadTE} from "@ignition/nomad";
import {v4 as uuid} from "uuid";

export type IgnitionEffect = Timed;

export type EffectDetails =
    {}
    | { readonly token: string }

export type Timed = {
    readonly type: "Timed"
    readonly id: string
    readonly name: string
    readonly timeMs: number
    readonly details: EffectDetails
}

export function Timed(id: string, name: string, details: EffectDetails, startTime: [number, number], endTime: [number, number]): Timed {
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

export function timed<L, A>(name: string, details: EffectDetails, timed: () => TaskEither<L, A>): NomadTE<IgnitionEffect, L, A> {
    const id = uuid();

    const startTime = process.hrtime();
    return fromTaskEither<IgnitionEffect, L, A>(timed())
        .concatL(() => Timed(id, name, details, startTime, process.hrtime()));
}
