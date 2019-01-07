import Datastore = require("@google-cloud/datastore");
import {ReaderTaskEither, tryCatch} from "fp-ts/lib/ReaderTaskEither";
import {CatalogToken} from "@ignition/wasm";

import {DatastoreError} from "./datastore.error";
import {ListCatalogResponseItem, ListCatalogsError} from "./catalog.list";

export type ListCatalogsError =
    { type: "Datastore", error: DatastoreError }

export type ListCatalogResponseItem = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function listCatalogs(): ReaderTaskEither<Datastore, ListCatalogsError, ListCatalogResponseItem[]> {
    return tryCatch(
        (datastore: Datastore) => datastore.runQuery(datastore.createQuery("Catalog")),
        (err: any) => err as DatastoreError
    )
        .mapLeft((err): ListCatalogsError => ({type: "Datastore", error: err}))
        .map(([entities]) => entities as ListCatalogResponseItem[]);
}
