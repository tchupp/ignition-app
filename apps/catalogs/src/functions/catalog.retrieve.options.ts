import {CatalogOptionsError, CatalogToken, findOptions as findOptionsInner, Item, Options} from "@ignition/catalogs";
import {fromLeft as nomadFromLeft} from "@ignition/nomad";

import {findCatalog, FindCatalogError} from "./catalog.entity";
import {CatalogsResult} from "../infrastructure/result";

export type RetrieveCatalogOptionsError =
    { type: "MissingCatalogId" }
    | FindCatalogError
    // CatalogOptionsErrors
    | { type: "UnknownSelections", items: Item[] }
    | { type: "UnknownExclusions", items: Item[] }
    | { type: "UnknownItems", selections: Item[], exclusions: Item[] }
    | { type: "BadState" }
    | { type: "BadToken", catalogId: string, token: CatalogToken, detail: string }
    | { type: "BadUserToken", catalogId: string, token: CatalogToken, detail: string }

export type RetrieveCatalogOptionsResponse = {
    readonly id: string;
    readonly options: Options;
    readonly token: string;
}

export function retrieveCatalogOptions(projectId: string, catalogId: string, token: CatalogToken, selections: Item[]): CatalogsResult<RetrieveCatalogOptionsError, RetrieveCatalogOptionsResponse> {
    if (catalogId.length === 0) {
        return nomadFromLeft({type: "MissingCatalogId"} as RetrieveCatalogOptionsError);
    }

    switch (token.length) {
        case 0:
            return retrieveOptionsFromDatastore(projectId, catalogId, selections);
        default:
            return retrieveOptionsWithUserToken(catalogId, token, selections);
    }
}

function retrieveOptionsFromDatastore(projectId: string, catalogId: string, selections: Item[]) {
    const errHandler = (err: CatalogOptionsError): RetrieveCatalogOptionsError => {
        switch (err.type) {
            case "BadToken":
                return {...err, catalogId: catalogId};
            case "UnknownSelections":
            case "UnknownExclusions":
            case "UnknownItems":
            case "BadState":
                return err;
        }
    };

    return findCatalog(projectId, catalogId)
        .mapLeft(err => err as RetrieveCatalogOptionsError)
        .chain(entity => findOptions(entity.token, selections, errHandler))
        .map(([options, token]) => ({id: catalogId, options: options, token: token}));
}

function retrieveOptionsWithUserToken(catalogId: string, token: CatalogToken, selections: Item[]) {
    const errHandler = (err: CatalogOptionsError): RetrieveCatalogOptionsError => {
        switch (err.type) {
            case "BadToken":
                return {...err, type: "BadUserToken", catalogId: catalogId};
            case "UnknownSelections":
            case "UnknownExclusions":
            case "UnknownItems":
            case "BadState":
                return err;
        }
    };

    return findOptions(token, selections, errHandler)
        .map(([options, token]) => ({id: catalogId, options: options, token: token}));
}

function findOptions(
    token: CatalogToken,
    selections: Item[],
    errHandler: (err: CatalogOptionsError) => RetrieveCatalogOptionsError
): CatalogsResult<RetrieveCatalogOptionsError, [Options, CatalogToken]> {
    const state = {token: token, selections: [], exclusions: []};
    return findOptionsInner(state, selections)
        .mapLeft(errHandler)
        .toNomadRTE()
        .map(([options, state]) => [options, state.token] as [Options, CatalogToken]);
}
