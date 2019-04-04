import {Item} from "@ignition/catalogs";

export type CatalogState = {
    readonly projectId: string,
    readonly catalogId: string,
    readonly selections: Item[];
    readonly exclusions: Item[];
}

export function defaultCatalogState(projectId: string, catalogId: string): SerializedCatalogState {
    return SerializedCatalogState({
        projectId: projectId,
        catalogId: catalogId,
        selections: [],
        exclusions: []
    });
}

export function CatalogState(state: SerializedCatalogState): CatalogState {
    return JSON.parse(new Buffer(state, "base64").toString("ascii"));
}

export type SerializedCatalogState = string;

export function SerializedCatalogState(state: CatalogState): SerializedCatalogState {
    return new Buffer(JSON.stringify(state)).toString("base64");
}