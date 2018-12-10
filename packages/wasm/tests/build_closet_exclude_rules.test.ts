import test from "ava";
import {buildCloset} from "../src";
import {left} from "fp-ts/lib/Either";

test("build, when exclusion rule has the same family as the selection, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const exclusions = {
        "shirts:red": ["shirts:blue"]
    };

    const error = await buildCloset(families, exclusions).run();

    let expectedError = {
        error: "ExclusionError",
        description: "Exclusion rules may only contain items from other families",
        details: "Exclusion rule has multiple items [Item(\"shirts:blue\"), Item(\"shirts:red\")] from the same family Family(\"shirts\")",
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when exclusion rule has unknown item as selection, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const exclusions = {
        "shirts:black": ["pants:jeans"]
    };

    const error = await buildCloset(families, exclusions).run();

    let expectedError = {
        error: "MissingFamily",
        description: "Items must be registered to exactly one family",
        details: "Item is not registered to any family: Item(\"shirts:black\")",
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when exclusion rule has unknown item in exclusions, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const exclusions = {
        "shirts:blue": ["pants:ripped"]
    };

    const error = await buildCloset(families, exclusions).run();

    let expectedError = {
        error: "MissingFamily",
        description: "Items must be registered to exactly one family",
        details: "Item is not registered to any family: Item(\"pants:ripped\")",
    };
    t.deepEqual(error, left(expectedError));
});
