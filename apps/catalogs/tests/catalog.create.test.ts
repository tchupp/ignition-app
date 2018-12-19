import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";

import test from "ava";
import {left, right} from "fp-ts/lib/Either";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {CatalogRules, createCatalog, ErrorType} from "../src/catalog.create";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {Options} from "@ignition/wasm";

const timestamp = new Date();

test("createCatalog returns 'created' when catalog is properly formed", async (t) => {
    const catalogRules: CatalogRules = {
        id: "catalog-3",
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: {},
        inclusions: {}
    };

    const catalogKey = {
        id: "catalog-3",
        kind: "Catalog",
        path: ["Catalog", "5710353417"]
    };
    const commitResult: CommitResult = [{
        mutationResults: [
            {
                key: catalogKey,
                conflictDetected: false,
                version: 1
            }
        ],
        indexUpdates: 1
    }];
    const entity = {
        key: catalogKey,
        excludeFromIndexes: ["serialized"],
        data: await buildTestCatalogEntity(
            "catalog-3",
            timestamp,
            catalogRules.families
        )
    };

    const datastoreStub: Datastore = mock(Datastore);

    when(datastoreStub.key(deepEqual({path: ["Catalog"]}))).thenReturn(catalogKey);
    when(datastoreStub.upsert(deepEqual(entity))).thenResolve(commitResult);

    const datastore = instance(datastoreStub);
    const result = await createCatalog(catalogRules).run([datastore, timestamp]);

    const expectedOptions: Options = {
        "shirts": [
            {"type": "Available", "item": "shirts:black"},
            {"type": "Available", "item": "shirts:red"},
        ]
    };
    t.deepEqual(result, right({id: catalogRules.id, options: expectedOptions}));
});

test("createCatalog returns error when families are empty in request", async (t) => {
    const catalogRules: CatalogRules = {
        id: "catalog-3",
        families: {},
        exclusions: {},
        inclusions: {}
    };

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const result = await createCatalog(catalogRules).run([datastore, timestamp]);

    t.deepEqual(result, left({type: ErrorType.InvalidInput, body: {message: "Request is missing 'families' object"}}));
});

test("createCatalog returns error when exclusions contain an item that doesn't have a family", async (t) => {
    const catalogRules: CatalogRules = {
        id: "catalog-3",
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: {"shirts:blue": ["shirts:black"]},
        inclusions: {}
    };

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const result = await createCatalog(catalogRules).run([datastore, timestamp]);

    let errorBody = {
        description: "Items must be registered to exactly one family",
        details: "Item is not registered to any family: Item(\"shirts:blue\")",
        error: "MissingFamily",
    };
    t.deepEqual(result, left({type: ErrorType.Ignition, body: errorBody}));
});

test("createCatalog returns error when inclusions contain an item that doesn't have a family", async (t) => {
    const catalogRules: CatalogRules = {
        id: "catalog-3",
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: {},
        inclusions: {"shirts:blue": ["shirts:black"]}
    };

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const result = await createCatalog(catalogRules).run([datastore, timestamp]);

    let errorBody = {
        description: "Items must be registered to exactly one family",
        details: "Item is not registered to any family: Item(\"shirts:blue\")",
        error: "MissingFamily",
    };
    t.deepEqual(result, left({type: ErrorType.Ignition, body: errorBody}));
});
