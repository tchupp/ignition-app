import Datastore = require("@google-cloud/datastore");
import {QueryResult} from "@google-cloud/datastore/query";
import {fromTaskEither} from "@ignition/nomad";
import {CatalogToken} from "@ignition/wasm";

import {tryCatch} from "fp-ts/lib/TaskEither";

import {DatastoreError} from "../infrastructure/datastore.error";
import {ListCatalogResponseItem, ListCatalogsError} from "./catalog.list";
import {CatalogsEffect, timed} from "../infrastructure/effects";
import {CatalogsResult} from "../infrastructure/result";

export type ListCatalogsError =
    DatastoreError

export type ListCatalogResponseItem = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function listCatalogs(projectId: string): CatalogsResult<ListCatalogsError, ListCatalogResponseItem[]> {
    return timed("list_catalogs", {}, (datastore: Datastore) => {
            const projectKey = datastore.key({path: ["Project", projectId]});
            const query = datastore.createQuery("Catalog")
                .hasAncestor(projectKey);

            return fromTaskEither<CatalogsEffect, DatastoreError, QueryResult>(
                tryCatch(
                    () => datastore.runQuery(query),
                    (err: any) => DatastoreError(err)
                ))
                .map(([entities]) => entities as ListCatalogResponseItem[]);
        }
    );
}
