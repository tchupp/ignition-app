import {fromLeft as nomadFromLeft} from "@ignition/nomad";
import {CatalogEntity, findCatalog, FindCatalogError} from "./catalog.entity";
import {CatalogsResult} from "../infrastructure/result";

export type RetrieveCatalogError =
    { type: "MissingProjectId" }
    | { type: "MissingCatalogId" }
    | FindCatalogError

export function retrieveCatalog(projectId: string, catalogId: string): CatalogsResult<RetrieveCatalogError, CatalogEntity> {
    if (projectId.length === 0) {
        return nomadFromLeft({type: "MissingProjectId"} as RetrieveCatalogError);
    }
    if (catalogId.length === 0) {
        return nomadFromLeft({type: "MissingCatalogId"} as RetrieveCatalogError);
    }

    return findCatalog(projectId, catalogId);
}

