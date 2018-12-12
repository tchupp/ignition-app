import test from "ava";
import {buildCatalog} from "../src";
import {left} from "fp-ts/lib/Either";

test("build, when inclusion rule has the same family as the selection, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const inclusions = {
        "shirts:red": ["shirts:blue"]
    };

    const error = await buildCatalog(families, {}, inclusions).run();

    let expectedError = {
        error: "InclusionError",
        description: "Inclusion rules may only contain items from other families",
        details: "Inclusion rule has multiple items [Item(\"shirts:blue\"), Item(\"shirts:red\")] from the same family Family(\"shirts\")",
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when inclusion rule has unknown item as selection, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const inclusions = {
        "shirts:black": ["pants:jeans"]
    };

    const error = await buildCatalog(families, {}, inclusions).run();

    let expectedError = {
        error: "MissingFamily",
        description: "Items must be registered to exactly one family",
        details: "Item is not registered to any family: Item(\"shirts:black\")",
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when inclusion rule has unknown item in inclusions, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const inclusions = {
        "shirts:blue": ["pants:ripped"]
    };

    const error = await buildCatalog(families, {}, inclusions).run();

    let expectedError = {
        error: "MissingFamily",
        description: "Items must be registered to exactly one family",
        details: "Item is not registered to any family: Item(\"pants:ripped\")",
    };
    t.deepEqual(error, left(expectedError));
});
