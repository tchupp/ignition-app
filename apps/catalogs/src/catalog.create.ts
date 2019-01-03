import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {
    buildCatalog,
    CatalogContents,
    CatalogToken,
    findOptions as findOptionsInner,
    IgnitionCreateCatalogError,
    Options,
} from "@ignition/wasm";

import {fromLeft, fromReader, fromTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {tryCatch} from "fp-ts/lib/TaskEither";

import {buildCatalogEntity, CatalogEntity} from "./catalog.entity";
import {DatastoreError, DatastoreErrorCode} from "./datastore.error";

export type SaveCatalogError =
    { type: "Datastore", error: DatastoreError }
    | { type: "MissingFamilies" }
    | { type: "CatalogAlreadyExists", catalogId: string }
    // Ignition catalog creation errors
    | { type: "CompoundError", errors: SaveCatalogError[] }
    | { type: "MultipleFamiliesRegistered", item: string, families: string[] }
    | { type: "InclusionFamilyConflict", family: string, items: string[] }
    | { type: "ExclusionFamilyConflict", family: string, items: string[] }
    | { type: "InclusionMissingFamily", item: string }
    | { type: "ExclusionMissingFamily", item: string }
    // Ignition options errors
    | { type: "UnknownSelections", items: string[] }
    | { type: "BadToken", token: string, detail: string }

export type SaveCatalogResponse = {
    readonly id: string;
    readonly options: Options;
    readonly token: string;
}

export type CatalogRules = {
    readonly id: string;
    readonly families: CatalogContents;
    readonly exclusions: CatalogContents;
    readonly inclusions: CatalogContents;
}

export function createCatalog(rules: CatalogRules, timestamp: Date): ReaderTaskEither<Datastore, SaveCatalogError, SaveCatalogResponse> {
    if (isEmptyObject(rules.families)) return fromLeft({type: "MissingFamilies"} as SaveCatalogError);

    return fromTaskEither<Datastore, IgnitionCreateCatalogError, CatalogToken>(buildCatalog(rules.families, rules.exclusions, rules.inclusions))
        .mapLeft(fromIgnitionError)
        .chain(catalog => fromReader<Datastore, SaveCatalogError, DatastorePayload<CatalogEntity>>(buildCatalogEntity(rules.id, catalog, timestamp))
            .chain(saveCatalogEntity)
            .map(() => catalog)
        )
        .chain(findOptions)
        .map(([options, token]) => ({id: rules.id, options: options, token: token}));
}

function fromIgnitionError(err: IgnitionCreateCatalogError): SaveCatalogError {
    switch (err.type) {
        case "CompoundError":
            return err;
        case "MultipleFamiliesRegistered":
            return err;
        case "InclusionFamilyConflict":
            return err;
        case "ExclusionFamilyConflict":
            return err;
        case "InclusionMissingFamily":
            return err;
        case "ExclusionMissingFamily":
            return err;
    }
}

function saveCatalogEntity(
    entity: DatastorePayload<CatalogEntity>
): ReaderTaskEither<Datastore, SaveCatalogError, CommitResult> {
    function fromDatastoreError(err: DatastoreError): SaveCatalogError {
        if (err.code === DatastoreErrorCode.ALREADY_EXISTS) {
            return {type: "CatalogAlreadyExists", catalogId: (entity.data as CatalogEntity).id};
        }
        return {type: "Datastore", error: err};
    }

    return new ReaderTaskEither((datastore: Datastore) =>
        tryCatch(
            () => datastore.insert(entity),
            (err: any) => fromDatastoreError(err)
        )
    );
}

function findOptions<Ctx>(
    catalogToken: CatalogToken
): ReaderTaskEither<Ctx, SaveCatalogError, [Options, CatalogToken]> {
    return fromTaskEither(
        findOptionsInner(catalogToken)
            .mapLeft((err): SaveCatalogError => {
                switch (err.type) {
                    case "BadToken":
                        return err;
                    case "UnknownSelections":
                        return err;
                }
            })
    );
}

function isEmptyObject(obj: object): boolean {
    return Object.keys(obj).length === 0;
}