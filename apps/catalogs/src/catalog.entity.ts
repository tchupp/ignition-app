import Datastore = require("@google-cloud/datastore");
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {Catalog} from "@ignition/wasm";

import {asks, Reader} from "fp-ts/lib/Reader";

export interface CatalogEntity {
    readonly id: string;
    readonly serialized: Catalog;
    readonly created: Date;
}

export function buildCatalogEntity(catalogId: string, catalog: Catalog): Reader<[Datastore, Date], DatastorePayload<CatalogEntity>> {
    return asks(([datastore, timestamp]) => ({
        key: datastore.key({path: ["Catalog", catalogId]}),
        excludeFromIndexes: ["serialized"],
        data: {
            id: catalogId,
            serialized: catalog,
            created: timestamp
        }
    }));
}
