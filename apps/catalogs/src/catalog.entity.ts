import Datastore = require("@google-cloud/datastore");
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {CatalogToken} from "@ignition/wasm";

import {asks, Reader} from "fp-ts/lib/Reader";

export type CatalogEntity = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function buildCatalogEntity(catalogId: string, catalogToken: CatalogToken, timestamp: Date): Reader<Datastore, DatastorePayload<CatalogEntity>> {
    return asks((datastore) => ({
        key: datastore.key({path: ["Catalog", catalogId]}),
        excludeFromIndexes: ["token"],
        data: {
            id: catalogId,
            token: catalogToken,
            created: timestamp
        }
    }));
}
