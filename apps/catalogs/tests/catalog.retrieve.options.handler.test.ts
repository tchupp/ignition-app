import Datastore = require("@google-cloud/datastore");
import test from "ava";
import {deepEqual, instance, mock, when} from "ts-mockito";

import {right} from "fp-ts/lib/Either";

import {CatalogEntity} from "../src/functions/catalog.entity";
import {retrieveCatalogOptions} from "../src/functions/catalog.retrieve.options.handler";
import {buildTestCatalogEntity} from "./catalog.test-fixture";
import {CatalogOptions, ItemOption, RetrieveCatalogOptionsRequest} from "../generated/catalogs_pb";
import {defaultCatalogState, SerializedCatalogState} from "../src/functions/catalog.state";

const timestamp = new Date();
const projectId = "my-project";

type Scenario = {
    description: string
    catalogId: string
    selections: string[]
    exclusions: string[]
    expected: CatalogOptions.AsObject
};

const inputFamilies = {
    "shirts": ["shirts:red", "shirts:black"],
    "pants": ["pants:jeans", "pants:slacks"]
};

const pants_allAvailable = {
    familyId: "pants",
    optionsList: [
        {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:jeans"},
        {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "pants:slacks"},
    ]
};
const shirts_allAvailable = {
    familyId: "shirts",
    optionsList: [
        {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "shirts:black"},
        {"itemStatus": ItemOption.Status.AVAILABLE, "itemId": "shirts:red"},
    ]
};
const pants_slacksSelected = {
    familyId: "pants",
    optionsList: [
        {"itemStatus": ItemOption.Status.SELECTED, "itemId": "pants:slacks"},
        {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "pants:jeans"},
    ]
};
const shirts_redSelected = {
    familyId: "shirts",
    optionsList: [
        {"itemStatus": ItemOption.Status.SELECTED, "itemId": "shirts:red"},
        {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "shirts:black"},
    ]
};

const scenarios: Scenario[] = [
    {
        description: "retrieveCatalogOptions returns catalog options, when request contains valid catalog id",
        catalogId: "catalog-1",
        selections: [],
        exclusions: [],
        expected: {
            state: defaultCatalogState(projectId, "catalog-1"),
            optionsList: [
                pants_allAvailable,
                shirts_allAvailable
            ]
        }
    },
    {
        description: "retrieveCatalogOptions returns catalog options, when request contains an empty selection",
        catalogId: "catalog-2",
        selections: [" "],
        exclusions: [],
        expected: {
            state: defaultCatalogState(projectId, "catalog-2"),
            optionsList: [
                pants_allAvailable,
                shirts_allAvailable
            ]
        }
    },
    {
        description: "retrieveCatalogOptions returns catalog options, when request contains one selection",
        catalogId: "catalog-3",
        selections: [" shirts:red   "],
        exclusions: [],
        expected: {
            state: SerializedCatalogState({
                projectId: projectId,
                catalogId: "catalog-3",
                selections: ["shirts:red"],
                exclusions: []
            }),
            optionsList: [
                pants_allAvailable,
                shirts_redSelected
            ]
        }
    },
    {
        description: "retrieveCatalogOptions returns catalog options, when request contains an multiple selections",
        catalogId: "catalog-4",
        selections: ["shirts:red", "pants:slacks"],
        exclusions: [],
        expected: {
            state: SerializedCatalogState({
                projectId: projectId,
                catalogId: "catalog-4",
                selections: ["pants:slacks", "shirts:red"],
                exclusions: []
            }),
            optionsList: [
                pants_slacksSelected,
                shirts_redSelected
            ]
        }
    },
    {
        description: "retrieveCatalogOptions returns catalog options, when request contains an multiple selections as a string",
        catalogId: "catalog-5",
        selections: ["  shirts:red,  pants:slacks  "],
        exclusions: [],
        expected: {
            state: SerializedCatalogState({
                projectId: projectId,
                catalogId: "catalog-5",
                selections: ["pants:slacks", "shirts:red"],
                exclusions: []
            }),
            optionsList: [
                pants_slacksSelected,
                shirts_redSelected
            ]
        }
    },
    {
        description: "retrieveCatalogOptions returns all excluded, when request contains two selections in the same family",
        catalogId: "catalog-6",
        selections: ["shirts:red", "  shirts:black"],
        exclusions: [],
        expected: {
            state: SerializedCatalogState({
                projectId: projectId,
                catalogId: "catalog-6",
                selections: ["shirts:black", "shirts:red"],
                exclusions: []
            }),
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
                        {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "shirts:red"},
                        {"itemStatus": ItemOption.Status.EXCLUDED, "itemId": "shirts:black"},
                    ]
                }
            ]
        }
    },
];

scenarios.forEach(({description, catalogId, selections, exclusions, expected}) => {
    test(description, async (t) => {
        const entity: CatalogEntity = await buildTestCatalogEntity(
            projectId,
            catalogId,
            timestamp,
            inputFamilies
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
        req.setExclusionsList(exclusions);

        const datastore = instance(datastoreStub);
        const [result] = await retrieveCatalogOptions(req)
            .map(catalog => catalog.toObject())
            .run(datastore);

        t.deepEqual(result, right(expected));
    });
});

test("retrieveCatalogOptions returns catalog options, with updated catalogState, when request contains state and no new selections", async (t) => {
    const catalogId = "catalog-7";

    const entity: CatalogEntity = await buildTestCatalogEntity(
        projectId,
        catalogId,
        timestamp,
        inputFamilies
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
    req.setState(SerializedCatalogState({projectId, catalogId, selections: ["shirts:red"], exclusions: []}));

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .map(catalog => catalog.toObject())
        .run(datastore);

    const expectedState = SerializedCatalogState({
        projectId: projectId,
        catalogId: catalogId,
        selections: ["shirts:red"],
        exclusions: []
    });
    const expected = {
        state: expectedState,
        optionsList: [
            pants_allAvailable,
            shirts_redSelected
        ]
    };

    t.deepEqual(result, right(expected));
});

test("retrieveCatalogOptions returns catalog options, with updated catalogState, when request contains one new selection", async (t) => {
    const catalogId = "catalog-8";
    const selections = [" shirts:red   "];

    const entity: CatalogEntity = await buildTestCatalogEntity(
        projectId,
        catalogId,
        timestamp,
        inputFamilies
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
    req.setState(SerializedCatalogState({projectId, catalogId, selections: ["pants:slacks"], exclusions: []}));
    req.setSelectionsList(selections);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .map(catalog => catalog.toObject())
        .run(datastore);

    const expectedState = SerializedCatalogState({
        projectId: projectId,
        catalogId: catalogId,
        selections: ["pants:slacks", "shirts:red"],
        exclusions: []
    });
    const expected = {
        state: expectedState,
        optionsList: [
            pants_slacksSelected,
            shirts_redSelected
        ]
    };

    t.deepEqual(result, right(expected));
});

test("retrieveCatalogOptions returns default, when request contains bad token", async (t) => {
    const catalogId = "catalog-7";
    const catalogState = "MwAAAAAAAAAoMCA";

    const entity: CatalogEntity = await buildTestCatalogEntity(
        projectId,
        catalogId,
        timestamp,
        inputFamilies
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
    req.setState(catalogState);

    const datastore = instance(datastoreStub);
    const [result] = await retrieveCatalogOptions(req)
        .map(catalog => catalog.toObject())
        .run(datastore);

    const expected = {
        state: defaultCatalogState(projectId, catalogId),
        optionsList: [
            pants_allAvailable,
            shirts_allAvailable
        ]
    };

    t.deepEqual(result, right(expected));
});