import Datastore = require("@google-cloud/datastore");
import {DatastoreKey} from "@google-cloud/datastore/entity";
import {findOptions, IgnitionError, Item, Options} from "@ignition/wasm";

import {Option} from "fp-ts/lib/Option";
import {fromLeft, fromReader, fromTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";

import {buildCatalogKey, CatalogEntity} from "./catalog.entity";
import {get} from "./datastore.get";
import {DatastoreError} from "./datastore.error";
import {RetrieveCatalogError, RetrieveCatalogResponse} from "./catalog.retrieve";

export enum ErrorType {Datastore, Request, Internal, Ignition}

export interface RetrieveCatalogError {
    readonly type: ErrorType;
    readonly body: object;
}

export interface RetrieveCatalogResponse {
    readonly id: string;
    readonly options: Options;
}

export function retrieveCatalog(catalogId: string, selections: Item[]): ReaderTaskEither<Datastore, RetrieveCatalogError, RetrieveCatalogResponse> {
    return fromReader<Datastore, DatastoreError, DatastoreKey>(buildCatalogKey(catalogId))
        .chain(catalogKey => {
                return get(catalogKey)
                    .map(option => ([option, catalogKey] as [Option<object>, DatastoreKey]));
            }
        )
        .mapLeft(fromDatastoreError)
        .chain(([option, catalogKey]) => fromResult(option as Option<CatalogEntity>, catalogKey, selections));
}

function fromDatastoreError(err: DatastoreError): RetrieveCatalogError {
    return {type: ErrorType.Datastore, body: {message: err.message}};
}

function fromResult(
    results: Option<CatalogEntity>,
    key: DatastoreKey,
    selections: Item[]
): ReaderTaskEither<Datastore, RetrieveCatalogError, RetrieveCatalogResponse> {
    selections = selections.map(s => s.trim());

    const notFoundError = fromLeft<Datastore, RetrieveCatalogError, Options>({
        type: ErrorType.Request,
        body: {error: `No catalog found with id '${key.name}'`}
    });

    return results
        .map(entity => fromTaskEither<Datastore, RetrieveCatalogError, Options>(findOptions(entity.serialized, selections).mapLeft(fromIgnitionError)))
        .getOrElse(notFoundError)
        .map(options => ({id: key.name || "", options: options}));
}

function fromIgnitionError(err: IgnitionError): RetrieveCatalogError {
    return {type: ErrorType.Ignition, body: err};
}
