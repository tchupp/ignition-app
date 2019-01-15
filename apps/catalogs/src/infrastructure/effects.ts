import {IgnitionEffect} from "@ignition/wasm";
import {NomadRTE, NomadTE} from "@ignition/nomad";

export type CatalogsEffect =
    { type: "Timing", label: string, timeMs: number }
    | { type: "Timed", label: string, timeMs: number }
    ;

export function timedRTE<E, L, A>(label: string, timed: (e: E) => NomadTE<CatalogsEffect, L, A>): NomadRTE<E, CatalogsEffect, L, A> {
    const build = (type: "Timing" | "Timed", time: [number, number]) => ({
        type: type,
        label: label,
        timeMs: (time[0] * 1000) + (time[1] / 1000000)
    } as IgnitionEffect);

    const startTimingEffect = build("Timing", process.hrtime());

    return new NomadRTE(timed)
        .concat(startTimingEffect)
        .concatL(() => {
            const end = process.hrtime();
            return build("Timed", end);
        });
}
