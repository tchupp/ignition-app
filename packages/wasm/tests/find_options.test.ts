import test from "ava";
import {buildCloset, findOptions, Options} from "../src";
import {left, right} from "fp-ts/lib/Either";

test("findOptions with no rules, and no selections", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };

    const options = await buildCloset(families)
        .chain(closet => findOptions(closet))
        .run();

    const expected: Options = {
        "shirts": [
            {Available: "shirts:blue"},
            {Available: "shirts:red"}
        ],
        "pants": [
            {Available: "pants:jeans"},
            {Available: "pants:slacks"},
        ]
    };
    t.deepEqual(options, right(expected));
});

test("findOptions with no rules, and one selection", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };

    const options = await buildCloset(families)
        .chain(closet => findOptions(closet, ["shirts:red"]))
        .run();

    const expected: Options = {
        "shirts": [
            {Excluded: "shirts:blue"},
            {Selected: "shirts:red"}
        ],
        "pants": [
            {Available: "pants:jeans"},
            {Available: "pants:slacks"},
        ]
    };
    t.deepEqual(options, right(expected));
});

test("findOptions with no rules, and all selections", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };

    const options = await buildCloset(families)
        .chain(closet => findOptions(closet, ["pants:slacks", "shirts:red"]))
        .run();

    const expected: Options = {
        "shirts": [
            {Excluded: "shirts:blue"},
            {Selected: "shirts:red"}
        ],
        "pants": [
            {Excluded: "pants:jeans"},
            {Selected: "pants:slacks"},
        ]
    };
    t.deepEqual(options, right(expected));
});

test.skip("findOptions with no rules, with unknown selection", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };

    const error = await buildCloset(families)
        .chain(closet => findOptions(closet, ["shirts:black"]))
        .run();

    let expectedError = {
        description: "Only known items may be selected",
        details: "Selected item is unknown: Item(\"shirts:black\")",
        error: "UnknownItem",
    };
    t.deepEqual(error, left(expectedError));
});

test.skip("findOptions with no rules, with more selections than families", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };

    const options = buildCloset(families)
        .chain(closet => findOptions(closet, ["shirts:red", "shirts:blue"]))
        .run();
    const error = await options;

    let expectedError = {
        description: "Only available items may be selected",
        details: "Selected item is excluded: Item(\"shirts:blue\")",
        error: "ExcludedItem",
    };
    t.deepEqual(error, left(expectedError));
});
