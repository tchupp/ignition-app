import test from "ava";
import {buildCatalog, findOutfits} from "../src";
import {right} from "fp-ts/lib/Either";

test("findOutfits with one exclusion rule", async t => {
    // setup
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const exclusions = {
        "shirts:blue": ["pants:jeans"]
    };
    const catalog = buildCatalog(families, exclusions);


    // case 1
    const outfits1 = await catalog
        .chain(catalog => findOutfits(catalog, []))
        .run();

    const expected1 = [
        ["pants:jeans", "shirts:red"],
        ["pants:slacks", "shirts:blue"],
        ["pants:slacks", "shirts:red"],
    ];
    t.deepEqual(outfits1, right(expected1));


    // case 2
    const outfits2 = await catalog
        .chain(catalog => findOutfits(catalog, ["shirts:blue"]))
        .run();

    const expected2 = [
        ["pants:slacks", "shirts:blue"],
    ];
    t.deepEqual(outfits2, right(expected2));


    // case 3
    const outfits3 = await catalog
        .chain(catalog => findOutfits(catalog, ["pants:jeans"]))
        .run();

    const expected3 = [
        ["pants:jeans", "shirts:red"],
    ];
    t.deepEqual(outfits3, right(expected3));
});
