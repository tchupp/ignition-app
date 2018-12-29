import Datastore = require("@google-cloud/datastore");
import {CatalogToken, findOptions as findOptionsInner, Item, Options} from "@ignition/wasm";

import {fromLeft as readerTaskEitherFromLeft, fromTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";

import {CatalogEntity} from "./catalog.entity";
import {DatastoreError} from "./datastore.error";

export type RetrieveCatalogOptionsError =
    { type: "Datastore", error: DatastoreError }
    | { type: "MissingCatalogId" }
    | { type: "CatalogNotFound", catalogId: string }
    // Ignition options errors
    | { type: "UnknownSelections", items: string[] }
    | { type: "BadToken", catalogId: string, token: string, detail: string }

export type RetrieveCatalogOptionsResponse = {
    readonly id: string;
    readonly options: Options;
}

export function retrieveCatalogOptions(catalogId: string, selections: Item[]): ReaderTaskEither<Datastore, RetrieveCatalogOptionsError, RetrieveCatalogOptionsResponse> {
    if (catalogId.length === 0) {
        return readerTaskEitherFromLeft({type: "MissingCatalogId"} as RetrieveCatalogOptionsError);
    }

    return findCatalog(catalogId)
        .chain(entity => findOptions(entity.token, catalogId, selections))
        .map(options => ({id: catalogId, options: options}));
}

function findCatalog(catalogId: string): ReaderTaskEither<Datastore, RetrieveCatalogOptionsError, CatalogEntity> {
    const notFoundError = fromLeft<RetrieveCatalogOptionsError, CatalogEntity>({
        type: "CatalogNotFound",
        catalogId: catalogId
    });

    return new ReaderTaskEither((datastore: Datastore) => {
            const key = datastore.key({path: ["Catalog", catalogId]});

            return tryCatch(() => datastore.get(key), (err: any) => err as DatastoreError)
                .mapLeft((err): RetrieveCatalogOptionsError => ({type: "Datastore", error: err}))
                .chain(([entity]) => (entity ? taskEither.of(entity as CatalogEntity) : notFoundError));
        }
    );
}

function findOptions<Ctx>(
    token: CatalogToken,
    catalogId: string,
    selections: Item[]
): ReaderTaskEither<Ctx, RetrieveCatalogOptionsError, Options> {
    return fromTaskEither(
        findOptionsInner(token, selections)
            .mapLeft((err): RetrieveCatalogOptionsError => {
                switch (err.type) {
                    case "BadToken":
                        return {...err, catalogId: catalogId};
                    case "UnknownSelections":
                        return err;
                }
            })
    );
}
