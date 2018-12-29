import Datastore = require("@google-cloud/datastore");
import {ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {CatalogToken} from "@ignition/wasm";

import {tryCatch} from "fp-ts/lib/TaskEither";

import {DatastoreError} from "./datastore.error";
import {CatalogEntity} from "./catalog.entity";

export type ListCatalogsError =
    { type: "Datastore", error: DatastoreError }

export type ListCatalogsResponse = {
    readonly catalogs: ListCatalogResponseItem[];
}

export type ListCatalogResponseItem = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;

}

export function listCatalogs(): ReaderTaskEither<Datastore, ListCatalogsError, ListCatalogsResponse> {
    return findCatalogs()
        .map(entities => ({catalogs: entities}));
}

function findCatalogs(): ReaderTaskEither<Datastore, ListCatalogsError, CatalogEntity[]> {
    return new ReaderTaskEither((datastore: Datastore) => {
            const query = datastore.createQuery("Catalog");

            return tryCatch(() => datastore.runQuery(query), (err: any) => err as DatastoreError)
                .mapLeft((err): ListCatalogsError => ({type: "Datastore", error: err}))
                .map(([entities]) => entities as CatalogEntity[]);
        }
    );
}