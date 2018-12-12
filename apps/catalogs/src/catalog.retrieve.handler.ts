import Datastore = require("@google-cloud/datastore");
import {Item} from "@ignition/wasm";
import {Catalog, RetrieveCatalogRequest} from "../generated/catalogs_pb";

import {Either} from "fp-ts/lib/Either";
import {fromLeft, readerTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {ServiceError, status} from "grpc";
import {defer, Observable} from "rxjs";

import {
    ErrorType,
    retrieveCatalog as retrieveCatalogInner,
    RetrieveCatalogError,
    RetrieveCatalogResponse
} from "./catalog.retrieve";

export function retrieveCatalog(req: RetrieveCatalogRequest, datastore: Datastore): Observable<Either<ServiceError, Catalog>> {
    return defer(() => {
        return fromRequest(req)
            .chain(([catalogId, selections]) => retrieveCatalogInner(catalogId, selections))
            .bimap(toErrorResponse, toSuccessResponse)
            .run(datastore);
    });
}

function fromRequest(req: RetrieveCatalogRequest): ReaderTaskEither<Datastore, RetrieveCatalogError, [string, Item[]]> {
    let catalogId = req.getCatalogId();
    let selections = req.getSelectionsList();

    if (catalogId.length === 0) {
        return fromLeft({type: ErrorType.Request, body: {error: "No catalog id in request"}});
    }

    return readerTaskEither.of([catalogId, selections] as [string, Item[]]);
}

function toSuccessResponse(response: RetrieveCatalogResponse): Catalog {
    let catalog = new Catalog();
    catalog.setCatalogId(response.id);

    return catalog;
}

function toErrorResponse(_error: RetrieveCatalogError): ServiceError {
    return {
        name: "",
        message: "",
        code: status.ABORTED
    };
}
