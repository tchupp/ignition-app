import Datastore = require("@google-cloud/datastore");
import {DatastoreKey, DatastorePayload} from "@google-cloud/datastore/entity";

import {Catalog} from "@ignition/wasm";

import {asks, Reader} from "fp-ts/lib/Reader";

export interface CatalogEntity {
    serialized: Catalog;
    created: Date;
}

export function buildCatalogEntity(datastore: Datastore, timestamp: Date): (catalog: Catalog) => DatastorePayload<CatalogEntity> {
    return (catalog: Catalog) => ({
        key: datastore.key({path: ["Catalog"]}),
        excludeFromIndexes: ["serialized"],
        data: {
            serialized: catalog,
            created: timestamp
        }
    });
}

export function buildCatalogKey(catalogId: string): Reader<Datastore, DatastoreKey> {
    return asks(datastore => datastore.key({path: ["Catalog", catalogId]}));
}
