import {buildCatalog, CatalogToken, CatalogContents} from "@ignition/wasm";

import {CatalogEntity} from "../src/catalog.entity";

const EMPTY_CATALOG_TOKEN: CatalogToken = "";

export async function buildTestCatalogEntity(
    id: string,
    timestamp: Date,
    families: CatalogContents,
    exclusions: CatalogContents = {},
    inclusions: CatalogContents = {}
): Promise<CatalogEntity> {
    const catalogOrError = await buildCatalog(families, exclusions, inclusions).run();

    return {
        id: id,
        token: catalogOrError.getOrElse(EMPTY_CATALOG_TOKEN),
        created: timestamp
    };
}
