import {CatalogToken, findOptions as findOptionsInner, IgnitionOptionsError, Item, Options} from "@ignition/catalogs";
import {fromLeft as nomadFromLeft} from "@ignition/nomad";

import {findCatalog, FindCatalogError} from "./catalog.entity";
import {CatalogsResult} from "../infrastructure/result";

export type RetrieveCatalogOptionsError =
    { type: "MissingCatalogId" }
    | FindCatalogError
    | { type: "UnknownSelections", items: string[] }
    | { type: "BadToken", catalogId: string, token: string, detail: string }
    | { type: "BadUserToken", catalogId: string, token: string, detail: string }

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
    const errHandler = (err: IgnitionOptionsError): RetrieveCatalogOptionsError => {
        switch (err.type) {
            case "BadToken":
                return {...err, catalogId: catalogId};
            case "UnknownSelections":
                return err;
        }
    };

    return findCatalog(projectId, catalogId)
        .mapLeft(err => err as RetrieveCatalogOptionsError)
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

function findOptions(
    token: CatalogToken,
    selections: Item[],
    errHandler: (err: IgnitionOptionsError) => RetrieveCatalogOptionsError
): CatalogsResult<RetrieveCatalogOptionsError, [Options, CatalogToken]> {
    return findOptionsInner(token, selections)
        .mapLeft(errHandler)
        .toNomadRTE();
}
