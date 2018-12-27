import test from "ava";
import {buildCatalog, findOptions, IgnitionOptionsError, Options} from "../src";
import {left, right} from "fp-ts/lib/Either";

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};
const catalog = buildCatalog(families)
    .mapLeft(err => err as unknown as IgnitionOptionsError);

test("findOptions with no rules, and no selections", async t => {
    const options = await catalog
        .chain(catalog => findOptions(catalog))
        .run();

    const expected: Options = {
        "shirts": [
            {type: "Available", item: "shirts:blue"},
            {type: "Available", item: "shirts:red"}
        ],
        "pants": [
            {type: "Available", item: "pants:jeans"},
            {type: "Available", item: "pants:slacks"},
        ]
    };
    t.deepEqual(options, right(expected));
});

test("findOptions with no rules, and one selection", async t => {
    const options = await catalog
        .chain(catalog => findOptions(catalog, ["shirts:red"]))
        .run();

    const expected: Options = {
        "shirts": [
            {type: "Excluded", item: "shirts:blue"},
            {type: "Selected", item: "shirts:red"}
        ],
        "pants": [
            {type: "Available", item: "pants:jeans"},
            {type: "Available", item: "pants:slacks"},
        ]
    };
    t.deepEqual(options, right(expected));
});

test("findOptions with no rules, and all selections", async t => {
    const options = await catalog
        .chain(catalog => findOptions(catalog, ["pants:slacks", "shirts:red"]))
        .run();

    const expected: Options = {
        "shirts": [
            {type: "Excluded", item: "shirts:blue"},
            {type: "Selected", item: "shirts:red"}
        ],
        "pants": [
            {type: "Excluded", item: "pants:jeans"},
            {type: "Selected", item: "pants:slacks"},
        ]
    };
    t.deepEqual(options, right(expected));
});

test("findOptions with no rules, with unknown selection", async t => {
    const error = await catalog
        .chain(catalog => findOptions(catalog, ["shirts:black"]))
        .run();

    let expectedError: IgnitionOptionsError = {
        items: ["shirts:black"],
        type: "UnknownSelections",
    };
    t.deepEqual(error, left(expectedError));
});

test.skip("findOptions with no rules, with more selections than families", async t => {
    const error = await catalog
        .chain(catalog => findOptions(catalog, ["shirts:red", "shirts:blue"]))
        .run();

    let expectedError = {
        items: ["shirts:black"],
        type: "ExcludedItem",
    };
    t.deepEqual(error, left(expectedError));
});
