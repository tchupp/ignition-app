import test from "ava";
import {buildCloset, findOutfits} from "../src";
import {right} from "fp-ts/lib/Either";

test("findOutfits with one inclusion rule, and one deterministic selection", async t => {
    // setup
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const inclusions = {
        "shirts:red": ["pants:jeans"]
    };

    // case 1
    const outfits1 = await buildCloset(families, {}, inclusions)
        .chain(closet => findOutfits(closet, ["shirts:red"]))
        .run();

    const expected1 = [
        ["pants:jeans", "shirts:red"]
    ];
    t.deepEqual(outfits1, right(expected1));

    // case 2
    const outfits2 = await buildCloset(families, {}, inclusions)
        .chain(closet => findOutfits(closet, ["pants:jeans"]))
        .run();

    const expected2 = [
        ["pants:jeans", "shirts:blue"],
        ["pants:jeans", "shirts:red"]
    ];
    t.deepEqual(outfits2, right(expected2));
});
