import test from "ava";
import {buildCatalog, IgnitionBuildCatalogError} from "../src";
import {left} from "fp-ts/lib/Either";

test("build, when inclusion rule has the same family as the selection, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const inclusions = [{
        conditions: ["shirts:red"],
        inclusions: ["shirts:blue"],
    }];

    const [error] = await buildCatalog(families, [], inclusions).run();

    let expectedError: IgnitionBuildCatalogError = {
        type: "InclusionFamilyConflict",
        family: "shirts",
        items: ["shirts:blue", "shirts:red"]
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when inclusion rule has unknown item as selection, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const inclusions = [{
        conditions: ["shirts:black"],
        inclusions: ["pants:jeans"],
    }];

    const [error] = await buildCatalog(families, [], inclusions).run();

    let expectedError: IgnitionBuildCatalogError = {
        type: "InclusionMissingFamily",
        item: "shirts:black"
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when inclusion rule has unknown item in inclusions, gives an error", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };
    const inclusions = [{
        conditions: ["shirts:blue"],
        inclusions: ["pants:ripped"],
    }];

    const [error] = await buildCatalog(families, [], inclusions).run();

    let expectedError: IgnitionBuildCatalogError = {
        type: "InclusionMissingFamily",
        item: "pants:ripped"
    };
    t.deepEqual(error, left(expectedError));
});
