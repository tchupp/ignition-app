import Datastore = require("@google-cloud/datastore");
import {findOptions as findOptionsInner, Item, Options} from "@ignition/wasm";

import {fromTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {fromLeft, taskEither, tryCatch} from "fp-ts/lib/TaskEither";

import {CatalogEntity} from "./catalog.entity";
import {DatastoreError} from "./datastore.error";

export enum ErrorType {Datastore, NotFound, Internal, Ignition}

export interface RetrieveCatalogError {
    readonly type: ErrorType;
    readonly body: object;
}

export interface RetrieveCatalogResponse {
    readonly id: string;
    readonly options: Options;
}

export function retrieveCatalog(catalogId: string, selections: Item[]): ReaderTaskEither<Datastore, RetrieveCatalogError, RetrieveCatalogResponse> {
    return findCatalog(catalogId)
        .chain(entity => findOptions(entity, selections))
        .map(options => ({id: catalogId, options: options}));
}

function findCatalog(catalogId: string): ReaderTaskEither<Datastore, RetrieveCatalogError, CatalogEntity> {
    const notFoundError = fromLeft<RetrieveCatalogError, CatalogEntity>({
        type: ErrorType.NotFound,
        body: {error: `No catalog found with id '${catalogId}'`}
    });

    return new ReaderTaskEither(datastore => {
            const query = datastore
                .createQuery("Catalog")
                .filter("id", catalogId)
                .limit(1);

            return tryCatch(() => datastore.runQuery(query), (err: any) => err as DatastoreError)
                .mapLeft(fromDatastoreError)
                .chain(([entities]) => entities.length > 0 ? taskEither.of(entities[0] as CatalogEntity) : notFoundError);
        }
    );
}

function fromDatastoreError(err: DatastoreError): RetrieveCatalogError {
    return {type: ErrorType.Datastore, body: {message: err.message}};
}

function findOptions(
    entity: CatalogEntity,
    selections: Item[]
): ReaderTaskEither<Datastore, RetrieveCatalogError, Options> {
    return fromTaskEither(
        findOptionsInner(entity.serialized, selections)
            .mapLeft(err => ({type: ErrorType.Ignition, body: err}))
    );
}
