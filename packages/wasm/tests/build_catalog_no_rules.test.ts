import test from "ava";
import {buildCatalog} from "../src";
import {left} from "fp-ts/lib/Either";

test("build, when one item is in two families, gives an error", async t => {
    const families = {
        "shirts": ["shirts:blue"],
        "pants": ["shirts:blue"],
    };

    const error = await buildCatalog(families).run();

    let expectedError = {
        error: "ConflictingFamilies",
        description: "Items may only be registered to one family",
        details: "Item Item(\"shirts:blue\") has multiple families: [Family(\"pants\"), Family(\"shirts\")]",
    };
    t.deepEqual(error, left(expectedError));
});
