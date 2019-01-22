import test from "ava";
import {Timed} from "../src/infrastructure/effects/timing";

test("timeMs is calculated correctly", async (t) => {
    const timed = Timed("1234", "function", {}, [90, 80000]);

    t.deepEqual(90000.08, timed.timeMs);
});