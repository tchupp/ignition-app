import {nomadRTE} from "@ignition/nomad";
import {CatalogExclusionRule, CatalogFamilies, CatalogInclusionRule, ItemStatus} from "@ignition/catalogs";

import {CatalogOptions, FamilyOptions, ItemOption, UpdateCatalogRequest} from "../../generated/catalogs_pb";
import {status} from "grpc";
import {CatalogsResult} from "../infrastructure/result";
import {
    badRequestDetail,
    debugInfoDetail,
    GrpcServiceError,
    GrpcServiceErrorDetail,
    resourceInfoDetail,
    serviceError
} from "../infrastructure/errors.pb";
import {updateCatalog as updateCatalogInner, UpdateCatalogError, UpdateCatalogResponse} from "./catalog.update";
import {CatalogAssembly} from "./catalog.entity";
import {defaultCatalogState} from "./catalog.state";

type ProjectId = string;
type CatalogId = string;
type FromRequest = [ProjectId, CatalogId, CatalogAssembly];

export function updateCatalog(req: UpdateCatalogRequest, timestamp: Date = new Date()): CatalogsResult<GrpcServiceError, CatalogOptions> {
    return fromRequest(req)
        .chain(([projectId, catalogId, assembly]) => updateCatalogInner(projectId, catalogId, assembly, timestamp))
        .mapLeft(toErrorResponse)
        .map(toSuccessResponse);
}

function fromRequest(req: UpdateCatalogRequest): CatalogsResult<UpdateCatalogError, FromRequest> {
    const projectId = req.getProjectId();
    const catalogId = req.getCatalogId();
    const families = req.getFamiliesList()
        .reduce((acc, rule) => ({...acc, [rule.getFamilyId()]: rule.getItemsList()}), {} as CatalogFamilies);
    const exclusions = req.getExclusionsList()
        .reduce((acc, rule) => ([...acc, {
            conditions: rule.getConditionsList(),
            exclusions: rule.getExclusionsList()
        }]), [] as CatalogExclusionRule[]);
    const inclusions = req.getInclusionsList()
        .reduce((acc, rule) => ([...acc, {
            conditions: rule.getConditionsList(),
            inclusions: rule.getInclusionsList()
        }]), [] as CatalogInclusionRule[]);

    const assembly = {
        families: families,
        exclusions: exclusions,
        inclusions: inclusions,
    };
    return nomadRTE.of([projectId, catalogId, assembly] as FromRequest);
}

function toSuccessResponse({projectId, catalogId, options}: UpdateCatalogResponse): CatalogOptions {
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
        Object.keys(options)
            .map(familyId => toFamilyOptions(familyId, options[familyId]));

    const catalogOptions = new CatalogOptions();
    catalogOptions.setOptionsList(familyOptions);
    catalogOptions.setState(defaultCatalogState(projectId, catalogId));
    return catalogOptions;
}

function toErrorResponseDetails(error: UpdateCatalogError): GrpcServiceErrorDetail[] {
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

        case "EmptyCatalog":
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

        case "UnknownExclusions":
            return [
                debugInfoDetail({
                    detail: `We should have no selections when creating a catalog, but had: [${error.items}]`,
                    stackEntriesList: []
                })
            ];

        case "UnknownItems":
            return [
                debugInfoDetail({
                    detail: `We should have no selections when creating a catalog, but had: [${error.selections}]`,
                    stackEntriesList: []
                }),
                debugInfoDetail({
                    detail: `We should have no exclusions when creating a catalog, but had: [${error.exclusions}]`,
                    stackEntriesList: []
                })
            ];

        case "BadToken":
            return [];
        case "BadState":
            return [];
    }

    console.error(JSON.stringify(error, null, 2));
    return [];
}

function toErrorResponse(error: UpdateCatalogError): GrpcServiceError {
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

        case "EmptyCatalog":
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

        case "UnknownExclusions":
            return serviceError(
                "Error should not have occurred",
                status.INTERNAL,
                toErrorResponseDetails(error));

        case "UnknownItems":
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
