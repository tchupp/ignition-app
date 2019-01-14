import test from "ava";
import {buildCatalog, CatalogToken, findOptions, IgnitionOptionsError, Options} from "../src";
import {left, right} from "fp-ts/lib/Either";

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};
const catalogToken: Promise<CatalogToken> = buildCatalog(families)
    .mapLeft(err => err as unknown as IgnitionOptionsError)
    .fold(() => "", e => e)
    .run()
    .then(n => n.value);

test("findOptions has two effects for timing", async t => {
    // @ts-ignore
    const [_, effects] = await findOptions(await catalogToken).run();

    t.deepEqual(effects.length, 2);

    t.deepEqual(effects[0].type, "Timing");
    t.deepEqual(effects[0].label, "findOptions: 69SwDy6bPLrHCUs3MTrBszftEko=");
    t.deepEqual(effects[1].type, "Timed");
    t.deepEqual(effects[1].label, "findOptions: 69SwDy6bPLrHCUs3MTrBszftEko=");
});

test("findOptions with no rules, and no selections", async t => {
    const [options] = await findOptions(await catalogToken).run();
    const newCatalogToken = await catalogToken;

    const expectedOptions: Options = {
        "shirts": [
            {type: "Available", item: "shirts:blue"},
            {type: "Available", item: "shirts:red"}
        ],
        "pants": [
            {type: "Available", item: "pants:jeans"},
            {type: "Available", item: "pants:slacks"},
        ]
    };
    t.deepEqual(options, right([expectedOptions, newCatalogToken]));
});

test("findOptions with no rules, and one selection", async t => {
    const [result1] = await findOptions(await catalogToken, ["shirts:red"]).run();

    const newCatalogToken = result1.map(e => e[1]).getOrElse("");
    const [result2] = await findOptions(newCatalogToken, []).run();

    const expectedOptions: Options = {
        "shirts": [
            {type: "Excluded", item: "shirts:blue"},
            {type: "Selected", item: "shirts:red"}
        ],
        "pants": [
            {type: "Available", item: "pants:jeans"},
            {type: "Available", item: "pants:slacks"},
        ]
    };
    t.deepEqual(result1.map(e => e[0]), right(expectedOptions));
    t.deepEqual(result1, result2);
});

test("findOptions with no rules, and all selections", async t => {
    const [result1] = await findOptions(await catalogToken, ["pants:slacks,   shirts:red"]).run();

    const newCatalogToken = result1.map(e => e[1]).getOrElse("");
    const [result2] = await findOptions(newCatalogToken, []).run();

    const expectedOptions: Options = {
        "shirts": [
            {type: "Excluded", item: "shirts:blue"},
            {type: "Selected", item: "shirts:red"}
        ],
        "pants": [
            {type: "Excluded", item: "pants:jeans"},
            {type: "Selected", item: "pants:slacks"},
        ]
    };
    t.deepEqual(result1.map(e => e[0]), right(expectedOptions));
    t.deepEqual(result1, result2);
});

test("findOptions with no rules, with unknown selection", async t => {
    const [error] = await findOptions(await catalogToken, ["shirts:black"]).run();

    const expectedError: IgnitionOptionsError = {
        items: ["shirts:black"],
        type: "UnknownSelections",
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is blank", async t => {
    const token = "";

    const [error] = await findOptions(token, ["shirts:black"]).run();

    const expectedError: IgnitionOptionsError = {
        type: "BadToken",
        token: token,
        detail: "failed to fill whole buffer"
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is the wrong length", async t => {
    const token = "MwAAAAAAAAAoM";

    const [error] = await findOptions(token, ["shirts:black"]).run();

    const expectedError: IgnitionOptionsError = {
        type: "BadToken",
        token: token,
        detail: "invalid length"
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is malformed", async t => {
    const token = "MwAAAAAAAAAoMCA";

    const [error] = await findOptions(token, ["shirts:black"]).run();

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
