import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {buildCatalog, Catalog, CatalogContents, IgnitionError} from "@ignition/wasm";

import {fromLeft, fromReader, fromTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {tryCatch} from "fp-ts/lib/TaskEither";

import {buildCatalogEntity, CatalogEntity} from "./catalog.entity";
import {DatastoreError} from "./datastore.error";

export enum ErrorType {Datastore, InvalidInput, Internal, Ignition}

export interface SaveCatalogError {
    type: ErrorType;
    body: object;
}

export interface SaveCatalogResponse {
    id: string;
}

export interface CatalogRules {
    id: string;
    families: CatalogContents;
    exclusions: CatalogContents;
    inclusions: CatalogContents;
}

export function createCatalog(rules: CatalogRules): ReaderTaskEither<[Datastore, Date], SaveCatalogError, SaveCatalogResponse> {
    if (isEmptyObject(rules.families)) return fromLeft({
        type: ErrorType.InvalidInput,
        body: {message: "Request is missing 'families' object"}
    });

    return fromTaskEither<[Datastore, Date], IgnitionError, Catalog>(buildCatalog(rules.families, rules.exclusions, rules.inclusions))
        .mapLeft(fromIgnitionError)
        .chain(catalog => fromReader(buildCatalogEntity(rules.id, catalog)))
        .chain(entity =>
            saveCatalogEntity(entity)
                .local(([datastore]) => datastore))
        .map(() => fromCommitResult(rules.id));
}

function fromIgnitionError(err: IgnitionError): SaveCatalogError {
    return {type: ErrorType.Ignition, body: err};
}

function saveCatalogEntity(
    entity: DatastorePayload<CatalogEntity>
): ReaderTaskEither<Datastore, SaveCatalogError, CommitResult> {
    return new ReaderTaskEither(datastore =>
        tryCatch(
            () => datastore.upsert(entity),
            (err: any) => fromDatastoreError(err)
        )
    );
}

function fromDatastoreError(err: DatastoreError): SaveCatalogError {
    return {type: ErrorType.Datastore, body: {message: err.message}};
}

function fromCommitResult(catalogId: string): SaveCatalogResponse {
    return {id: catalogId};
}

function isEmptyObject(obj: object): boolean {
    return Object.keys(obj).length === 0;
}