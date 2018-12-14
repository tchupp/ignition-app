import Datastore = require("@google-cloud/datastore");
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {Catalog} from "@ignition/wasm";

import {asks, Reader} from "fp-ts/lib/Reader";

export interface CatalogEntity {
    id: string;
    serialized: Catalog;
    created: Date;
}

export function buildCatalogEntity(catalogId: string, catalog: Catalog): Reader<[Datastore, Date], DatastorePayload<CatalogEntity>> {
    return asks(([datastore, timestamp]) => ({
        key: datastore.key({path: ["Catalog"]}),
        excludeFromIndexes: ["serialized"],
        data: {
            id: catalogId,
            serialized: catalog,
            created: timestamp
        }
    }));
}
