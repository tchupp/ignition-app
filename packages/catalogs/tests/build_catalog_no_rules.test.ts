import test from "ava";
import {buildCatalog, CatalogState, IgnitionBuildCatalogError} from "../src";
import {left, right} from "fp-ts/lib/Either";

test("build, when one item is in two families, gives an error", async t => {
    const families = {
        "shirts": ["blue"],
        "pants": ["blue"],
    };

    const [error] = await buildCatalog(families).run();

    const expectedError: IgnitionBuildCatalogError = {
        type: "MultipleFamiliesRegistered",
        item: "blue",
        families: ["shirts", "pants"]
    };
    t.deepEqual(error, left(expectedError));
});

test("build, with no families, gives an error", async t => {
    const families = {};

    const [error] = await buildCatalog(families).run();

    const expectedError: IgnitionBuildCatalogError = {
        type: "EmptyCatalog",
    };
    t.deepEqual(error, left(expectedError));
});

test("build regression test v1", async t => {
    const families = {
        "shirts": ["shirts:red", "shirts:blue"],
        "pants": ["pants:jeans", "pants:slacks"],
    };

    const [catalog] = await buildCatalog(families).run();

    const expectedCatalog: CatalogState = {
        token: "MwAAAAAAAAAoMCAoMSAoTikgKDIgKDMgKE4pIChBKSkgKEEpKSkgKDIgKDMgKE4pIChBKSkgKEEpKSkEAAAAAAAAAAsAAAAAAAAAcGFudHM6amVhbnMCAAAAAAAAAAwAAAAAAAAAcGFudHM6c2xhY2tzAgAAAAAAAAALAAAAAAAAAHNoaXJ0czpibHVlAgAAAAAAAAAKAAAAAAAAAHNoaXJ0czpyZWQCAAAAAAAAAAQAAAAAAAAACwAAAAAAAABwYW50czpqZWFucwUAAAAAAAAAcGFudHMMAAAAAAAAAHBhbnRzOnNsYWNrcwUAAAAAAAAAcGFudHMLAAAAAAAAAHNoaXJ0czpibHVlBgAAAAAAAABzaGlydHMKAAAAAAAAAHNoaXJ0czpyZWQGAAAAAAAAAHNoaXJ0cw==",
        selections: [],
        exclusions: [],
    };
    t.deepEqual(catalog, right(expectedCatalog));
});
