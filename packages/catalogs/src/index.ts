import {tryCatch} from "fp-ts/lib/TaskEither";
import {NomadTE} from "@ignition/nomad";
import {IgnitionEffect, timed} from "./effects";

export {IgnitionEffect} from "./effects";

export type CatalogToken = string;

export type CatalogState = {
    readonly token: CatalogToken;
    readonly selections: Item[];
    readonly exclusions: Item[];
};

export type IgnitionBuildCatalogError =
    { type: "EmptyCatalog" }
    | { type: "InclusionMissingFamily", item: string }
    | { type: "ExclusionMissingFamily", item: string }
    | { type: "MultipleFamiliesRegistered", item: string, families: string[] }
    | { type: "InclusionFamilyConflict", family: string, items: string[] }
    | { type: "ExclusionFamilyConflict", family: string, items: string[] }
    | { type: "CompoundError", errors: IgnitionBuildCatalogError[] }

export type IgnitionOptionsError =
    { type: "UnknownSelections", items: Item[] }
    | { type: "UnknownExclusions", items: Item[] }
    | { type: "MissingToken" }
    | { type: "BadState" }
    | { type: "BadToken", token: CatalogToken, detail: string }
    | { type: "CompoundError", errors: IgnitionOptionsError[] }

export type CatalogFamilies = {
    readonly [key: string]: Item[];
}

export type CatalogExclusionRule = {
    readonly conditions: Item[];
    readonly exclusions: Item[];
}

export type CatalogInclusionRule = {
    readonly conditions: Item[];
    readonly inclusions: Item[];
}

export type Options = {
    readonly [key: string]: ItemStatus[];
}

export type ItemStatus =
    { type: "Available", item: string }
    | { type: "Excluded", item: string }
    | { type: "Selected", item: string }
    | { type: "Required", item: string };

export type Item = string;

export function buildCatalog(
    families: CatalogFamilies,
    exclusions: CatalogExclusionRule[] = [],
    inclusions: CatalogInclusionRule[] = []
): NomadTE<IgnitionEffect, IgnitionBuildCatalogError, CatalogState> {
    let contents = {families: families, exclusions: exclusions, inclusions: inclusions};

    return timed(`build_catalog`, {}, () =>
        tryCatch(
            () => import("../crate/pkg")
                .then(m => m.buildCatalogWasm(contents)),
            (err: any) => err
        )
    );
}

export type IgnitionOptionsResult = NomadTE<IgnitionEffect, IgnitionOptionsError, [Options, CatalogState]>

export function findOptions(
    catalogState: CatalogState,
    selections: Item[] = [],
    exclusions: Item[] = []
): IgnitionOptionsResult {
    return timed(`find_options`, {token: hashToken(catalogState)}, () =>
        tryCatch(
            () => import("../crate/pkg")
                .then(m => m.findOptionsWasm(catalogState, selections, exclusions)),
            (err: any) => err
        )
    );
}

export function findOutfits(
    catalogState: CatalogState,
    selections: Item[] = [],
    exclusions: Item[] = []
): NomadTE<IgnitionEffect, IgnitionBuildCatalogError, Item[][]> {
    return timed(`find_outfits`, {token: hashToken(catalogState)}, () =>
        tryCatch(
            () => import("../crate/pkg")
                .then(m => m.findOutfitsWasm(catalogState, selections, exclusions)),
            (err: any) => err
        )
    );
}

function hashToken(catalogState: CatalogState): string {
    return require('crypto')
        .createHash('sha1')
        .update(catalogState.token)
        .digest('base64');
}
