import test from "ava";
import {buildCatalog, IgnitionBuildCatalogError} from "../src";
import {left} from "fp-ts/lib/Either";

test("build, when one item is in two families, gives an error", async t => {
    const families = {
        "shirts": ["shirts:blue"],
        "pants": ["shirts:blue"],
    };

    const [error] = await buildCatalog(families).run();

    const expectedError: IgnitionBuildCatalogError = {
        type: "MultipleFamiliesRegistered",
        item: "shirts:blue",
        families: ["pants", "shirts"]
    };
    t.deepEqual(error, left(expectedError));
});
