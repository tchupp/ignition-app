import {nomadRTE} from "@ignition/nomad";

import {status} from "grpc";

import {
    retrieveCatalog as retrieveCatalogInner,
    RetrieveCatalogError,
    RetrieveCatalogResponse
} from "./catalog.retrieve";
import {Catalog, RetrieveCatalogRequest} from "../../generated/catalogs_pb";
import {badRequestDetail, GrpcServiceError, serviceError} from "../infrastructure/errors.pb";
import {CatalogsResult} from "../infrastructure/result";

export function retrieveCatalog(req: RetrieveCatalogRequest): CatalogsResult<GrpcServiceError, Catalog> {
    return fromRequest(req)
        .chain(([projectId, catalogId]) => retrieveCatalogInner(projectId, catalogId))
        .mapLeft(toErrorResponse)
        .map(toSuccessResponse);
}

function fromRequest(req: RetrieveCatalogRequest): CatalogsResult<RetrieveCatalogError, [string, string]> {
    const projectId = req.getProjectId();
    const catalogId = req.getCatalogId();

    return nomadRTE.of([projectId, catalogId] as [string, string]);
}

function toSuccessResponse(response: RetrieveCatalogResponse): Catalog {
    const catalog = new Catalog();
    catalog.setCatalogId(response.id);
    catalog.setToken(response.token);
    catalog.setCreated(response.created.toISOString());
    return catalog;
}

function toErrorResponse(error: RetrieveCatalogError): GrpcServiceError {
    switch (error.type) {
        case "Datastore":
            return serviceError(
                "Datastore Error",
                status.INTERNAL,
                []);

        case "MissingCatalogId":
            return serviceError(
                "Missing CatalogId",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "catalog_id",
                            description: "Catalog Id is required"
                        }]
                    })
                ]);

        case "CatalogNotFound":
            return serviceError(
                `No catalog found with id '${error.catalogId}'`,
                status.NOT_FOUND);

    }

    return serviceError(
        "Unknown Error",
        status.UNKNOWN,
        []);
}
