import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {left} from "fp-ts/lib/Either";
import {status} from "grpc";

import {CatalogEntity} from "../src/functions/catalog.entity";
import {retrieveCatalogOptions} from "../src/functions/catalog.retrieve.options.handler";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {RetrieveCatalogOptionsRequest} from "../generated/catalogs_pb";
import {badRequestDetail, preconditionFailureDetail, serviceError} from "../src/infrastructure/errors.pb";

const timestamp = new Date();
const projectId = "my-project";

test("retrieveCatalogOptions returns error, when request is missing projectId", async (t) => {
    const datastoreStub: Datastore = mock(Datastore);

    const req = new RetrieveCatalogOptionsRequest();
    req.setCatalogId("catalog-19");

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Missing ProjectId",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "project_id",
                        description: "Project Id is required"
                    }]
                })
            ])
    ));
});

test("retrieveCatalogOptions returns error, when request is missing catalogId", async (t) => {
    const datastoreStub: Datastore = mock(Datastore);

    const req = new RetrieveCatalogOptionsRequest();
    req.setProjectId(projectId);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Missing CatalogId",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "catalog_id",
                        description: "Catalog Id is required"
                    }]
                })
            ])
    ));
});

test("retrieveCatalogOptions returns error, when request contains unknown selection", async (t) => {
    const catalogId = "catalog-4";
    const selections = ["shirts:blue"];

    const entity: CatalogEntity = await buildTestCatalogEntity(
        projectId,
        catalogId,
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Project", projectId, "Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const req = new RetrieveCatalogOptionsRequest();
    req.setProjectId(projectId);
    req.setCatalogId(catalogId);
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Unknown Selections",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "selections",
                        description: `Selected items are unknown: [shirts:blue]`
                    }]
                })
            ])
    ));
});

test("retrieveCatalogOptions returns error, when datastore has an empty catalog token", async (t) => {
    const catalogId = "catalog-4";
    const selections = ["shirts:blue"];

    const entity: CatalogEntity = {
        projectId: projectId,
        catalogId: catalogId,
        families: {},
        rules: {inclusions: [], exclusions: []},
        token: "",
        created: timestamp
    };

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Project", projectId, "Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const req = new RetrieveCatalogOptionsRequest();
    req.setProjectId(projectId);
    req.setCatalogId(catalogId);
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Malformed catalog, catalog must be re-created",
            status.FAILED_PRECONDITION,
            [
                preconditionFailureDetail({
                    violationsList: [{
                        type: "CatalogToken",
                        subject: catalogId,
                        description: "Catalog token is malformed",
                    }]
                })
            ])
    ));
});

test("retrieveCatalogOptions returns error, when catalog does not exist", async (t) => {
    const catalogId = "catalog-5";

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Project", projectId, "Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([undefined]);

    const req = new RetrieveCatalogOptionsRequest();
    req.setProjectId(projectId);
    req.setCatalogId(catalogId);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "No catalog found with id 'catalog-5'",
            status.NOT_FOUND)
    ));
});
