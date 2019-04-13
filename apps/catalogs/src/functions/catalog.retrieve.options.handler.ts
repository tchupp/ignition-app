import {nomadRTE} from "@ignition/nomad";
import {Item, ItemStatus} from "@ignition/catalogs";

import {CatalogOptions, FamilyOptions, ItemOption, RetrieveCatalogOptionsRequest} from "../../generated/catalogs_pb";
import {status} from "grpc";

import {
    retrieveCatalogOptions as retrieveCatalogOptionsInner,
    RetrieveCatalogOptionsError,
    RetrieveCatalogOptionsResponse
} from "./catalog.retrieve.options";
import {badRequestDetail, GrpcServiceError, preconditionFailureDetail, serviceError} from "../infrastructure/errors.pb";
import {CatalogsResult} from "../infrastructure/result";
import {CatalogState, SerializedCatalogState} from "./catalog.state";
import {Option} from "fp-ts/lib/Option";

type ProjectId = string;
type CatalogId = string;
type FromRequest = [ProjectId, CatalogId, Option<CatalogState>, Item[], Item[]];

export function retrieveCatalogOptions(req: RetrieveCatalogOptionsRequest): CatalogsResult<GrpcServiceError, CatalogOptions> {
    return fromRequest(req)
        .chain(([projectId, catalogId, catalogState, selections, exclusions]) => retrieveCatalogOptionsInner(projectId, catalogId, catalogState, selections, exclusions))
        .mapLeft(toErrorResponse)
        .map(toSuccessResponse);
}

function fromRequest(req: RetrieveCatalogOptionsRequest): CatalogsResult<RetrieveCatalogOptionsError, FromRequest> {
    const projectId = req.getProjectId();
    const catalogId = req.getCatalogId();
    const catalogState = CatalogState(req.getState());
    const selections = req.getSelectionsList();
    const exclusions = req.getExclusionsList();

    return nomadRTE.of([projectId, catalogId, catalogState, selections, exclusions] as FromRequest);
}

function toSuccessResponse({options, catalogState}: RetrieveCatalogOptionsResponse): CatalogOptions {
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
        Object.keys(options)
            .map(familyId => toFamilyOptions(familyId, options[familyId]));

    const catalogOptions = new CatalogOptions();
    catalogOptions.setOptionsList(familyOptions);
    catalogOptions.setState(SerializedCatalogState(catalogState));
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

        case "MissingProjectId":
            return serviceError(
                "Missing ProjectId",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "project_id",
                            description: "Project Id is required"
                        }]
                    })
                ]);

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

        case "UnknownExclusions":
            return serviceError(
                "Unknown Exclusions",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "exclusions",
                            description: `Excluded items are unknown: [${error.items}]`
                        }]
                    })
                ]);

        case "UnknownItems":
            return serviceError(
                "Unknown Items",
                status.INVALID_ARGUMENT,
                [
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "selections",
                            description: `Selected items are unknown: [${error.selections}]`
                        }]
                    }),
                    badRequestDetail({
                        fieldViolationsList: [{
                            field: "exclusions",
                            description: `Excluded items are unknown: [${error.exclusions}]`
                        }]
                    })
                ]);

        case "BadToken":
            return serviceError(
                "Malformed catalog, catalog must be re-created",
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

        case "BadState":
            return serviceError(
                "Bad Catalog State",
                status.INTERNAL,
                []);
    }
}
