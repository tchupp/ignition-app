import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";

import test from "ava";
import {left, right} from "fp-ts/lib/Either";
import {status} from "grpc";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {
    CatalogExclusionsRule,
    CatalogInclusionsRule,
    CreateCatalogRequest,
    Family,
    ItemOption
} from "../generated/catalogs_pb";
import {badRequestDetail, serviceError} from "../src/infrastructure/errors.pb";
import {updateCatalog} from "../src/functions/catalog.update.handler";
import {CatalogAssembly} from "../src/functions/catalog.entity";

const timestamp = new Date();
const projectId = "my-project";

test("updateCatalog returns 'created' when catalog is properly formed", async (t) => {
    const catalogId = "catalog-1";
    const catalogAssembly = {
        families: {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        },
        exclusions: [],
        inclusions: []
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

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
            projectId,
            catalogId,
            timestamp,
            catalogAssembly.families
        )
    };

    const datastoreStub: Datastore = mock(Datastore);

    when(datastoreStub.key(deepEqual({path: ["Project", projectId, "Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.upsert(deepEqual(entity))).thenResolve(commitResult);

    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp)
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
});

test("updateCatalog returns error when families are empty in request", async (t) => {
    const catalogId = "catalog-4";
    const catalogAssembly = {
        families: {},
        exclusions: [],
        inclusions: []
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp).run(datastore);

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

test("updateCatalog returns error when item is registered to multiple families", async (t) => {
    const catalogId = "catalog-2";
    const catalogAssembly = {
        families: {
            "shirts": ["blue"],
            "pants": ["blue"]
        },
        exclusions: [],
        inclusions: []
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp).run(datastore);

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

test("updateCatalog returns error when an exclusion rule contain an item that doesn't have a family", async (t) => {
    const catalogId = "catalog-2";
    const catalogAssembly = {
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: [{conditions: ["shirts:blue"], exclusions: ["shirts:black"]}],
        inclusions: []
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp).run(datastore);

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

test("updateCatalog returns error when an exclusion rule contain a selection and exclusion in the same family", async (t) => {
    const catalogId = "catalog-2";
    const catalogAssembly = {
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: [{conditions: ["shirts:red"], exclusions: ["shirts:black"]}],
        inclusions: []
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp).run(datastore);

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

test("updateCatalog returns error when an inclusion rule contain an item that doesn't have a family", async (t) => {
    const catalogId = "catalog-3";
    const catalogAssembly = {
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: [],
        inclusions: [{conditions: ["shirts:blue"], inclusions: ["shirts:black"]}],
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp).run(datastore);

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

test("updateCatalog returns error when an inclusion rule contain a selection and inclusion in the same family", async (t) => {
    const catalogId = "catalog-3";
    const catalogAssembly = {
        families: {"shirts": ["shirts:black", "shirts:red"]},
        exclusions: [],
        inclusions: [{conditions: ["shirts:red"], inclusions: ["shirts:black"]}],
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp).run(datastore);

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

test("updateCatalog returns error when there are multiple errors in the request", async (t) => {
    const catalogId = "catalog-2";
    const catalogAssembly = {
        families: {
            "shirts": ["blue"],
            "pants": ["blue"]
        },
        exclusions: [{conditions: ["red"], exclusions: ["blue"]}],
        inclusions: []
    };

    const req = rulesToRequest(catalogId, catalogAssembly);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const [result] = await updateCatalog(req, timestamp).run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Multiple invalid request parameters",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "families",
                        description: `Item 'blue' has multiple families: [shirts,pants]`
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

function rulesToRequest(catalogId: string, assembly: CatalogAssembly): CreateCatalogRequest {
    const families = Object.keys(assembly.families)
        .map(id => {
            const items = assembly.families[id];

            const family = new Family();
            family.setFamilyId(id);
            family.setItemsList(items);
            return family;
        });
    const exclusions = assembly.exclusions
        .map(({conditions, exclusions}) => {
            const exclusionRule = new CatalogExclusionsRule();
            exclusionRule.setConditionsList(conditions);
            exclusionRule.setExclusionsList(exclusions);
            return exclusionRule;
        });
    const inclusions = assembly.inclusions
        .map(({conditions, inclusions}) => {
            const inclusionRule = new CatalogInclusionsRule();
            inclusionRule.setConditionsList(conditions);
            inclusionRule.setInclusionsList(inclusions);
            return inclusionRule;
        });


    const req = new CreateCatalogRequest();
    req.setProjectId(projectId);
    req.setCatalogId(catalogId);
    req.setFamiliesList(families);
    req.setExclusionsList(exclusions);
    req.setInclusionsList(inclusions);
    return req;
}
