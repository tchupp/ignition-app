import test from "ava";
import {buildCatalog, findOutfits, Item} from "../src";
import {right} from "fp-ts/lib/Either";

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};
const exclusions = {
    "shirts:blue": ["pants:jeans"]
};
const catalog = buildCatalog(families, exclusions);

test("findOutfits with one exclusion rule, no selections", async t => {
    const outfits1 = await catalog
        .chain(catalog => findOutfits(catalog, []))
        .run();

    const expected1 = [
        ["pants:jeans", "shirts:red"],
        ["pants:slacks", "shirts:blue"],
        ["pants:slacks", "shirts:red"],
    ];
    t.deepEqual(outfits1, right(expected1));
});

test("findOutfits with one exclusion rule, shirts selected", async t => {
    const outfits2 = await catalog
        .chain(catalog => findOutfits(catalog, ["shirts:blue"]))
        .run();

    const expected2 = [
        ["pants:slacks", "shirts:blue"],
    ];
    t.deepEqual(outfits2, right(expected2));
});

test("findOutfits with one exclusion rule, pants selected", async t => {
    const outfits3 = await catalog
        .chain(catalog => findOutfits(catalog, ["pants:jeans"]))
        .run();

    const expected3: Item[][] = [
        ["pants:jeans", "shirts:red"],
    ];
    t.deepEqual(outfits3, right(expected3));
});

test("findOutfits with one exclusion rule, conflicting selections", async t => {
    const outfits4 = await catalog
        .chain(catalog => findOutfits(catalog, ["pants:jeans", " shirts:blue  "]))
        .run();

    const expected4: Item[][] = [];
    t.deepEqual(outfits4, right(expected4));
});
