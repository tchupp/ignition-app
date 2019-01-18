import {handleEffects as handleTimingEffects, Timed, timed, Timing} from "./timing";

export {timed};

export type CatalogsEffect = Timing | Timed;

export async function handleEffects(effects: ReadonlyArray<CatalogsEffect>): Promise<void[]> {
    return Promise.all([
        handleTimingEffects(effects)
    ]);
}
