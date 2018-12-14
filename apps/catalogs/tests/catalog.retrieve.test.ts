import Datastore = require("@google-cloud/datastore");
import {Options} from "@ignition/wasm";

import test from "ava";
import {instance, mock, when} from "ts-mockito";

import {left, right} from "fp-ts/lib/Either";

import {CatalogEntity} from "../src/catalog.entity";
import {ErrorType, retrieveCatalog} from "../src/catalog.retrieve";
import {buildTestCatalogEntity} from "./catalog.test-fixture";

const timestamp = new Date();

test("retrieveCatalog returns catalog options, when request contains valid id", async (t) => {
    const catalogId = "catalog-1";
    const entity: CatalogEntity = await buildTestCatalogEntity(
        catalogId,
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );

    const queryStub = mock(Datastore.Query);
    const query = instance(queryStub);

    when(queryStub.filter("id", catalogId)).thenReturn(query);
    when(queryStub.limit(1)).thenReturn(query);

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.createQuery("Catalog")).thenReturn(query);
    when(datastoreStub.runQuery(query)).thenResolve([[entity], {moreResults: 'NO_MORE_RESULTS'}]);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(catalogId, []).run(datastore);

    const expected: Options = {
        "pants": [
            {"type": "Available", "item": "pants:jeans"},
            {"type": "Available", "item": "pants:slacks"},
        ],
        "shirts": [
            {"type": "Available", "item": "shirts:black"},
            {"type": "Available", "item": "shirts:red"},
        ]
    };

    t.deepEqual(result, right({id: catalogId, options: expected}));
});

test("retrieveCatalog returns catalog options, modified by selections, when request contains valid id", async (t) => {
    const catalogId = "catalog-2";
    const selections = [" shirts:red"];

    const entity: CatalogEntity = await buildTestCatalogEntity(
        catalogId,
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );

    const queryStub = mock(Datastore.Query);
    const query = instance(queryStub);

    when(queryStub.filter("id", catalogId)).thenReturn(query);
    when(queryStub.limit(1)).thenReturn(query);

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.createQuery("Catalog")).thenReturn(query);
    when(datastoreStub.runQuery(query)).thenResolve([[entity], {moreResults: 'NO_MORE_RESULTS'}]);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(catalogId, selections).run(datastore);
    console.log(result);

    const expected: Options = {
        "pants": [
            {"type": "Available", "item": "pants:jeans"},
            {"type": "Available", "item": "pants:slacks"},
        ],
        "shirts": [
            {"type": "Excluded", "item": "shirts:black"},
            {"type": "Selected", "item": "shirts:red"},
        ]

    };

    t.deepEqual(result, right({id: catalogId, options: expected}));
});

test.skip("retrieveCatalog returns error, when request contains two selections in the same family", async (t) => {
    const catalogId = "catalog-3";
    const selections = ["shirts:red", "  shirts:black"];

    const entity: CatalogEntity = await buildTestCatalogEntity(
        catalogId,
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );

    const queryStub = mock(Datastore.Query);
    const query = instance(queryStub);

    when(queryStub.filter("id", catalogId)).thenReturn(query);
    when(queryStub.limit(1)).thenReturn(query);

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.createQuery("Catalog")).thenReturn(query);
    when(datastoreStub.runQuery(query)).thenResolve([[entity], {moreResults: 'NO_MORE_RESULTS'}]);

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
    const catalogId = "catalog-4";
    const selections = ["shirts:blue"];

    const entity: CatalogEntity = await buildTestCatalogEntity(
        catalogId,
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );

    const queryStub = mock(Datastore.Query);
    const query = instance(queryStub);

    when(queryStub.filter("id", catalogId)).thenReturn(query);
    when(queryStub.limit(1)).thenReturn(query);

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.createQuery("Catalog")).thenReturn(query);
    when(datastoreStub.runQuery(query)).thenResolve([[entity], {moreResults: 'NO_MORE_RESULTS'}]);

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