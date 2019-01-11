import Datastore = require("@google-cloud/datastore");
import {fromLeft as nomadFromLeft, fromTaskEither} from "@ignition/nomad";
import {CatalogToken} from "@ignition/wasm";

import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";

import {DatastoreError} from "./datastore.error";
import {CatalogEntity} from "./catalog.entity";
import {timedRTE} from "./effects";
import {CatalogsResult} from "./result";

export type RetrieveCatalogError =
    { type: "Datastore", error: DatastoreError }
    | { type: "MissingCatalogId" }
    | { type: "CatalogNotFound", catalogId: string }

export type RetrieveCatalogResponse = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function retrieveCatalog(catalogId: string): CatalogsResult<RetrieveCatalogError, RetrieveCatalogResponse> {
    if (catalogId.length === 0) {
        return nomadFromLeft({type: "MissingCatalogId"} as RetrieveCatalogError);
    }

    return findCatalog(catalogId)
        .map(entity => ({id: entity.id, token: entity.token, created: entity.created}));
}

function findCatalog(catalogId: string): CatalogsResult<RetrieveCatalogError, CatalogEntity> {
    const notFoundError = fromLeft<RetrieveCatalogError, CatalogEntity>({
        type: "CatalogNotFound",
        catalogId: catalogId
    });

    return timedRTE(`retrieveCatalog: ${catalogId}`, (datastore: Datastore) => {
            const key = datastore.key({path: ["Catalog", catalogId]});

            return fromTaskEither(
                tryCatch(() => datastore.get(key), (err: any) => err as DatastoreError)
                    .mapLeft((err): RetrieveCatalogError => ({type: "Datastore", error: err}))
                    .chain(([entity]) => (entity ? taskEither.of(entity as CatalogEntity) : notFoundError))
            );
        }
    );
}
