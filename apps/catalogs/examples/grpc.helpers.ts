// Builder functions for gRPC requests

import {CreateCatalogRequest, CatalogExclusionsRule, Family, CatalogInclusionsRule} from "../generated/catalogs_pb";

function buildFamily(f: Family.AsObject): Family {
    const family = new Family();
    family.setFamilyId(f.familyId);
    family.setItemsList(f.itemsList);

    return family;
}

function buildExclusion(rule: CatalogExclusionsRule.AsObject): CatalogExclusionsRule {
    const exclusion = new CatalogExclusionsRule();
    exclusion.setConditionsList(rule.conditionsList);
    exclusion.setExclusionsList(rule.exclusionsList);

    return exclusion;
}

function buildInclusion(rule: CatalogInclusionsRule.AsObject): CatalogInclusionsRule {
    const inclusion = new CatalogInclusionsRule();
    inclusion.setConditionsList(rule.conditionsList);
    inclusion.setInclusionsList(rule.inclusionsList);

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