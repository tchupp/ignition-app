import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {instance, mock, when} from "ts-mockito";

import {Either, left} from "fp-ts/lib/Either";
import {status} from "grpc";

import {CatalogEntity} from "../src/catalog.entity";
import {retrieveCatalog} from "../src/catalog.retrieve.handler";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {Catalog, RetrieveCatalogRequest} from "../generated/catalogs_pb";
import {badRequestDetail, GrpcServiceError, serviceError} from "../src/errors.pb";

const timestamp = new Date();

test("retrieveCatalog returns error, when request is missing catalogId", async (t) => {
    const datastoreStub: Datastore = mock(Datastore);

    const req = new RetrieveCatalogRequest();

    const datastore = instance(datastoreStub);
    const result: Either<GrpcServiceError, Catalog> = await retrieveCatalog(req, datastore)
        .toPromise();

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

    const req = new RetrieveCatalogRequest();
    req.setCatalogId(catalogId);
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const result: Either<GrpcServiceError, Catalog> = await retrieveCatalog(req, datastore)
        .toPromise();

    t.deepEqual(result, left(
        serviceError(
            "UnknownItems",
            status.INVALID_ARGUMENT,
            [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "selections",
                        description: "Selected items are unknown: [\"shirts:blue\"]"
                    }]
                })
            ])
    ));
});

test("retrieveCatalog returns error, when catalog does not exist", async (t) => {
    const catalogId = "catalog-5";

    const queryStub = mock(Datastore.Query);
    const query = instance(queryStub);

    when(queryStub.filter("id", catalogId)).thenReturn(query);
    when(queryStub.limit(1)).thenReturn(query);

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.createQuery("Catalog")).thenReturn(query);
    when(datastoreStub.runQuery(query)).thenResolve([[], {moreResults: 'NO_MORE_RESULTS'}]);

    const req = new RetrieveCatalogRequest();
    req.setCatalogId(catalogId);

    const datastore = instance(datastoreStub);
    const result: Either<GrpcServiceError, Catalog> = await retrieveCatalog(req, datastore)
        .toPromise();

    t.deepEqual(result, left(
        serviceError(
            "No catalog found with id 'catalog-5'",
            status.NOT_FOUND)
    ));
});
