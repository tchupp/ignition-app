import Datastore = require("@google-cloud/datastore");
import {CatalogToken, findOptions as findOptionsInner, IgnitionOptionsError, Item, Options} from "@ignition/wasm";
import {fromLeft as nomadFromLeft, fromTaskEither} from "@ignition/nomad";

import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";

import {CatalogEntity} from "./catalog.entity";
import {DatastoreError} from "../infrastructure/datastore.error";
import {timed} from "../infrastructure/effects";
import {CatalogsResult} from "../infrastructure/result";

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
            return retrieveOptionsFromDatastore(catalogId, selections);
        default:
            return retrieveOptionsWithUserToken(catalogId, token, selections);
    }
}

function retrieveOptionsFromDatastore(catalogId: string, selections: Item[]) {
    const errHandler = (err: IgnitionOptionsError): RetrieveCatalogOptionsError => {
        switch (err.type) {
            case "BadToken":
                return {...err, catalogId: catalogId};
            case "UnknownSelections":
                return err;
        }
    };

    return retrieveCatalog(catalogId)
        .chain(entity => findOptions(entity.token, selections, errHandler))
        .map(([options, token]) => ({id: catalogId, options: options, token: token}));
}

function retrieveOptionsWithUserToken(catalogId: string, token: CatalogToken, selections: Item[]) {
    const errHandler = (err: IgnitionOptionsError): RetrieveCatalogOptionsError => {
        switch (err.type) {
            case "BadToken":
                return {...err, type: "BadUserToken", catalogId: catalogId};
            case "UnknownSelections":
                return err;
        }
    };

    return findOptions(token, selections, errHandler)
        .map(([options, token]) => ({id: catalogId, options: options, token: token}));
}

function retrieveCatalog(catalogId: string): CatalogsResult<RetrieveCatalogOptionsError, CatalogEntity> {
    const notFoundError = fromLeft<RetrieveCatalogOptionsError, CatalogEntity>({
        type: "CatalogNotFound",
        catalogId: catalogId
    });

    return timed(`retrieve_catalog`, {catalogId: catalogId}, (datastore: Datastore) => {
            const key = datastore.key({path: ["Catalog", catalogId]});

            return fromTaskEither(
                tryCatch(() => datastore.get(key), (err: any) => err as DatastoreError)
                    .mapLeft((err): RetrieveCatalogOptionsError => ({type: "Datastore", error: err}))
                    .chain(([entity]) => (entity ? taskEither.of(entity as CatalogEntity) : notFoundError))
            );
        }
    );
}

function findOptions(
    token: CatalogToken,
    selections: Item[],
    errHandler: (err: IgnitionOptionsError) => RetrieveCatalogOptionsError
): CatalogsResult<RetrieveCatalogOptionsError, [Options, CatalogToken]> {
    return findOptionsInner(token, selections)
        .mapLeft(errHandler)
        .toNomadRTE();
}
