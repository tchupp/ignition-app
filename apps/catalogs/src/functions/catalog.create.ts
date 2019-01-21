import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";
import {DatastorePayload} from "@google-cloud/datastore/entity";
import {fromLeft, fromTaskEither} from "@ignition/nomad";

import {
    buildCatalog,
    CatalogContents,
    CatalogToken,
    findOptions as findOptionsInner,
    IgnitionCreateCatalogError,
    Options,
} from "@ignition/wasm";

import {tryCatch} from "fp-ts/lib/TaskEither";

import {buildCatalogEntity, CatalogEntity} from "./catalog.entity";
import {SaveCatalogError} from "./catalog.create";
import {DatastoreError, DatastoreErrorCode} from "../infrastructure/datastore.error";
import {CatalogsResult, fromReader} from "../infrastructure/result";
import {timed} from "../infrastructure/effects";

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

export function createCatalog(rules: CatalogRules, timestamp: Date): CatalogsResult<SaveCatalogError, SaveCatalogResponse> {
    if (isEmptyObject(rules.families)) return fromLeft({type: "MissingFamilies"} as SaveCatalogError);

    return buildCatalog(rules.families, rules.exclusions, rules.inclusions)
        .toNomadRTE<Datastore>()
        .mapLeft(fromIgnitionError)
        .chain(catalog => fromReader<SaveCatalogError, DatastorePayload<CatalogEntity>>(buildCatalogEntity(rules.id, catalog, timestamp))
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
): CatalogsResult<SaveCatalogError, CommitResult> {
    function fromDatastoreError(err: DatastoreError): SaveCatalogError {
        if (err.code === DatastoreErrorCode.ALREADY_EXISTS) {
            return {type: "CatalogAlreadyExists", catalogId: (entity.data as CatalogEntity).id};
        }
        return {type: "Datastore", error: err};
    }

    return timed("save_catalog", {}, (datastore: Datastore) =>
        fromTaskEither(tryCatch(
            () => datastore.insert(entity),
            (err: any) => fromDatastoreError(err)
        ))
    );
}

function findOptions(
    catalogToken: CatalogToken
): CatalogsResult<SaveCatalogError, [Options, CatalogToken]> {
    return findOptionsInner(catalogToken)
        .mapLeft((err): SaveCatalogError => {
            switch (err.type) {
                case "BadToken":
                    return err;
                case "UnknownSelections":
                    return err;
            }
        })
        .toNomadRTE<Datastore>();
}

function isEmptyObject(obj: object): boolean {
    return Object.keys(obj).length === 0;
}