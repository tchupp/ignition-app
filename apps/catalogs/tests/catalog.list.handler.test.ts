import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {right} from "fp-ts/lib/Either";

import {CatalogEntity} from "../src/functions/catalog.entity";
import {listCatalogs} from "../src/functions/catalog.list.handler";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {ListCatalogsRequest} from "../generated/catalogs_pb";
import {defaultCatalogState} from "../src/functions/catalog.state";

const timestamp = new Date();
const projectId = "my-project";

test("listCatalogs returns multiple catalogs", async (t) => {
    const catalogId1 = "catalog-1";
    const entity1: CatalogEntity = await buildTestCatalogEntity(
        projectId,
        catalogId1,
        timestamp,
        {
            "shirts": ["shirts:red", "shirts:black"],
            "pants": ["pants:jeans", "pants:slacks"]
        }
    );
    const catalogId2 = "catalog-2";
    const entity2: CatalogEntity = await buildTestCatalogEntity(
        projectId,
        catalogId2,
        timestamp,
        {
            "shirts": ["shirts:green", "shirts:yellow"],
            "pants": ["pants:black", "pants:slacks"]
        }
    );

    const projectKey = {
        name: projectId,
        kind: "Project",
        path: ["Project", projectId]
    };

    const queryStub = mock(Datastore.Query);
    const query = instance(queryStub);

    when(queryStub.hasAncestor(projectKey)).thenReturn(query);

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Project", projectId]}))).thenReturn(projectKey);

    when(datastoreStub.createQuery("Catalog")).thenReturn(query);
    when(datastoreStub.runQuery(query)).thenResolve([[entity1, entity2], {moreResults: 'NO_MORE_RESULTS'}]);

    const req = new ListCatalogsRequest();
    req.setProjectId(projectId);

    const datastore = instance(datastoreStub);
    const [result] = await listCatalogs(req)
        .map(catalogs => catalogs.getCatalogsList().map(c => c.toObject()))
        .run(datastore);

    t.deepEqual(result, right([
        {
            projectId: projectId,
            catalogId: catalogId1,
            created: timestamp.toISOString(),
            defaultState: defaultCatalogState(projectId, catalogId1),
            familiesList: [
                {
                    familyId: "shirts",
                    itemsList: ["shirts:red", "shirts:black"]
                },
                {
                    familyId: "pants",
                    itemsList: ["pants:jeans", "pants:slacks"]
                }
            ],
            exclusionRulesList: [],
            inclusionRulesList: [],
        },
        {
            projectId: projectId,
            catalogId: catalogId2,
            created: timestamp.toISOString(),
            defaultState: defaultCatalogState(projectId, catalogId2),
            familiesList: [
                {
                    familyId: "shirts",
                    itemsList: ["shirts:green", "shirts:yellow"]
                },
                {
                    familyId: "pants",
                    itemsList: ["pants:black", "pants:slacks"]
                }
            ],
            exclusionRulesList: [],
            inclusionRulesList: [],
        }
    ]));
});

test("listCatalogs returns empty list when there are catalogs", async (t) => {
    const projectKey = {
        name: projectId,
        kind: "Project",
        path: ["Project", projectId]
    };

    const queryStub = mock(Datastore.Query);
    const query = instance(queryStub);

    when(queryStub.hasAncestor(projectKey)).thenReturn(query);

    const datastoreStub: Datastore = mock(Datastore);
    when(datastoreStub.key(deepEqual({path: ["Project", projectId]}))).thenReturn(projectKey);

    when(datastoreStub.createQuery("Catalog")).thenReturn(query);
    when(datastoreStub.runQuery(query)).thenResolve([[], {moreResults: 'NO_MORE_RESULTS'}]);

    const req = new ListCatalogsRequest();
    req.setProjectId(projectId);

    const datastore = instance(datastoreStub);
    const [result] = await listCatalogs(req)
        .map(catalogs => catalogs.getCatalogsList().map(c => c.toObject()))
        .run(datastore);

    t.deepEqual(result, right([]));
});
