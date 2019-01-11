import {buildCatalog, CatalogContents, CatalogToken, findOptions, Item} from "@ignition/wasm";

import {CatalogEntity} from "../src/catalog.entity";

const EMPTY_CATALOG_TOKEN: CatalogToken = "";

export async function buildTestCatalogEntity(
    id: string,
    timestamp: Date,
    families: CatalogContents,
    exclusions: CatalogContents = {},
    inclusions: CatalogContents = {}
): Promise<CatalogEntity> {
    const [catalogOrError] = await buildCatalog(families, exclusions, inclusions).run();

    return {
        id: id,
        token: catalogOrError.getOrElse(EMPTY_CATALOG_TOKEN),
        created: timestamp
    };
}

export async function buildTestCatalogToken(
    families: CatalogContents,
    selections: Item[] = [],
    exclusions: CatalogContents = {},
    inclusions: CatalogContents = {},
): Promise<CatalogToken> {
    const token = await buildCatalog(families, exclusions, inclusions)
        .fold(() => EMPTY_CATALOG_TOKEN, res => res)
        .value
        .run();

    return await findOptions(token, selections)
        .fold(() => EMPTY_CATALOG_TOKEN, ([_, token]) => token)
        .value
        .run();
}
