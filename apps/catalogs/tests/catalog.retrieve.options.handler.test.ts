import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {right} from "fp-ts/lib/Either";

import {CatalogEntity} from "../src/catalog.entity";
import {retrieveCatalogOptions} from "../src/catalog.retrieve.options.handler";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {CatalogOptions, ItemOption, RetrieveCatalogOptionsRequest} from "../generated/catalogs_pb";
import {buildCatalog} from "@ignition/wasm";

const timestamp = new Date();

type Scenario = {
    description: string
    catalogId: string
    selections: string[]
    expected: CatalogOptions.AsObject
};

const scenarios: Scenario[] = [
    {
        description: "retrieveCatalogOptions returns catalog options, when request contains valid catalog id",
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
        description: "retrieveCatalogOptions returns catalog options, when request contains an empty selection",
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
        description: "retrieveCatalogOptions returns catalog options, when request contains one selection",
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
        description: "retrieveCatalogOptions returns catalog options, when request contains an multiple selections",
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
        description: "retrieveCatalogOptions returns catalog options, when request contains an multiple selections as a string",
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
        description: "retrieveCatalogOptions returns all excluded, when request contains two selections in the same family",
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
        const result = await retrieveCatalogOptions(req)
            .map(catalog => catalog.toObject())
            .run(datastore);

        t.deepEqual(result, right(expected));
    });
});

test("retrieveCatalogOptions returns catalog options, when request contains token and no selections", async (t) => {
    const catalogId = "catalog-7";
    const token = await buildCatalog({
        "shirts": ["shirts:red", "shirts:black"],
        "pants": ["pants:jeans", "pants:slacks"]
    }).run();

    const req = new RetrieveCatalogOptionsRequest();
    req.setCatalogId(catalogId);
    req.setToken(token.getOrElse(""));

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const result = await retrieveCatalogOptions(req)
        .map(catalog => catalog.toObject())
        .run(datastore);

    const expected = {
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

test("retrieveCatalogOptions returns catalog options, when request contains one selection", async (t) => {
    const catalogId = "catalog-8";
    const selections = [" shirts:red   "];
    const token = await buildCatalog({
        "shirts": ["shirts:red", "shirts:black"],
        "pants": ["pants:jeans", "pants:slacks"]
    }).run();

    const req = new RetrieveCatalogOptionsRequest();
    req.setCatalogId(catalogId);
    req.setToken(token.getOrElse(""));
    req.setSelectionsList(selections);

    const datastoreStub: Datastore = mock(Datastore);
    const datastore = instance(datastoreStub);
    const result = await retrieveCatalogOptions(req)
        .map(catalog => catalog.toObject())
        .run(datastore);

    const expected = {
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
