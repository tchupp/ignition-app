import {
    buildCatalog,
    CatalogExclusionRule,
    CatalogFamilies,
    CatalogInclusionRule,
    CatalogState,
    CatalogToken,
    findOptions,
    Item
} from "@ignition/catalogs";

import {CatalogEntity} from "../src/functions/catalog.entity";

const EMPTY_CATALOG_TOKEN: CatalogToken = "";
const EMPTY_CATALOG_STATE: CatalogState = {
    token: EMPTY_CATALOG_TOKEN,
    selections: [],
    exclusions: []
};

export async function buildTestCatalogEntity(
    catalogId: string,
    created: Date,
    families: CatalogFamilies,
    exclusions: CatalogExclusionRule[] = [],
    inclusions: CatalogInclusionRule[] = []
): Promise<CatalogEntity> {
    const [catalogOrError] = await buildCatalog(families, exclusions, inclusions)
        .map(state => state.token)
        .run();

    return {
        id: catalogId,
        families,
        rules: {inclusions, exclusions},
        token: catalogOrError.getOrElse(EMPTY_CATALOG_TOKEN),
        created: created
    };
}

export async function buildTestCatalogToken(
    families: CatalogFamilies,
    selections: Item[] = [],
    exclusions: CatalogExclusionRule[] = [],
    inclusions: CatalogInclusionRule[] = []
): Promise<CatalogToken> {
    const catalogState = await buildCatalog(families, exclusions, inclusions)
        .fold(() => EMPTY_CATALOG_STATE, res => res)
        .run()
        .then(n => n.value);

    return await findOptions(catalogState, selections)
        .map(([_, state]) => state.token)
        .fold(() => EMPTY_CATALOG_TOKEN, token => token)
        .run()
        .then(n => n.value);
}
