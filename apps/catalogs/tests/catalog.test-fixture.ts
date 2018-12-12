import {buildCatalog, Catalog, CatalogContents} from "@ignition/wasm";

import {CatalogEntity} from "../src/catalog.entity";

const EMPTY_CATALOG: Catalog = "";

export async function buildTestCatalogEntity(
    timestamp: Date,
    families: CatalogContents,
    exclusions: CatalogContents = {},
    inclusions: CatalogContents = {}
): Promise<CatalogEntity> {
    let catalogOrError = await buildCatalog(families, exclusions, inclusions).run();

    return {
        serialized: catalogOrError.getOrElse(EMPTY_CATALOG),
        created: timestamp
    };
}
