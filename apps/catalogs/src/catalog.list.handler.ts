import Datastore = require("@google-cloud/datastore");
import {readerTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";

import {listCatalogs as listCatalogsInner, ListCatalogsError, ListCatalogsResponse} from "./catalog.list";
import {Catalog, ListCatalogsRequest, ListCatalogsResponse as GrpcResponse} from "../generated/catalogs_pb";
import {GrpcServiceError, serviceError} from "./errors.pb";
import {status} from "grpc";

export function listCatalogs(req: ListCatalogsRequest): ReaderTaskEither<Datastore, GrpcServiceError, GrpcResponse> {
    return fromRequest<Datastore>(req)
        .chain(() => listCatalogsInner())
        .bimap(toErrorResponse, toSuccessResponse);
}

function fromRequest<Ctx>(_req: ListCatalogsRequest): ReaderTaskEither<Ctx, ListCatalogsError, any[]> {
    return readerTaskEither.of([]);
}

function toSuccessResponse(response: ListCatalogsResponse): GrpcResponse {
    const catalogs = response.catalogs.map(cat => {
        const catalog = new Catalog();
        catalog.setCatalogId(cat.id);
        catalog.setToken(cat.token);
        catalog.setCreated(cat.created.toISOString());
        return catalog;
    });

    const grpcResponse = new GrpcResponse();
    grpcResponse.setCatalogsList(catalogs);
    return grpcResponse;
}

function toErrorResponse(error: ListCatalogsError): GrpcServiceError {
    switch (error.type) {
        case "Datastore":
            return serviceError(
                "Datastore Error",
                status.INTERNAL,
                []);
    }

    return serviceError(
        "Unknown Error",
        status.UNKNOWN,
        []);
}
