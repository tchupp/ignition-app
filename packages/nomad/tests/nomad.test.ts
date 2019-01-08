import test from "ava";
import {Nomad} from "../src";

test("concat", t => {
    let nomad1 = new Nomad([1]);
    let nomad2 = nomad1.concat(2);

    t.deepEqual(nomad1.effects.concat(2), nomad2.effects);
});