import {tryCatch} from "fp-ts/lib/TaskEither";
import {NomadTE} from "@ignition/nomad";
import {IgnitionEffect, timed} from "./effects";

export {IgnitionEffect} from "./effects";

export type CatalogToken = string;

export type IgnitionBuildCatalogError =
    { type: "CompoundError", errors: IgnitionBuildCatalogError[] }
    | { type: "MultipleFamiliesRegistered", item: string, families: string[] }
    | { type: "InclusionFamilyConflict", family: string, items: string[] }
    | { type: "ExclusionFamilyConflict", family: string, items: string[] }
    | { type: "InclusionMissingFamily", item: string }
    | { type: "ExclusionMissingFamily", item: string }

export type IgnitionOptionsError =
    { type: "UnknownSelections", items: string[] }
    | { type: "BadToken", token: string, detail: string }

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
): NomadTE<IgnitionEffect, IgnitionBuildCatalogError, CatalogToken> {
    let contents = {families: families, exclusions: exclusions, inclusions: inclusions};

    return timed(`build_catalog`, {}, () =>
        tryCatch(
            () => import("../crate/pkg")
                .then(m => m.buildClosetWasm(contents)),
            (err: any) => err
        )
    );
}

export type IgnitionOptionsResult = NomadTE<IgnitionEffect, IgnitionOptionsError, [Options, CatalogToken]>

export function findOptions(
    catalogToken: CatalogToken,
    selections: Item[] = [],
    exclusions: Item[] = []
): IgnitionOptionsResult {
    return timed(`find_options`, {token: hashToken(catalogToken)}, () =>
        tryCatch(
            () => import("../crate/pkg")
                .then(m => m.findOptionsWasm(catalogToken, selections, exclusions)),
            (err: any) => err
        )
    );
}

export function findOutfits(
    catalogToken: CatalogToken,
    selections: Item[] = [],
    exclusions: Item[] = []
): NomadTE<IgnitionEffect, IgnitionBuildCatalogError, Item[][]> {
    return timed(`find_outfits`, {token: hashToken(catalogToken)}, () =>
        tryCatch(
            () => import("../crate/pkg")
                .then(m => m.findOutfitsWasm(catalogToken, selections, exclusions)),
            (err: any) => err
        )
    );
}

function hashToken(catalogToken: CatalogToken): string {
    return require('crypto')
        .createHash('sha1')
        .update(catalogToken)
        .digest('base64');
}
