import test from "ava";
import {buildCatalog, findOutfits} from "../src";
import {right} from "fp-ts/lib/Either";

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};
const catalog = buildCatalog(families);

test("findOutfits with no rules, no selections", async t => {
    const [outfit1] = await catalog
        .chain(catalog => findOutfits(catalog))
        .run();

    const expected1 = [
        ["pants:jeans", "shirts:blue"],
        ["pants:jeans", "shirts:red"],
        ["pants:slacks", "shirts:blue"],
        ["pants:slacks", "shirts:red"]
    ];
    t.deepEqual(outfit1, right(expected1));
});

test("findOutfits with no rules, shirts selected", async t => {
    const [outfit2] = await catalog
        .chain(catalog => findOutfits(catalog, ["shirts:red"]))
        .run();

    const expected2 = [
        ["pants:jeans", "shirts:red"],
        ["pants:slacks", "shirts:red"]
    ];
    t.deepEqual(outfit2, right(expected2));
});

test("findOutfits with no rules, pants selected", async t => {
    const [outfit3] = await catalog
        .chain(catalog => findOutfits(catalog, ["pants:slacks"]))
        .run();

    const expected3 = [
        ["pants:slacks", "shirts:blue"],
        ["pants:slacks", "shirts:red"]
    ];
    t.deepEqual(outfit3, right(expected3));
});

test("findOutfits with no rules, shirts and pants selected", async t => {
    const [outfit4] = await catalog
        .chain(catalog => findOutfits(catalog, ["pants:slacks", "shirts:red"]))
        .run();

    const expected4 = [
        ["pants:slacks", "shirts:red"]
    ];
    t.deepEqual(outfit4, right(expected4));
});
