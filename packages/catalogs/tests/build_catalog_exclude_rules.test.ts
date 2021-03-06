import test from "ava";
import {buildCatalog, CatalogBuildError} from "../src";
import {left} from "fp-ts/lib/Either";

const families = {
    "shirts": ["shirts:red", "shirts:blue"],
    "pants": ["pants:jeans", "pants:slacks"],
};

test("build, when exclusion rule has the same family as the selection, gives an error", async t => {
    const exclusions = [{
        conditions: ["shirts:red"],
        exclusions: ["shirts:blue"],
    }];

    const [error] = await buildCatalog(families, exclusions).run();

    const expectedError: CatalogBuildError = {
        type: "ExclusionFamilyConflict",
        family: "shirts",
        items: ["shirts:blue", "shirts:red"]
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when exclusion rule has unknown item as selection, gives an error", async t => {
    const exclusions = [{
        conditions: ["shirts:black"],
        exclusions: ["pants:jeans"],
    }];

    const [error] = await buildCatalog(families, exclusions).run();

    const expectedError: CatalogBuildError = {
        type: "ExclusionMissingFamily",
        item: "shirts:black"
    };
    t.deepEqual(error, left(expectedError));
});

test("build, when exclusion rule has unknown item in exclusions, gives an error", async t => {
    const exclusions = [{
        conditions: ["shirts:blue"],
        exclusions: ["pants:ripped"],
    }];

    const [error] = await buildCatalog(families, exclusions).run();

    const expectedError: CatalogBuildError = {
        type: "ExclusionMissingFamily",
        item: "pants:ripped"
    };
    t.deepEqual(error, left(expectedError));
});
