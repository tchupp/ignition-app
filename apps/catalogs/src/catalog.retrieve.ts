import Datastore = require("@google-cloud/datastore");
import {findOptions as findOptionsInner, IgnitionOptionsError, Item, Options} from "@ignition/wasm";

import {fromTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";

import {CatalogEntity} from "./catalog.entity";
import {DatastoreError} from "./datastore.error";
import {RetrieveCatalogError} from "./catalog.retrieve";

export type RetrieveCatalogError =
    { type: "Datastore", error: DatastoreError }
    | { type: "RequestMissingCatalogId", error: string }
    | { type: "CatalogNotFound", error: string }
    | { type: "Ignition", error: IgnitionOptionsError }

export interface RetrieveCatalogResponse {
    readonly id: string;
    readonly options: Options;
}

export function retrieveCatalog(catalogId: string, selections: Item[]): ReaderTaskEither<Datastore, RetrieveCatalogError, RetrieveCatalogResponse> {
    return findCatalog(catalogId)
        .chain(entity => findOptions(entity, selections))
        .map(options => ({id: catalogId, options: options}));
}

function findCatalog(catalogId: string): ReaderTaskEither<Datastore, RetrieveCatalogError, CatalogEntity> {
    const notFoundError = fromLeft<RetrieveCatalogError, CatalogEntity>({
        type: "CatalogNotFound",
        error: `No catalog found with id '${catalogId}'`
    });

    return new ReaderTaskEither(datastore => {
            const query = datastore
                .createQuery("Catalog")
                .filter("id", catalogId)
                .limit(1);

            return tryCatch(() => datastore.runQuery(query), (err: any) => err as DatastoreError)
                .mapLeft((err): RetrieveCatalogError => ({type: "Datastore", error: err}))
                .chain(([entities]) => entities.length > 0 ? taskEither.of(entities[0] as CatalogEntity) : notFoundError);
        }
    );
}

function findOptions(
    entity: CatalogEntity,
    selections: Item[]
): ReaderTaskEither<Datastore, RetrieveCatalogError, Options> {
    return fromTaskEither(
        findOptionsInner(entity.serialized, selections)
            .mapLeft((err): RetrieveCatalogError => ({type: "Ignition", error: err}))
    );
}
