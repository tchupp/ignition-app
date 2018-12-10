import {TaskEither, tryCatch} from "fp-ts/lib/TaskEither";

export type Closet = string;

export interface IgnitionError {
    error: string;
    description: string;
    details: IgnitionError[] | string;
}

export interface ClosetContents {
    [key: string]: Item[];
}

export interface Options {
    [key: string]: ItemStatus[];
}

export type ItemStatus = { Available: Item } | { Excluded: Item } | { Selected: Item };

export type Item = string;

export function buildCloset(
    families: ClosetContents,
    exclusions: ClosetContents = {},
    inclusions: ClosetContents = {}
): TaskEither<IgnitionError, Closet> {
    let contents = {families: families, exclusions: exclusions, inclusions: inclusions};

    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.buildClosetWasm(contents)),
        (err: any) => err
    );
}

export function findOptions(
    closet: Closet,
    selections: Item[] = [],
    exclusions: Item[] = []
): TaskEither<IgnitionError, Options> {
    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.findOptionsWasm(closet, selections, exclusions)),
        (err: any) => err
    );
}

export function findOutfits(
    closet: Closet,
    selections: Item[] = [],
    exclusions: Item[] = []
): TaskEither<IgnitionError, Item[][]> {
    return tryCatch(
        () => import("../crate/pkg")
            .then(m => m.findOutfitsWasm(closet, selections, exclusions)),
        (err: any) => err
    );
}
