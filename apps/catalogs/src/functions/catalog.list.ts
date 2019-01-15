import Datastore = require("@google-cloud/datastore");
import {QueryResult} from "@google-cloud/datastore/query";
import {fromTaskEither, NomadRTE} from "@ignition/nomad";
import {CatalogToken} from "@ignition/wasm";

import {tryCatch} from "fp-ts/lib/TaskEither";

import {DatastoreError} from "../infrastructure/datastore.error";
import {ListCatalogResponseItem, ListCatalogsError} from "./catalog.list";
import {CatalogsEffect} from "../infrastructure/effects";
import {CatalogsResult} from "../infrastructure/result";

export type ListCatalogsError =
    { type: "Datastore", error: DatastoreError }

export type ListCatalogResponseItem = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function listCatalogs(): CatalogsResult<ListCatalogsError, ListCatalogResponseItem[]> {
    return new NomadRTE((datastore: Datastore) => {
            const query = datastore.createQuery("Catalog");

            return fromTaskEither<CatalogsEffect, DatastoreError, QueryResult>(
                tryCatch(
                    () => datastore.runQuery(query),
                    (err: any) => err as DatastoreError
                ))
                .mapLeft((err): ListCatalogsError => ({type: "Datastore", error: err}))
                .map(([entities]) => entities as ListCatalogResponseItem[]);
        }
    );
}
