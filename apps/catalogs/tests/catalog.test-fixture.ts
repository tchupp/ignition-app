import {
    buildCatalog,
    CatalogExclusionRule,
    CatalogFamilies,
    CatalogInclusionRule,
    CatalogToken,
    findOptions,
    Item
} from "@ignition/catalogs";

import {CatalogEntity} from "../src/functions/catalog.entity";

const EMPTY_CATALOG_TOKEN: CatalogToken = "";

export async function buildTestCatalogEntity(
    id: string,
    timestamp: Date,
    families: CatalogFamilies,
    exclusions: CatalogExclusionRule[] = [],
    inclusions: CatalogInclusionRule[] = []
): Promise<CatalogEntity> {
    const [catalogOrError] = await buildCatalog(families, exclusions, inclusions).run();

    return {
        id: id,
        token: catalogOrError.getOrElse(EMPTY_CATALOG_TOKEN),
        created: timestamp
    };
}

export async function buildTestCatalogToken(
    families: CatalogFamilies,
    selections: Item[] = [],
    exclusions: CatalogExclusionRule[] = [],
    inclusions: CatalogInclusionRule[] = []
): Promise<CatalogToken> {
    const token = await buildCatalog(families, exclusions, inclusions)
        .fold(() => EMPTY_CATALOG_TOKEN, res => res)
        .run()
        .then(n => n.value);

    return await findOptions(token, selections)
        .fold(() => EMPTY_CATALOG_TOKEN, ([_, token]) => token)
        .run()
        .then(n => n.value);
}
