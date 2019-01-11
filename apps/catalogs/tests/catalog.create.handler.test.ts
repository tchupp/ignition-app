import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";

import test from "ava";
import {left, right} from "fp-ts/lib/Either";
import {status} from "grpc";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {createCatalog} from "../src/catalog.create.handler";
import {CatalogRules} from "../src/catalog.create";
import {CreateCatalogRequest, Exclusion, Family, Inclusion, ItemOption} from "../generated/catalogs_pb";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {badRequestDetail, resourceInfoDetail, serviceError} from "../src/errors.pb";
import {DatastoreError, DatastoreErrorCode} from "../src/datastore.error";

const timestamp = new Date();

test("createCatalog returns 'created' when catalog is properly formed", async (t) => {
    const catalogId = "catalog-1";
    const catalogRules = {
        id: catalogId,
        families: {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        },
        exclusions: {},
        inclusions: {}
    };

    const req = rulesToRequest(catalogRules);

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
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
        excludeFromIndexes: ["token"],
        data: await buildTestCatalogEntity(
            catalogId,
            timestamp,
            catalogRules.families
        )
    };

    const datastoreStub: Datastore = mock(Datastore);

    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.insert(deepEqual(entity))).thenResolve(commitResult);

    const datastore = instance(datastoreStub);
    const [result, effects] = await createCatalog(req, timestamp)
        .map(catalog => catalog.toObject())
        .run(datastore);

    const expected = {
        catalogId: catalogId,
        token: entity.data.token,
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

    t.deepEqual([], effects);
});

test("createCatalog returns error when catalog already exists", async (t) => {
    const catalogId = "catalog-1";
    const catalogRules = {
        id: catalogId,
        families: {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        },
        exclusions: {},
        inclusions: {}
    };

    const req = rulesToRequest(catalogRules);

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };
    const entity = {
        key: catalogKey,
        excludeFromIndexes: ["token"],
        data: await buildTestCatalogEntity(
            catalogId,
            timestamp,
            catalogRules.families
        )
    };
    const insertError: DatastoreError = {
        code: DatastoreErrorCode.ALREADY_EXISTS,
        details: ""
    };

    const datastoreStub: Datastore = mock(Datastore);

    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.insert(deepEqual(entity))).thenReject(insertError);

    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp)
        .map(catalog => catalog.toObject())
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Catalog already exists",
            status.ALREADY_EXISTS,
            [
                resourceInfoDetail({
                    resourceType: "Catalog",
                    resourceName: catalogId,
                    owner: "",
                    description: "Catalogs may not be re-created, use UpdateCatalog to modify an existing Catalog",
                })
            ])
    ));
});

test("createCatalog returns error when families are empty in request", async (t) => {
    const catalogRules = {
        id: "catalog-4",
        families: {},
        exclusions: {},
        inclusions: {}
    };

    const req = rulesToRequest(catalogRules);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Families are required to build a catalog",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "families",
                        description: `field is required`
                    }]
                })
            ])
    ));
});

test("createCatalog returns error when item is registered to multiple families", async (t) => {
    const catalogRules = {
        id: "catalog-2",
        families: {
            "shirts": ["blue"],
            "pants": ["blue"]
        },
        exclusions: {},
        inclusions: {}
    };

    const req = rulesToRequest(catalogRules);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Items may only be registered to one family",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "families",
                        description: `Item 'blue' has multiple families: [shirts,pants]`
                    }]
                })
            ])
    ));
});

test("createCatalog returns error when an exclusion rule contain an item that doesn't have a family", async (t) => {
    const catalogRules = {
        id: "catalog-2",
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: {"shirts:blue": ["shirts:black"]},
        inclusions: {}
    };

    const req = rulesToRequest(catalogRules);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Selections and exclusions in rules must be registered to one family",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "exclusions",
                        description: `Item is not registered to any family: 'shirts:blue'`
                    }]
                })
            ])
    ));
});

test("createCatalog returns error when an exclusion rule contain a selection and exclusion in the same family", async (t) => {
    const catalogRules = {
        id: "catalog-2",
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: {"shirts:red": ["shirts:black"]},
        inclusions: {}
    };

    const req = rulesToRequest(catalogRules);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Exclusion rules may only exclude items from other families",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "exclusions",
                        description: `Exclusion rule has multiple items [shirts:black,shirts:red] from the same family 'shirts'`
                    }]
                })
            ])
    ));
});

test("createCatalog returns error when an inclusion rule contain an item that doesn't have a family", async (t) => {
    const catalogRules = {
        id: "catalog-3",
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: {},
        inclusions: {"shirts:blue": ["shirts:black"]}
    };

    const req = rulesToRequest(catalogRules);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Selections and inclusions in rules must be registered to one family",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "inclusions",
                        description: `Item is not registered to any family: 'shirts:blue'`
                    }]
                })
            ])
    ));
});

test("createCatalog returns error when an inclusion rule contain a selection and inclusion in the same family", async (t) => {
    const catalogRules = {
        id: "catalog-3",
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: {},
        inclusions: {"shirts:red": ["shirts:black"]}
    };

    const req = rulesToRequest(catalogRules);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Inclusion rules may only include items from other families",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "inclusions",
                        description: `Inclusion rule has multiple items [shirts:black,shirts:red] from the same family 'shirts'`
                    }]
                })
            ])
    ));
});

test("createCatalog returns error when there are multiple errors in the request", async (t) => {
    const catalogRules = {
        id: "catalog-2",
        families: {
            "shirts": ["blue"],
            "pants": ["blue"]
        },
        exclusions: {"red": ["blue"]},
        inclusions: {}
    };

    const req = rulesToRequest(catalogRules);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await createCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Multiple invalid request parameters",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "families",
                        description: `Item 'blue' has multiple families: [pants,shirts]`
                    }]
                }),
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "exclusions",
                        description: `Item is not registered to any family: 'red'`
                    }]
                })
            ])
    ));
});

function rulesToRequest(rules: CatalogRules): CreateCatalogRequest {
    const families = Object.keys(rules.families)
        .map(id => {
            const items = rules.families[id];

            const family = new Family();
            family.setFamilyId(id);
            family.setItemsList(items);
            return family;
        });
    const exclusions = Object.keys(rules.exclusions)
        .map(item => {
            const items = rules.exclusions[item];

            const exclusion = new Exclusion();
            exclusion.setSelectedItem(item);
            exclusion.setExclusionsList(items);
            return exclusion;
        });
    const inclusions = Object.keys(rules.inclusions)
        .map(item => {
            const items = rules.inclusions[item];

            const inclusion = new Inclusion();
            inclusion.setSelectedItem(item);
            inclusion.setInclusionsList(items);
            return inclusion;
        });


    const req = new CreateCatalogRequest();
    req.setCatalogId(rules.id);
    req.setFamiliesList(families);
    req.setExclusionsList(exclusions);
    req.setInclusionsList(inclusions);
    return req;
}
