import {DatastoreError} from "./datastore.error";
import {fromLeft as readerTaskEitherFromLeft, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {CatalogToken} from "@ignition/wasm";
import {CatalogEntity} from "./catalog.entity";
import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";
import Datastore = require("@google-cloud/datastore");

export type RetrieveCatalogError =
    { type: "Datastore", error: DatastoreError }
    | { type: "MissingCatalogId" }
    | { type: "CatalogNotFound", catalogId: string }

export type RetrieveCatalogResponse = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function retrieveCatalog(catalogId: string): ReaderTaskEither<Datastore, RetrieveCatalogError, RetrieveCatalogResponse> {
    if (catalogId.length === 0) {
        return readerTaskEitherFromLeft({type: "MissingCatalogId"} as RetrieveCatalogError);
    }

    return findCatalog(catalogId)
        .map(entity => ({id: entity.id, token: entity.token, created: entity.created}));
}

function findCatalog(catalogId: string): ReaderTaskEither<Datastore, RetrieveCatalogError, CatalogEntity> {
    const notFoundError = fromLeft<RetrieveCatalogError, CatalogEntity>({
        type: "CatalogNotFound",
        catalogId: catalogId
    });

    return new ReaderTaskEither((datastore: Datastore) => {
            const key = datastore.key({path: ["Catalog", catalogId]});

            return tryCatch(() => datastore.get(key), (err: any) => err as DatastoreError)
                .mapLeft((err): RetrieveCatalogError => ({type: "Datastore", error: err}))
                .chain(([entity]) => (entity ? taskEither.of(entity as CatalogEntity) : notFoundError));
        }
    );
}