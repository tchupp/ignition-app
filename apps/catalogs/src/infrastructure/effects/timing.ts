import {NomadRTE, NomadTE} from "@ignition/nomad";

import {CatalogsEffect} from "./index";

export type Timing = { type: "Timing", timeMs: number, label: string };
export type Timed = { type: "Timed", timeMs: number, label: string };

export function Timing(time: [number, number], label: string): Timing {
    const timeMs = (time[0] * 1000) + (time[1] / 1000000);
    return {type: "Timing", timeMs: timeMs, label: label};
}

export function Timed(time: [number, number], label: string): Timed {
    const timeMs = (time[0] * 1000) + (time[1] / 1000000);
    return {type: "Timed", timeMs: timeMs, label: label};
}

export function timed<E, L, A>(label: string, timed: (e: E) => NomadTE<CatalogsEffect, L, A>): NomadRTE<E, CatalogsEffect, L, A> {
    const startTimingEffect = Timing(process.hrtime(), label);
    return new NomadRTE(timed)
        .concat(startTimingEffect)
        .concatL(() => Timed(process.hrtime(), label));
}

export async function handleEffects(effects: ReadonlyArray<CatalogsEffect>): Promise<void> {
    const filtered_effects = effects.filter(e => e.type === "Timing" || e.type === "Timed");

    groupBy(filtered_effects, effect => effect.label)
        .forEach((group, label) => {
            for (let i = 0; i < group.length; i += 2) {
                console.log(`${label}: ${group[i + 1].timeMs - group[i].timeMs}`);
            }
        });
}

function groupBy<T, K>(list: Array<T>, keyGetter: (t: T) => K): Map<K, T[]> {
    let map = new Map<K, T[]>();
    list.forEach(item => {
        const key = keyGetter(item);
        const group = map.get(key);
        if (group === undefined) {
            map = map.set(key, [item]);
        } else {
            group.push(item);
            map = map.set(key, group);
        }
    });
    return map;
}
