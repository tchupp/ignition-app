// Builder functions for gRPC requests

import {CreateCatalogRequest, Exclusion, Family, Inclusion} from "../generated/catalogs_pb";

function buildFamily(f: Family.AsObject): Family {
    const family = new Family();
    family.setFamilyId(f.familyId);
    family.setItemsList(f.itemsList);

    return family;
}

function buildExclusion(e: Exclusion.AsObject): Exclusion {
    const exclusion = new Exclusion();
    exclusion.setSelectedItem(e.selectedItem);
    exclusion.setExclusionsList(e.exclusionsList);

    return exclusion;
}

function buildInclusion(e: Inclusion.AsObject): Inclusion {
    const inclusion = new Inclusion();
    inclusion.setSelectedItem(e.selectedItem);
    inclusion.setInclusionsList(e.inclusionsList);

    return inclusion;
}

export function buildRequest(r: CreateCatalogRequest.AsObject) {
    const req = new CreateCatalogRequest();
    req.setProjectId(r.projectId);
    req.setCatalogId(r.catalogId);
    req.setFamiliesList(r.familiesList.map(buildFamily));
    req.setInclusionsList(r.inclusionsList.map(buildInclusion));
    req.setExclusionsList(r.exclusionsList.map(buildExclusion));

    return req;
}