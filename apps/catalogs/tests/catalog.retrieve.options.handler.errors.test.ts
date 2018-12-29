import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {Either, left} from "fp-ts/lib/Either";
import {status} from "grpc";

import {CatalogEntity} from "../src/catalog.entity";
import {retrieveCatalogOptions} from "../src/catalog.retrieve.options.handler";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {CatalogOptions, RetrieveCatalogOptionsRequest} from "../generated/catalogs_pb";
import {badRequestDetail, GrpcServiceError, preconditionFailureDetail, serviceError} from "../src/errors.pb";

const timestamp = new Date();

test("retrieveCatalogOptions returns error, when request is missing catalogId", async (t) => {
    const datastoreStub: Datastore = mock(Datastore);

    const req = new RetrieveCatalogOptionsRequest();

    const datastore = instance(datastoreStub);
    const result: Either<GrpcServiceError, CatalogOptions> = await retrieveCatalogOptions(req)
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
    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const req = new RetrieveCatalogOptionsRequest();
    req.setCatalogId(catalogId);
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const result: Either<GrpcServiceError, CatalogOptions> = await retrieveCatalogOptions(req)
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

test("retrieveCatalogOptions returns error, when catalog token is empty", async (t) => {
    const catalogId = "catalog-4";
    const selections = ["shirts:blue"];

    const entity: CatalogEntity = {
        id: catalogId,
        token: "",
        created: timestamp
    };

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const req = new RetrieveCatalogOptionsRequest();
    req.setCatalogId(catalogId);
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const result: Either<GrpcServiceError, CatalogOptions> = await retrieveCatalogOptions(req)
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "Malformed catalog token, catalog must be re-created",
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
    when(datastoreStub.key(deepEqual({path: ["Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([undefined]);

    const req = new RetrieveCatalogOptionsRequest();
    req.setCatalogId(catalogId);

    const datastore = instance(datastoreStub);
    const result: Either<GrpcServiceError, CatalogOptions> = await retrieveCatalogOptions(req)
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "No catalog found with id 'catalog-5'",
            status.NOT_FOUND)
    ));
});
