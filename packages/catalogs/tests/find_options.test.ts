import test from "ava";
import {buildCatalog, CatalogState, findOptions, CatalogOptionsError, Options} from "../src";
import {left, right} from "fp-ts/lib/Either";

const DEFAULT_STATE = {token: "", selections: [], exclusions: []};

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};
const catalogState: Promise<CatalogState> = buildCatalog(families)
    .fold(() => DEFAULT_STATE, res => res)
    .run()
    .then(n => n.value);

test("findOptions has one effect for timing", async t => {
    // @ts-ignore
    const [_, effects] = await findOptions(await catalogState).run();

    t.deepEqual(effects.length, 1);

    t.deepEqual(effects[0].type, "Timed");
    t.deepEqual(effects[0].name, "find_options");
    // @ts-ignore
    t.deepEqual(effects[0].details.token, "J8WFmwgHMh4Sh65iElxsr7f3Lx8=");
});

test("findOptions with no rules, and no selections", async t => {
    const [options] = await findOptions(await catalogState).run();
    const newCatalogState = await catalogState;

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
    t.deepEqual(options, right([expectedOptions, newCatalogState]));
});

test("findOptions with no rules, and one selection", async t => {
    const [result1] = await findOptions(await catalogState, ["shirts:red"]).run();

    const newCatalogState = result1.map(e => e[1]).getOrElse(DEFAULT_STATE);
    const [result2] = await findOptions(newCatalogState, []).run();

    const expectedOptions: Options = {
        "shirts": [
            {type: "Selected", item: "shirts:red"},
            {type: "Excluded", item: "shirts:blue"}
        ],
        "pants": [
            {type: "Available", item: "pants:jeans"},
            {type: "Available", item: "pants:slacks"},
        ]
    };
    t.deepEqual(result1.map(e => e[0]), right(expectedOptions));
    t.deepEqual(result1, result2);
});

test("findOptions with no rules, and two selections", async t => {
    const [result1] = await findOptions(await catalogState, ["pants:slacks"]).run();

    const expectedOptions1: Options = {
        "shirts": [
            {type: "Available", item: "shirts:blue"},
            {type: "Available", item: "shirts:red"}
        ],
        "pants": [
            {type: "Selected", item: "pants:slacks"},
            {type: "Excluded", item: "pants:jeans"},
        ]
    };
    t.deepEqual(result1.map(e => e[0]), right(expectedOptions1));

    const newCatalogState = result1.map(e => e[1]).getOrElse(DEFAULT_STATE);
    const [result2] = await findOptions(newCatalogState, ["shirts:red"]).run();

    const expectedOptions2: Options = {
        "shirts": [
            {type: "Selected", item: "shirts:red"},
            {type: "Excluded", item: "shirts:blue"}
        ],
        "pants": [
            {type: "Selected", item: "pants:slacks"},
            {type: "Excluded", item: "pants:jeans"},
        ]
    };
    t.deepEqual(result2.map(e => e[0]), right(expectedOptions2));
});

test("findOptions with no rules, and one exclusion", async t => {
    const [result1] = await findOptions(await catalogState, [], ["shirts:blue"]).run();

    const newCatalogState = result1.map(e => e[1]).getOrElse(DEFAULT_STATE);
    const [result2] = await findOptions(newCatalogState, []).run();

    const expectedOptions: Options = {
        "shirts": [
            {type: "Required", item: "shirts:red"},
            {type: "Excluded", item: "shirts:blue"}
        ],
        "pants": [
            {type: "Available", item: "pants:jeans"},
            {type: "Available", item: "pants:slacks"},
        ]
    };
    t.deepEqual(result1.map(e => e[0]), right(expectedOptions));
    t.deepEqual(result1, result2);
});

test("findOptions with no rules, and two exclusions", async t => {
    const [result1] = await findOptions(await catalogState, [], ["pants:slacks,   shirts:red"]).run();

    const newCatalogState = result1.map(e => e[1]).getOrElse(DEFAULT_STATE);
    const [result2] = await findOptions(newCatalogState, []).run();

    const expectedOptions: Options = {
        "shirts": [
            {type: "Required", item: "shirts:blue"},
            {type: "Excluded", item: "shirts:red"},
        ],
        "pants": [
            {type: "Required", item: "pants:jeans"},
            {type: "Excluded", item: "pants:slacks"},
        ]
    };
    t.deepEqual(result1.map(e => e[0]), right(expectedOptions));
    t.deepEqual(result1, result2);
});

test("findOptions with no rules, and one exclusion", async t => {
    const [result1] = await findOptions(await catalogState, ["pants:slacks"], ["shirts:blue"]).run();

    const newCatalogState = result1.map(e => e[1]).getOrElse(DEFAULT_STATE);
    const [result2] = await findOptions(newCatalogState, []).run();

    const expectedOptions: Options = {
        "shirts": [
            {type: "Required", item: "shirts:red"},
            {type: "Excluded", item: "shirts:blue"}
        ],
        "pants": [
            {type: "Selected", item: "pants:slacks"},
            {type: "Excluded", item: "pants:jeans"},
        ]
    };
    t.deepEqual(result1.map(e => e[0]), right(expectedOptions));
    t.deepEqual(result1, result2);
});

test("findOptions with no rules, with unknown selection", async t => {
    const [error] = await findOptions(await catalogState, ["shirts:black"]).run();

    const expectedError: CatalogOptionsError = {
        items: ["shirts:black"],
        type: "UnknownSelections",
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions with no rules, with unknown exclusion", async t => {
    const [error] = await findOptions(await catalogState, [], ["shirts:black"]).run();

    const expectedError: CatalogOptionsError = {
        items: ["shirts:black"],
        type: "UnknownExclusions",
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is blank", async t => {
    const state = {token: "", selections: [], exclusions: []};

    const [error] = await findOptions(state, ["shirts:black"]).run();

    const expectedError: CatalogOptionsError = {
        type: "BadToken",
        token: state.token,
        detail: "failed to fill whole buffer"
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is the wrong length", async t => {
    const state = {token: "MwAAAAAAAAAoM", selections: [], exclusions: []};

    const [error] = await findOptions(state, []).run();

    const expectedError: CatalogOptionsError = {
        type: "BadToken",
        token: state.token,
        detail: "invalid length"
    };
    t.deepEqual(error, left(expectedError));
});

test("findOptions returns error when the catalog token is malformed", async t => {
    const state = {token: "MwAAAAAAAAAoMCA", selections: [], exclusions: []};

    const [error] = await findOptions(state, []).run();

    const expectedError: CatalogOptionsError = {
        type: "BadToken",
        token: state.token,
        detail: ""
    };
    t.deepEqual(error, left(expectedError));
});

/*test.skip("findOptions with no rules, with more selections than families", async t => {
    const error = await catalogState
        .chain(catalog => findOptions(catalog, ["shirts:red", "shirts:blue"]))
        .run();

    const expectedError: IgnitionBuilderError = {
        items: ["shirts:black"],
        type: "ExcludedItem",
    };
    t.deepEqual(error, left(expectedError));
});*/
