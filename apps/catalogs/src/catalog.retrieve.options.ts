import Datastore = require("@google-cloud/datastore");
import {CatalogToken, findOptions as findOptionsInner, Item, Options} from "@ignition/wasm";
import {fromLeft as nomadFromLeft, fromTaskEither, NomadRTE} from "@ignition/nomad";

import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";

import {CatalogEntity} from "./catalog.entity";
import {DatastoreError} from "./datastore.error";
import {CatalogsEffect, timedRTE} from "./effects";
import {CatalogsResult} from "./result";

export type RetrieveCatalogOptionsError =
    { type: "Datastore", error: DatastoreError }
    | { type: "MissingCatalogId" }
    | { type: "CatalogNotFound", catalogId: string }
    // Ignition options errors
    | { type: "UnknownSelections", items: string[] }
    | { type: "BadToken", catalogId: string, token: string, detail: string }
    | { type: "BadUserToken", catalogId: string, token: string, detail: string }

export type RetrieveCatalogOptionsResponse = {
    readonly id: string;
    readonly options: Options;
    readonly token: string;
}

export function retrieveCatalogOptions(catalogId: string, token: CatalogToken, selections: Item[]): CatalogsResult<RetrieveCatalogOptionsError, RetrieveCatalogOptionsResponse> {
    if (catalogId.length === 0) {
        return nomadFromLeft({type: "MissingCatalogId"} as RetrieveCatalogOptionsError);
    }

    switch (token.length) {
        case 0:
            return retrieveCatalog(catalogId)
                .chain(entity => findOptions(entity.token, catalogId, selections))
                .map(([options, token]) => ({id: catalogId, options: options, token: token}));

        default:
            return findOptions2<Datastore>(token, catalogId, selections)
                .map(([options, token]) => ({id: catalogId, options: options, token: token}));
    }
}

function retrieveCatalog(catalogId: string): CatalogsResult<RetrieveCatalogOptionsError, CatalogEntity> {
    const notFoundError = fromLeft<RetrieveCatalogOptionsError, CatalogEntity>({
        type: "CatalogNotFound",
        catalogId: catalogId
    });

    return timedRTE(`retrieveCatalog: ${catalogId}`, (datastore: Datastore) => {
            const key = datastore.key({path: ["Catalog", catalogId]});

            return fromTaskEither(
                tryCatch(() => datastore.get(key), (err: any) => err as DatastoreError)
                    .mapLeft((err): RetrieveCatalogOptionsError => ({type: "Datastore", error: err}))
                    .chain(([entity]) => (entity ? taskEither.of(entity as CatalogEntity) : notFoundError))
            );
        }
    );
}

function findOptions<Ctx>(
    token: CatalogToken,
    catalogId: string,
    selections: Item[]
): NomadRTE<Ctx, CatalogsEffect, RetrieveCatalogOptionsError, [Options, CatalogToken]> {
    return findOptionsInner(token, selections)
        .mapLeft((err): RetrieveCatalogOptionsError => {
            switch (err.type) {
                case "BadToken":
                    return {...err, catalogId: catalogId};
                case "UnknownSelections":
                    return err;
            }
        })
        .toNomadRTE();
}

function findOptions2<Ctx>(
    token: CatalogToken,
    catalogId: string,
    selections: Item[]
): NomadRTE<Ctx, CatalogsEffect, RetrieveCatalogOptionsError, [Options, CatalogToken]> {
    return findOptionsInner(token, selections)
        .mapLeft((err): RetrieveCatalogOptionsError => {
            switch (err.type) {
                case "BadToken":
                    return {...err, type: "BadUserToken", catalogId: catalogId};
                case "UnknownSelections":
                    return err;
            }
        })
        .toNomadRTE();
}