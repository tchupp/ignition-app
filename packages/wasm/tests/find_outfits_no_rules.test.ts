import test from "ava";
import {buildCatalog, findOutfits} from "../src";
import {right} from "fp-ts/lib/Either";

test("findOutfits with no rules", async t => {
    // setup
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };


    // case 1
    const outfit1 = await buildCatalog(families)
        .chain(catalog => findOutfits(catalog))
        .run();

    const expected1 = [
        ["pants:jeans", "shirts:blue"],
        ["pants:jeans", "shirts:red"],
        ["pants:slacks", "shirts:blue"],
        ["pants:slacks", "shirts:red"]
    ];
    t.deepEqual(outfit1, right(expected1));


    // case 2
    const outfit2 = await buildCatalog(families)
        .chain(catalog => findOutfits(catalog, ["shirts:red"]))
        .run();

    const expected2 = [
        ["pants:jeans", "shirts:red"],
        ["pants:slacks", "shirts:red"]
    ];
    t.deepEqual(outfit2, right(expected2));


    // case 3
    const outfit3 = await buildCatalog(families)
        .chain(catalog => findOutfits(catalog, ["pants:slacks", "shirts:red"]))
        .run();

    const expected3 = [
        ["pants:slacks", "shirts:red"]
    ];
    t.deepEqual(outfit3, right(expected3));
});
