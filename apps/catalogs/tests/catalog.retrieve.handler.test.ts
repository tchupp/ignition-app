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

type Scenario = {
    description: string
    catalogId: string
    selections: string[]
    expected: Catalog.AsObject
};

const scenarios: Scenario[] = [
    {
        description: "retrieveCatalog returns catalog options, when request contains valid catalog id",
        catalogId: "catalog-1",
        selections: [],
        expected: {
            catalogId: "catalog-1",
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
        }
    },
    {
        description: "retrieveCatalog returns catalog options, when request contains an empty selection",
        catalogId: "catalog-2",
        selections: [" "],
        expected: {
            catalogId: "catalog-2",
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
        }
    },
    {
        description: "retrieveCatalog returns catalog options, when there is one selection",
        catalogId: "catalog-3",
        selections: [" shirts:red   "],
        expected: {
            catalogId: "catalog-3",
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
        }
    },
    {
        description: "retrieveCatalog returns catalog options, when request contains an multiple selections",
        catalogId: "catalog-4",
        selections: ["shirts:red", "pants:slacks"],
        expected: {
            catalogId: "catalog-4",
            optionsList: [
                {
                    familyId: "pants",
                    optionsList: [
                        {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "pants:jeans"},
                        {"itemStatus": ItemOption.Status.SELECTED, "itemId": "pants:slacks"},
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
        }
    },
    {
        description: "retrieveCatalog returns catalog options, when request contains an multiple selections as a string",
        catalogId: "catalog-5",
        selections: ["  shirts:red,  pants:slacks  "],
        expected: {
            catalogId: "catalog-5",
            optionsList: [
                {
                    familyId: "pants",
                    optionsList: [
                        {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "pants:jeans"},
                        {"itemStatus": ItemOption.Status.SELECTED, "itemId": "pants:slacks"},
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
        }
    },
    {
        description: "retrieveCatalog returns all excluded, when request contains two selections in the same family",
        catalogId: "catalog-6",
        selections: ["shirts:red", "  shirts:black"],
        expected: {
            catalogId: "catalog-6",
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
        }
    },
];

scenarios.forEach(({description, catalogId, selections, expected}) => {
    test(description, async (t) => {
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

        t.deepEqual(result, right(expected));
    });
});
