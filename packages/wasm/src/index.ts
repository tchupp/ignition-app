import {TaskEither, tryCatch} from "fp-ts/lib/TaskEither";

export type Catalog = string;

export interface IgnitionError {
    error: string;
    description: string;
    details: IgnitionError[] | string;
}

export interface CatalogContents {
    [key: string]: Item[];
}

export interface Options {
    [key: string]: ItemStatus[];
}

export type ItemStatus = { Available: Item } | { Excluded: Item } | { Selected: Item };

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
