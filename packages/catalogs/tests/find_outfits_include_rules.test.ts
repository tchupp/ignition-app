import test from "ava";
import {buildCatalog, findOutfits} from "../src";
import {right} from "fp-ts/lib/Either";

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};
const inclusions = [{
    conditions: ["shirts:red"],
    inclusions: ["pants:jeans"],
}];
const catalog = buildCatalog(families, [], inclusions);

test("findOutfits with one inclusion rule, and shirts selected", async t => {
    const [outfits1] = await catalog
        .chain(catalog => findOutfits(catalog, ["shirts:red"]))
        .run();

    const expected1 = [
        ["pants:jeans", "shirts:red"]
    ];
    t.deepEqual(outfits1, right(expected1));
});

test("findOutfits with one inclusion rule, and pants selected", async t => {
    const [outfits2] = await catalog
        .chain(catalog => findOutfits(catalog, ["pants:jeans"]))
        .run();

    const expected2 = [
        ["pants:jeans", "shirts:blue"],
        ["pants:jeans", "shirts:red"]
    ];
    t.deepEqual(outfits2, right(expected2));
});
