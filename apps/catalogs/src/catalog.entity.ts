import Datastore = require("@google-cloud/datastore");
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {CatalogToken} from "@ignition/wasm";

import {asks, Reader} from "fp-ts/lib/Reader";

export type CatalogEntity = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function buildCatalogEntity(catalogId: string, catalogToken: CatalogToken): Reader<[Datastore, Date], DatastorePayload<CatalogEntity>> {
    return asks(([datastore, timestamp]) => ({
        key: datastore.key({path: ["Catalog", catalogId]}),
        excludeFromIndexes: ["token"],
        data: {
            id: catalogId,
            token: catalogToken,
            created: timestamp
        }
    }));
}
