import Datastore = require("@google-cloud/datastore");
import {CatalogToken, Item, ItemStatus} from "@ignition/wasm";
import {CatalogOptions, FamilyOptions, ItemOption, RetrieveCatalogOptionsRequest} from "../generated/catalogs_pb";
import {readerTaskEither, ReaderTaskEither} from "fp-ts/lib/ReaderTaskEither";
import {status} from "grpc";

import {
    retrieveCatalogOptions as retrieveCatalogOptionsInner,
    RetrieveCatalogOptionsError,
    RetrieveCatalogOptionsResponse
} from "./catalog.retrieve.options";
import {badRequestDetail, GrpcServiceError, preconditionFailureDetail, serviceError} from "./errors.pb";

export function retrieveCatalogOptions(req: RetrieveCatalogOptionsRequest): ReaderTaskEither<Datastore, GrpcServiceError, CatalogOptions> {
    return fromRequest(req)
        .chain(([catalogId, token, selections]) => retrieveCatalogOptionsInner(catalogId, token, selections))
        .bimap(toErrorResponse, toSuccessResponse);
}

function fromRequest(req: RetrieveCatalogOptionsRequest): ReaderTaskEither<Datastore, RetrieveCatalogOptionsError, [string, CatalogToken, Item[]]> {
    const catalogId = req.getCatalogId();
    const token = req.getToken();

    const selections_matrix = req.getSelectionsList()
        .map(selection => selection.split(","));
    const selections: string[] = ([] as string[]).concat(...selections_matrix);

    return readerTaskEither.of([catalogId, token, selections] as [string, CatalogToken, Item[]]);
}

function toSuccessResponse(response: RetrieveCatalogOptionsResponse): CatalogOptions {
    function toItem(status: ItemStatus): ItemOption {
        const item = new ItemOption();
        item.setItemId(status.item);

        switch (status.type) {
            case "Available":
                item.setItemStatus(ItemOption.Status.AVAILABLE);
                return item;
            case "Excluded":
                item.setItemStatus(ItemOption.Status.EXCLUDED);
                return item;
            case "Selected":
                item.setItemStatus(ItemOption.Status.SELECTED);
                return item;
            case "Required":
                item.setItemStatus(ItemOption.Status.REQUIRED);
                return item;
        }
    }

    function toFamilyOptions(familyId: string, statuses: ItemStatus[]): FamilyOptions {
        const items = statuses.map((status: ItemStatus) => toItem(status));

        const familyOptions = new FamilyOptions();
        familyOptions.setFamilyId(familyId);
        familyOptions.setOptionsList(items);
        return familyOptions;
    }

    const familyOptions: FamilyOptions[] =
        Object.keys(response.options)
            .map(familyId => toFamilyOptions(familyId, response.options[familyId]));

    const catalogOptions = new CatalogOptions();
    catalogOptions.setCatalogId(response.id);
    catalogOptions.setOptionsList(familyOptions);
    return catalogOptions;
}

function toErrorResponse(error: RetrieveCatalogOptionsError): GrpcServiceError {
    console.error(error);

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

        case "UnknownSelections":
            return serviceError(
                "Unknown Selections",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "selections",
                            description: `Selected items are unknown: [${error.items}]`
                        }]
                    })
                ]);

        case "BadToken":
            return serviceError(
                "Malformed catalog token, catalog must be re-created",
                status.FAILED_PRECONDITION,
                [
                    preconditionFailureDetail({
                        violationsList: [{
                            type: "CatalogToken",
                            subject: error.catalogId,
                            description: "Catalog token is malformed",
                        }]
                    })
                ]);

        case "BadUserToken":
            return serviceError(
                "Request contains bad catalog token",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "token",
                            description: `token: ${error.token}`
                        }]
                    })
                ]);
    }
}
