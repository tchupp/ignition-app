import {TaskEither, tryCatch} from "fp-ts/lib/TaskEither";

export type CatalogToken = string;

export type IgnitionCreateCatalogError =
    { type: "CompoundError", errors: IgnitionCreateCatalogError[] }
    | { type: "MultipleFamiliesRegistered", item: string, families: string[] }
    | { type: "InclusionFamilyConflict", family: string, items: string[] }
    | { type: "ExclusionFamilyConflict", family: string, items: string[] }
    | { type: "InclusionMissingFamily", item: string }
    | { type: "ExclusionMissingFamily", item: string }

export type IgnitionOptionsError =
    { type: "UnknownSelections", items: string[] }

export interface CatalogContents {
    readonly [key: string]: Item[];
}

export interface Options {
    readonly [key: string]: ItemStatus[];
}

export type ItemStatus =
    { type: "Available", item: string }
    | { type: "Excluded", item: string }
    | { type: "Selected", item: string }
    | { type: "Required", item: string };

export type Item = string;

export function buildCatalog(
    families: CatalogContents,
    exclusions: CatalogContents = {},
    inclusions: CatalogContents = {}
): TaskEither<IgnitionCreateCatalogError, CatalogToken> {
    let contents = {families: families, exclusions: exclusions, inclusions: inclusions};

    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.buildClosetWasm(contents)),
        (err: any) => err
    );
}

export function findOptions(
    catalogToken: CatalogToken,
    selections: Item[] = [],
    exclusions: Item[] = []
): TaskEither<IgnitionOptionsError, Options> {
    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.findOptionsWasm(catalogToken, selections, exclusions)),
        (err: any) => err
    );
}

export function findOutfits(
    catalogToken: CatalogToken,
    selections: Item[] = [],
    exclusions: Item[] = []
): TaskEither<IgnitionCreateCatalogError, Item[][]> {
    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.findOutfitsWasm(catalogToken, selections, exclusions)),
        (err: any) => err
    );
}
