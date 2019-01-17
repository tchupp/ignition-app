import {TaskEither, tryCatch} from "fp-ts/lib/TaskEither";
import {fromTaskEither, NomadTE} from "@ignition/nomad";

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
    | { type: "BadToken", token: string, detail: string }

export type CatalogContents = {
    readonly [key: string]: Item[];
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

export type IgnitionEffect =
    { type: "Timing", label: string, timeMs: number }
    | { type: "Timed", label: string, timeMs: number };

export function buildCatalog(
    families: CatalogContents,
    exclusions: CatalogContents = {},
    inclusions: CatalogContents = {}
): NomadTE<IgnitionEffect, IgnitionCreateCatalogError, CatalogToken> {
    let contents = {families: families, exclusions: exclusions, inclusions: inclusions};

    return timedTE(`buildCatalog`, () =>
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
    return timedTE(`findOptions: ${hashToken(catalogToken)}`, () =>
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
): NomadTE<IgnitionEffect, IgnitionCreateCatalogError, Item[][]> {
    return timedTE(`findOutfits: ${hashToken(catalogToken)}`, () =>
        tryCatch(
            () => import("../crate/pkg")
                .then(m => m.findOutfitsWasm(catalogToken, selections, exclusions)),
            (err: any) => err
        )
    );
}

export function timedTE<L, A>(label: string, timed: () => TaskEither<L, A>): NomadTE<IgnitionEffect, L, A> {
    const build = (type: "Timing" | "Timed", time: [number, number]) => ({
        type: type,
        label: label,
        timeMs: (time[0] * 1000) + (time[1] / 1000000)
    } as IgnitionEffect);

    const startTimingEffect = build("Timing", process.hrtime());
    return fromTaskEither<IgnitionEffect, L, A>(timed())
        .concat(startTimingEffect)
        .concatL(() => {
            const end = process.hrtime();
            return build("Timed", end);
        });
}

function hashToken(catalogToken: CatalogToken): string {
    return require('crypto')
        .createHash('sha1')
        .update(catalogToken)
        .digest('base64');
}
