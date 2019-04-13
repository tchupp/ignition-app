import {
    CatalogOptionsError,
    CatalogState as FindOptionsParameters,
    CatalogToken,
    findOptions as findOptionsInner,
    Item,
    Options
} from "@ignition/catalogs";
import {fromLeft as nomadFromLeft} from "@ignition/nomad";

import {findCatalog, FindCatalogError} from "./catalog.entity";
import {CatalogsResult} from "../infrastructure/result";
import {CatalogState} from "./catalog.state";
import {Option} from "fp-ts/lib/Option";

export type RetrieveCatalogOptionsError =
    { type: "MissingProjectId" }
    | { type: "MissingCatalogId" }
    | FindCatalogError
    // CatalogOptionsErrors
    | { type: "UnknownSelections", items: Item[] }
    | { type: "UnknownExclusions", items: Item[] }
    | { type: "UnknownItems", selections: Item[], exclusions: Item[] }
    | { type: "BadState" }
    | { type: "BadToken", catalogId: string, token: CatalogToken, detail: string }

export type RetrieveCatalogOptionsResponse = {
    readonly options: Options;
    readonly catalogState: CatalogState;
}

export function retrieveCatalogOptions(
    projectId: string,
    catalogId: string,
    catalogState: Option<CatalogState>,
    selections: Item[],
    exclusions: Item[]
): CatalogsResult<RetrieveCatalogOptionsError, RetrieveCatalogOptionsResponse> {
    if (projectId.length === 0) {
        return nomadFromLeft({type: "MissingProjectId"} as RetrieveCatalogOptionsError);
    }
    if (catalogId.length === 0) {
        return nomadFromLeft({type: "MissingCatalogId"} as RetrieveCatalogOptionsError);
    }

    const previous = catalogState.getOrElseL(
        () => ({projectId, catalogId, selections: [], exclusions: []})
    );

    return retrieveOptionsFromDatastore(previous, selections, exclusions);
}

function retrieveOptionsFromDatastore(
    previous: CatalogState,
    newSelections: Item[],
    newExclusions: Item[]
): CatalogsResult<RetrieveCatalogOptionsError, RetrieveCatalogOptionsResponse> {
    const {projectId, catalogId, selections: oldSelections, exclusions: oldExclusions} = previous;

    return findCatalog(projectId, catalogId)
        .mapLeft(err => err as RetrieveCatalogOptionsError)
        .map(entity => ({token: entity.token, selections: oldSelections, exclusions: oldExclusions}) as FindOptionsParameters)
        .chain(params => findOptions(catalogId, params, newSelections, newExclusions))
        .map(([options, {selections, exclusions}]) =>
            [options, {...previous, selections, exclusions}] as [Options, CatalogState])
        .map(([options, catalogState]) => ({options, catalogState}));
}

function findOptions(
    catalogId: string,
    params: FindOptionsParameters,
    selections: Item[],
    exclusions: Item[]
): CatalogsResult<RetrieveCatalogOptionsError, [Options, FindOptionsParameters]> {
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

    return findOptionsInner(params, selections, exclusions)
        .mapLeft(errHandler)
        .toNomadRTE();
}
