import {fromLeft as nomadFromLeft} from "@ignition/nomad";
import {CatalogToken} from "@ignition/wasm";
import {findCatalog, FindCatalogError} from "./catalog.entity";
import {CatalogsResult} from "../infrastructure/result";

export type RetrieveCatalogError =
    { type: "MissingCatalogId" }
    | FindCatalogError

export type RetrieveCatalogResponse = {
    readonly id: string;
    readonly token: CatalogToken;
    readonly created: Date;
}

export function retrieveCatalog(projectId: string, catalogId: string): CatalogsResult<RetrieveCatalogError, RetrieveCatalogResponse> {
    if (catalogId.length === 0) {
        return nomadFromLeft({type: "MissingCatalogId"} as RetrieveCatalogError);
    }

    return findCatalog(projectId, catalogId)
        .map(entity => ({id: entity.id, token: entity.token, created: entity.created}));
}

