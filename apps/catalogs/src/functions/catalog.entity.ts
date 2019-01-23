import Datastore = require("@google-cloud/datastore");
import {DatastorePayload} from "@google-cloud/datastore/entity";
import {CatalogContents, CatalogToken} from "@ignition/wasm";

import {asks, Reader} from "fp-ts/lib/Reader";

import {DatastoreError, DatastoreErrorCode} from "../infrastructure/datastore.error";

export type CatalogRules = {
    readonly id: string;
    readonly families: CatalogContents;
    readonly exclusions: CatalogContents;
    readonly inclusions: CatalogContents;
}

export type CatalogEntity = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function buildCatalogEntity(catalogId: string, catalogToken: CatalogToken, timestamp: Date): Reader<Datastore, DatastorePayload<CatalogEntity>> {
    return asks(datastore => ({
        key: datastore.key({path: ["Catalog", catalogId]}),
        excludeFromIndexes: ["token"],
        data: {
            id: catalogId,
            token: catalogToken,
            created: timestamp
        }
    }));
}

export type SaveCatalogError =
    { type: "Datastore", error: DatastoreError }
    | { type: "MissingFamilies" }
    | { type: "CatalogAlreadyExists", catalogId: string }

export function fromDatastoreError(err: DatastoreError, entity: CatalogEntity): SaveCatalogError {
    if (err.code === DatastoreErrorCode.ALREADY_EXISTS) {
        return {type: "CatalogAlreadyExists", catalogId: entity.id};
    }
    return {type: "Datastore", error: err};
}
