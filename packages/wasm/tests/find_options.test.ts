import test from "ava";
import {buildCatalog, findOptions, IgnitionOptionsError, Options} from "../src";
import {left, right} from "fp-ts/lib/Either";

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};
const catalogToken = buildCatalog(families)
    .mapLeft(err => err as unknown as IgnitionOptionsError);

test("findOptions with no rules, and no selections", async t => {
    const options = await catalogToken
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
    const options = await catalogToken
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
    const options = await catalogToken
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
    const error = await catalogToken
        .chain(catalog => findOptions(catalog, ["shirts:black"]))
        .run();

    const expectedError: IgnitionOptionsError = {
        items: ["shirts:black"],
        type: "UnknownSelections",
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is blank", async t => {
    const token = "";

    const error = await findOptions(token, ["shirts:black"]).run();

    const expectedError: IgnitionOptionsError = {
        type: "BadToken",
        token: token,
        detail: "failed to fill whole buffer"
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is the wrong length", async t => {
    const token = "MwAAAAAAAAAoM";

    const error = await findOptions(token, ["shirts:black"]).run();

    const expectedError: IgnitionOptionsError = {
        type: "BadToken",
        token: token,
        detail: "invalid length"
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is malformed", async t => {
    const token = "MwAAAAAAAAAoMCA";

    const error = await findOptions(token, ["shirts:black"]).run();

    const expectedError: IgnitionOptionsError = {
        type: "BadToken",
        token: token,
        detail: ""
    };
    t.deepEqual(error, left(expectedError));
});

/*test.skip("findOptions with no rules, with more selections than families", async t => {
    const error = await catalogToken
        .chain(catalog => findOptions(catalog, ["shirts:red", "shirts:blue"]))
        .run();

    const expectedError: IgnitionOptionsError = {
        items: ["shirts:black"],
        type: "ExcludedItem",
    };
    t.deepEqual(error, left(expectedError));
});*/
