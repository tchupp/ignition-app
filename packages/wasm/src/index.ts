import {TaskEither, tryCatch} from "fp-ts/lib/TaskEither";

export type Catalog = string;

export interface IgnitionError {
    readonly error: string;
    readonly description: string;
    readonly details: IgnitionError[] | string;
}

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
): TaskEither<IgnitionError, Catalog> {
    let contents = {families: families, exclusions: exclusions, inclusions: inclusions};

    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.buildClosetWasm(contents)),
        (err: any) => err
    );
}

export function findOptions(
    catalog: Catalog,
    selections: Item[] = [],
    exclusions: Item[] = []
): TaskEither<IgnitionError, Options> {
    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.findOptionsWasm(catalog, selections, exclusions)),
        (err: any) => err
    );
}

export function findOutfits(
    catalog: Catalog,
    selections: Item[] = [],
    exclusions: Item[] = []
): TaskEither<IgnitionError, Item[][]> {
    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.findOutfitsWasm(catalog, selections, exclusions)),
        (err: any) => err
    );
}
