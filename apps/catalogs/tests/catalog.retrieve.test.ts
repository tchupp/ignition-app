import Datastore = require("@google-cloud/datastore");
import {Options} from "@ignition/wasm";
import test from "ava";
import {left, right} from "fp-ts/lib/Either";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {CatalogEntity} from "../src/catalog.entity";
import {ErrorType, retrieveCatalog} from "../src/catalog.retrieve";
import {buildTestCatalogEntity} from "./catalog.test-fixture";

const timestamp = new Date();

test("retrieveCatalog returns catalog options, when request contains valid id", async (t) => {
    const catalogId = "5710353417";
    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };
    const entity: CatalogEntity = await buildTestCatalogEntity(
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(catalogId, []).run(datastore);

    const expected: Options = {
        "pants": [
            {Available: "pants:jeans"},
            {Available: "pants:slacks"},
        ],
        "shirts": [
            {Available: "shirts:black"},
            {Available: "shirts:red"},
        ]

    };

    t.deepEqual(result, right({id: catalogId, options: expected}));
});

test("retrieveCatalog returns catalog options, modified by selections, when request contains valid id", async (t) => {
    const catalogId = "5710353417";
    const selections = [" shirts:red"];

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };
    const entity: CatalogEntity = await buildTestCatalogEntity(
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(catalogId, selections).run(datastore);

    const expected: Options = {
        "pants": [
            {Available: "pants:jeans"},
            {Available: "pants:slacks"},
        ],
        "shirts": [
            {Excluded: "shirts:black"},
            {Selected: "shirts:red"},
        ]

    };

    t.deepEqual(result, right({id: catalogId, options: expected}));
});

test.skip("retrieveCatalog returns error, when request contains two selections in the same family", async (t) => {
    const catalogId = "5710353417";
    const selections = ["shirts:red", "  shirts:black"];

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };
    const entity: CatalogEntity = await buildTestCatalogEntity(
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );
    const datastoreStub: Datastore = mock(Datastore);

    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(catalogId, selections).run(datastore);

    t.deepEqual(result, left({
        type: ErrorType.Ignition,
        body: {
            description: "Only available items may be selected",
            details: "Selected item is excluded: Item(\"shirts:black\")",
            error: "ExcludedItem",
        }
    }));
});

test("retrieveCatalog returns error, when request contains unknown selection", async (t) => {
    const catalogId = "5710353417";
    const selections = ["shirts:blue"];

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };
    const entity: CatalogEntity = await buildTestCatalogEntity(
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );
    const datastoreStub: Datastore = mock(Datastore);

    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(catalogId, selections).run(datastore);

    t.deepEqual(result, left({
        type: ErrorType.Ignition,
        body: {
            description: "Only known items may be selected",
            details: "Selected items are unknown: [\"shirts:blue\"]",
            error: "UnknownItems",
        }
    }));
});