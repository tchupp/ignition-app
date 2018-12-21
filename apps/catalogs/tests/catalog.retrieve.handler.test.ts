import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {instance, mock, when} from "ts-mockito";

import {right} from "fp-ts/lib/Either";

import {CatalogEntity} from "../src/catalog.entity";
import {retrieveCatalog} from "../src/catalog.retrieve.handler";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {Catalog, ItemOption, RetrieveCatalogRequest} from "../generated/catalogs_pb";
import {map} from "rxjs/operators";

const timestamp = new Date();

test("retrieveCatalog returns catalog options, when request contains valid catalog id", async (t) => {
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

    const req = new RetrieveCatalogRequest();
    req.setCatalogId(catalogId);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(req, datastore)
        .pipe(map(res => res.map(catalog => catalog.toObject())))
        .toPromise();

    const expected: Catalog.AsObject = {
        catalogId: catalogId,
        optionsList: [
            {
                familyId: "pants",
                optionsList: [
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:jeans"},
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:slacks"},
                ]
            },
            {
                familyId: "shirts",
                optionsList: [
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "shirts:black"},
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "shirts:red"},
                ]
            }
        ]
    };
    t.deepEqual(result, right(expected));
});

test("retrieveCatalog returns catalog options, when request contains an empty selection", async (t) => {
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

    const req = new RetrieveCatalogRequest();
    req.setCatalogId(catalogId);
    req.setSelectionsList([""]);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(req, datastore)
        .pipe(map(res => res.map(catalog => catalog.toObject())))
        .toPromise();

    const expected: Catalog.AsObject = {
        catalogId: catalogId,
        optionsList: [
            {
                familyId: "pants",
                optionsList: [
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:jeans"},
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:slacks"},
                ]
            },
            {
                familyId: "shirts",
                optionsList: [
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "shirts:black"},
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "shirts:red"},
                ]
            }
        ]
    };
    t.deepEqual(result, right(expected));
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

    const req = new RetrieveCatalogRequest();
    req.setCatalogId(catalogId);
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(req, datastore)
        .pipe(map(res => res.map(catalog => catalog.toObject())))
        .toPromise();

    const expected: Catalog.AsObject = {
        catalogId: catalogId,
        optionsList: [
            {
                familyId: "pants",
                optionsList: [
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:jeans"},
                    {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:slacks"},
                ]
            },
            {
                familyId: "shirts",
                optionsList: [
                    {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "shirts:black"},
                    {"itemStatus": ItemOption.Status.SELECTED, "itemId": "shirts:red"},
                ]
            }
        ]
    };

    t.deepEqual(result, right(expected));
});

test("retrieveCatalog returns all excluded, when request contains two selections in the same family", async (t) => {
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

    const req = new RetrieveCatalogRequest();
    req.setCatalogId(catalogId);
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const result = await retrieveCatalog(req, datastore)
        .pipe(map(res => res.map(catalog => catalog.toObject())))
        .toPromise();

    const expected: Catalog.AsObject = {
        catalogId: catalogId,
        optionsList: [
            {
                familyId: "pants",
                optionsList: [
                    {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "pants:jeans"},
                    {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "pants:slacks"},
                ]
            },
            {
                familyId: "shirts",
                optionsList: [
                    {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "shirts:black"},
                    {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "shirts:red"},
                ]
            }
        ]
    };

    t.deepEqual(result, right(expected));
});
