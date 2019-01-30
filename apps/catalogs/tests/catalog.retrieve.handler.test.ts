import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {left, right} from "fp-ts/lib/Either";

import {CatalogEntity} from "../src/functions/catalog.entity";
import {retrieveCatalog} from "../src/functions/catalog.retrieve.handler";
import {badRequestDetail, serviceError} from "../src/infrastructure/errors.pb";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {RetrieveCatalogRequest} from "../generated/catalogs_pb";
import {status} from "grpc";

const timestamp = new Date();
const projectId = "my-project";

test("retrieveCatalog returns catalog with correct token, when catalog exists", async (t) => {
    const catalogId = "catalog-1";
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
    when(datastoreStub.key(deepEqual({path: ["Project", projectId, "Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([entity]);

    const req = new RetrieveCatalogRequest();
    req.setProjectId(projectId);
    req.setCatalogId(catalogId);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalog(req)
        .map(catalog => catalog.toObject())
        .run(datastore);

    t.deepEqual(result, right({
        catalogId: catalogId,
        projectId: "",
        token: entity.token,
        created: timestamp.toISOString(),
    }));
});

test("retrieveCatalog returns error, when catalog does not exist", async (t) => {
    const catalogId = "catalog-5";

    const catalogKey = {
        name: catalogId,
        kind: "Catalog",
        path: ["Catalog", catalogId]
    };

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Project", projectId, "Catalog", catalogId]}))).thenReturn(catalogKey);
    when(datastoreStub.get(deepEqual(catalogKey))).thenResolve([undefined]);

    const req = new RetrieveCatalogRequest();
    req.setProjectId(projectId);
    req.setCatalogId(catalogId);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalog(req)
        .map(catalog => catalog.toObject())
        .run(datastore);

    t.deepEqual(result, left(
        serviceError(
            "No catalog found with id 'catalog-5'",
            status.NOT_FOUND)
    ));
});

test("retrieveCatalog returns error, when request is missing catalogId", async (t) => {
    const datastoreStub: Datastore = mock(Datastore);

    const req = new RetrieveCatalogRequest();

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalog(req)
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
