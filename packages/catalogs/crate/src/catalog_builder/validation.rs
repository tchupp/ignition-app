use std::collections::{BTreeMap, HashMap};

use itertools::Itertools;

use catalog_builder::CatalogRule;
use types::{Family, Item};

use super::{CatalogExclusionRule, CatalogInclusionRule};

use self::CatalogBuilderError::{CompoundError, ExclusionFamilyConflict, ExclusionMissingFamily, InclusionFamilyConflict, InclusionMissingFamily, MultipleFamiliesRegistered};

#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CatalogBuilderError {
    EmptyCatalog,
    InclusionMissingFamily { item: String },
    ExclusionMissingFamily { item: String },
    InclusionMissingCondition,
    ExclusionMissingCondition,
    MultipleFamiliesRegistered { item: String, families: Vec<String> },
    InclusionFamilyConflict { family: String, items: Vec<String> },
    ExclusionFamilyConflict { family: String, items: Vec<String> },
    CompoundError { errors: Vec<CatalogBuilderError> },
}

pub fn validate_catalog(
    families: &BTreeMap<Family, Vec<Item>>,
    item_index: &HashMap<Item, Family>,
    exclusions: &[CatalogExclusionRule],
    inclusions: &[CatalogInclusionRule],
) -> Result<(), CatalogBuilderError> {
    let conflicts =
        vec![
            find_conflicting_families(families, item_index),
            find_illegal_conditions(exclusions, CatalogBuilderError::ExclusionMissingCondition),
            find_illegal_conditions(inclusions, CatalogBuilderError::InclusionMissingCondition),
            find_illegal_exclusion_rules(
                exclusions,
                item_index,
                |family, items| ExclusionFamilyConflict { family, items },
                |item| ExclusionMissingFamily { item },
            ),
            find_illegal_inclusion_rules(
                inclusions,
                item_index,
                |family, items| InclusionFamilyConflict { family, items },
                |item| InclusionMissingFamily { item },
            )
        ]
            .iter()
            .flatten()
            .unique()
            .cloned()
            .collect::<Vec<_>>();

    match conflicts.len() {
        0 => Ok(()),
        1 => Err(conflicts[0].clone()),
        _ => Err(CompoundError { errors: conflicts }),
    }
}

fn find_conflicting_families(
    families: &BTreeMap<Family, Vec<Item>>,
    item_index: &HashMap<Item, Family>,
) -> Vec<CatalogBuilderError> {
    families.iter()
        .flat_map(|(family, items)| {
            items.iter()
                .filter_map(|item| {
                    let item_family = match item_index.get(item) {
                        None => panic!("illegal state! we should never had an item in the index with no family"),
                        Some(item_family) => item_family,
                    };

                    if item_family != family {
                        Some(MultipleFamiliesRegistered { item: item.clone(), families: vec![item_family.clone(), family.clone()] })
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<CatalogBuilderError>>()
}

fn find_illegal_conditions<R: CatalogRule>(rules: &[R], error: CatalogBuilderError) -> Vec<CatalogBuilderError> {
    if rules.iter().any(|rule| !rule.has_conditions()) {
        vec![error]
    } else {
        vec![]
    }
}

fn find_illegal_exclusion_rules(
    rules: &[CatalogExclusionRule],
    item_index: &HashMap<Item, Family>,
    conflict_error: fn(Family, Vec<Item>) -> CatalogBuilderError,
    missing_family_error: fn(Item) -> CatalogBuilderError,
) -> Vec<CatalogBuilderError> {
    let find_selections_and_items_without_families = |(selection, items): (&Item, &Vec<Item>)| {
        let selection_family = match item_index.get(selection) {
            None => return vec![missing_family_error(selection.clone())],
            Some(selection_family) => selection_family,
        };

        items.iter()
            .filter_map(|item| {
                let item_family = match item_index.get(item) {
                    None => return Some(missing_family_error(item.clone())),
                    Some(item_family) => item_family,
                };

                if selection_family == item_family {
                    let mut items = vec![selection.clone(), item.clone()];
                    items.sort();

                    Some(conflict_error(selection_family.clone(), items))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
    };

    rules.iter()
        .flat_map(|rule| rule.conditions.iter().map(|selection| (selection, &rule.exclusions)).collect::<Vec<_>>())
        .flat_map(find_selections_and_items_without_families)
        .collect::<Vec<_>>()
}

fn find_illegal_inclusion_rules(
    rules: &[CatalogInclusionRule],
    item_index: &HashMap<Item, Family>,
    conflict_error: fn(Family, Vec<Item>) -> CatalogBuilderError,
    missing_family_error: fn(Item) -> CatalogBuilderError,
) -> Vec<CatalogBuilderError> {
    let find_selections_and_items_without_families = |(selection, items): (&Item, &Vec<Item>)| {
        let selection_family = match item_index.get(selection) {
            None => return vec![missing_family_error(selection.clone())],
            Some(selection_family) => selection_family,
        };

        items.iter()
            .filter_map(|item| {
                let item_family = match item_index.get(item) {
                    None => return Some(missing_family_error(item.clone())),
                    Some(item_family) => item_family,
                };

                if selection_family == item_family {
                    let mut items = vec![selection.clone(), item.clone()];
                    items.sort();

                    Some(conflict_error(selection_family.clone(), items))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
    };

    rules.iter()
        .flat_map(|rule| rule.conditions.iter().map(|selection| (selection, &rule.inclusions)).collect::<Vec<_>>())
        .flat_map(find_selections_and_items_without_families)
        .collect::<Vec<_>>()
}