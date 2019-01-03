import Datastore = require("@google-cloud/datastore");
import {CatalogContents, ItemStatus} from "@ignition/wasm";

import {CatalogOptions, CreateCatalogRequest, FamilyOptions, ItemOption} from "../generated/catalogs_pb";
import {status} from "grpc";
import {ReaderTaskEither, readerTaskEither} from "fp-ts/lib/ReaderTaskEither";

import {
    badRequestDetail,
    debugInfoDetail,
    GrpcServiceError,
    GrpcServiceErrorDetail,
    resourceInfoDetail,
    serviceError
} from "./errors.pb";
import {
    CatalogRules,
    createCatalog as createCatalogInner,
    SaveCatalogError,
    SaveCatalogResponse
} from "./catalog.create";

export function createCatalog(req: CreateCatalogRequest, timestamp: Date = new Date()): ReaderTaskEither<Datastore, GrpcServiceError, CatalogOptions> {
    return fromRequest<Datastore>(req)
        .chain(rules => createCatalogInner(rules, timestamp))
        .bimap(toErrorResponse, toSuccessResponse);
}

function fromRequest<Ctx>(req: CreateCatalogRequest): ReaderTaskEither<Ctx, SaveCatalogError, CatalogRules> {
    const catalogId = req.getCatalogId();
    const families = req.getFamiliesList()
        .reduce((acc, rule) => ({...acc, [rule.getFamilyId()]: rule.getItemsList()}), {} as CatalogContents);
    const exclusions = req.getExclusionsList()
        .reduce((acc, rule) => ({...acc, [rule.getSelectedItem()]: rule.getExclusionsList()}), {} as CatalogContents);
    const inclusions = req.getInclusionsList()
        .reduce((acc, rule) => ({...acc, [rule.getSelectedItem()]: rule.getInclusionsList()}), {} as CatalogContents);

    return readerTaskEither.of<Ctx, SaveCatalogError, CatalogRules>({
        id: catalogId,
        families: families,
        exclusions: exclusions,
        inclusions: inclusions,
    });
}

function toSuccessResponse(response: SaveCatalogResponse): CatalogOptions {
    function toItem(status: ItemStatus): ItemOption {
        const item = new ItemOption();
        switch (status.type) {
            case "Available":
                item.setItemId(status.item);
                item.setItemStatus(ItemOption.Status.AVAILABLE);
                return item;
            case "Excluded":
                item.setItemId(status.item);
                item.setItemStatus(ItemOption.Status.EXCLUDED);
                return item;
            case "Selected":
                item.setItemId(status.item);
                item.setItemStatus(ItemOption.Status.SELECTED);
                return item;
            case "Required":
                item.setItemId(status.item);
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
    catalogOptions.setToken(response.token);
    return catalogOptions;
}

function toErrorResponseDetails(error: SaveCatalogError): GrpcServiceErrorDetail[] {
    switch (error.type) {
        case "Datastore":
            return [];

        case "CatalogAlreadyExists":
            return [
                resourceInfoDetail({
                    owner: "",
                    resourceType: "Catalog",
                    resourceName: error.catalogId,
                    description: "Catalogs may not be re-created, use UpdateCatalog to modify an existing Catalog"
                })
            ];

        case "MissingFamilies":
            return [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "families",
                        description: `field is required`
                    }]
                })
            ];

        case "CompoundError":
            return ([] as GrpcServiceErrorDetail[])
                .concat(...error.errors.map(toErrorResponseDetails));

        case "MultipleFamiliesRegistered":
            return [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "families",
                        description: `Item '${error.item}' has multiple families: [${error.families}]`
                    }]
                })
            ];

        case "InclusionFamilyConflict":
            return [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "inclusions",
                        description: `Inclusion rule has multiple items [${error.items}] from the same family '${error.family}'`
                    }]
                })
            ];

        case "ExclusionFamilyConflict":
            return [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "exclusions",
                        description: `Exclusion rule has multiple items [${error.items}] from the same family '${error.family}'`
                    }]
                })
            ];

        case "InclusionMissingFamily":
            return [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "inclusions",
                        description: `Item is not registered to any family: '${error.item}'`
                    }]
                })
            ];

        case "ExclusionMissingFamily":
            return [
                badRequestDetail({
                    fieldViolationsList: [{
                        field: "exclusions",
                        description: `Item is not registered to any family: '${error.item}'`
                    }]
                })
            ];

        case "UnknownSelections":
            return [
                debugInfoDetail({
                    detail: `We should have no selections when creating a catalog, but had: [${error.items}]`,
                    stackEntriesList: []
                })
            ];

        case "BadToken":
            return [];
    }
}

function toErrorResponse(error: SaveCatalogError): GrpcServiceError {
    switch (error.type) {
        case "Datastore":
            return serviceError(
                "Datastore Error",
                status.INTERNAL,
                toErrorResponseDetails(error));

        case "CatalogAlreadyExists":
            return serviceError(
                "Catalog already exists",
                status.ALREADY_EXISTS,
                toErrorResponseDetails(error));

        case "MissingFamilies":
            return serviceError(
                "Families are required to build a catalog",
                status.INVALID_ARGUMENT,
                toErrorResponseDetails(error));

        case "CompoundError":
            return serviceError(
                "Multiple invalid request parameters",
                status.INVALID_ARGUMENT,
                ([] as GrpcServiceErrorDetail[])
                    .concat(...error.errors.map(toErrorResponseDetails)));

        case "MultipleFamiliesRegistered":
            return serviceError(
                "Items may only be registered to one family",
                status.INVALID_ARGUMENT,
                toErrorResponseDetails(error));

        case "InclusionFamilyConflict":
            return serviceError(
                "Inclusion rules may only include items from other families",
                status.INVALID_ARGUMENT,
                toErrorResponseDetails(error));

        case "ExclusionFamilyConflict":
            return serviceError(
                "Exclusion rules may only exclude items from other families",
                status.INVALID_ARGUMENT,
                toErrorResponseDetails(error));

        case "InclusionMissingFamily":
            return serviceError(
                "Selections and inclusions in rules must be registered to one family",
                status.INVALID_ARGUMENT,
                toErrorResponseDetails(error));

        case "ExclusionMissingFamily":
            return serviceError(
                "Selections and exclusions in rules must be registered to one family",
                status.INVALID_ARGUMENT,
                toErrorResponseDetails(error));

        case "UnknownSelections":
            return serviceError(
                "Error should not have occurred",
                status.INTERNAL,
                toErrorResponseDetails(error));

        case "BadToken":
            return serviceError(
                "Catalog was not created correctly",
                status.INTERNAL,
                toErrorResponseDetails(error));
    }

    console.error(JSON.stringify(error, null, 2));
    return serviceError(
        "Unhandled error",
        status.INTERNAL,
        [
            debugInfoDetail({
                detail: JSON.stringify(error),
                stackEntriesList: []
            })
        ]);
}
