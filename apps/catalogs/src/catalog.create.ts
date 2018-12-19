import Datastore = require("@google-cloud/datastore");
import {CommitResult} from "@google-cloud/datastore/request";
import {DatastorePayload} from "@google-cloud/datastore/entity";

import {
    buildCatalog,
    Catalog,
    CatalogContents,
    findOptions as findOptionsInner,
    IgnitionError,
    Options,
} from "@ignition/wasm";

import {fromLeft, fromReader, fromTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {tryCatch} from "fp-ts/lib/TaskEither";

import {buildCatalogEntity, CatalogEntity} from "./catalog.entity";
import {DatastoreError} from "./datastore.error";

export enum ErrorType {Datastore, InvalidInput, Internal, Ignition}

export interface SaveCatalogError {
    readonly type: ErrorType;
    readonly body: object;
}

export interface SaveCatalogResponse {
    readonly id: string;
    readonly options: Options;
}

export interface CatalogRules {
    readonly id: string;
    readonly families: CatalogContents;
    readonly exclusions: CatalogContents;
    readonly inclusions: CatalogContents;
}

export function createCatalog(rules: CatalogRules): ReaderTaskEither<[Datastore, Date], SaveCatalogError, SaveCatalogResponse> {
    if (isEmptyObject(rules.families)) return fromLeft({
        type: ErrorType.InvalidInput,
        body: {message: "Request is missing 'families' object"}
    });

    return fromTaskEither<[Datastore, Date], IgnitionError, Catalog>(buildCatalog(rules.families, rules.exclusions, rules.inclusions))
        .mapLeft(fromIgnitionError)
        .chain(catalog => fromReader<[Datastore, Date], SaveCatalogError, DatastorePayload<CatalogEntity>>(buildCatalogEntity(rules.id, catalog))
            .chain(entity =>
                saveCatalogEntity(entity)
                    .local(([datastore]) => datastore))
            .map(() => catalog)
        )
        .chain(catalog => findOptions(catalog))
        .map(options => fromCommitResult(rules.id, options));
}

function fromIgnitionError(err: IgnitionError): SaveCatalogError {
    return {type: ErrorType.Ignition, body: err};
}

function saveCatalogEntity(
    entity: DatastorePayload<CatalogEntity>
): ReaderTaskEither<Datastore, SaveCatalogError, CommitResult> {
    function fromDatastoreError(err: DatastoreError): SaveCatalogError {
        return {type: ErrorType.Datastore, body: {message: err.message}};
    }

    return new ReaderTaskEither(datastore =>
        tryCatch(
            () => datastore.upsert(entity),
            (err: any) => fromDatastoreError(err)
        )
    );
}

function findOptions<Ctx>(
    catalog: Catalog
): ReaderTaskEither<Ctx, SaveCatalogError, Options> {
    return fromTaskEither(
        findOptionsInner(catalog)
            .mapLeft(err => ({type: ErrorType.Ignition, body: err}))
    );
}

function fromCommitResult(catalogId: string, options: Options): SaveCatalogResponse {
    return {id: catalogId, options: options};
}

function isEmptyObject(obj: object): boolean {
    return Object.keys(obj).length === 0;
}