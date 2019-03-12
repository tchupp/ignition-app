use std::collections::BTreeMap;

use itertools::Itertools;

use super::Family;
use super::Item;

use self::CatalogBuilderError::{CompoundError, ExclusionFamilyConflict, ExclusionMissingFamily, InclusionFamilyConflict, InclusionMissingFamily, MultipleFamiliesRegistered};

#[derive(Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CatalogBuilderError {
    InclusionMissingFamily { item: String },
    ExclusionMissingFamily { item: String },
    MultipleFamiliesRegistered { item: String, families: Vec<String> },
    InclusionFamilyConflict { family: String, items: Vec<String> },
    ExclusionFamilyConflict { family: String, items: Vec<String> },
    CompoundError { errors: Vec<CatalogBuilderError> },
}

pub fn validate_catalog(
    contents: &BTreeMap<Family, Vec<Item>>,
    item_index: &BTreeMap<Item, Family>,
    exclusions: &BTreeMap<Item, Vec<Item>>,
    inclusions: &BTreeMap<Item, Vec<Item>>,
) -> Result<(), CatalogBuilderError> {
    let conflicts =
        vec![
            find_conflicting_families(contents, item_index),
            find_illegal_rules(
                exclusions,
                item_index,
                |family, items| ExclusionFamilyConflict { family, items },
                |item| ExclusionMissingFamily { item },
            ),
            find_illegal_rules(
                inclusions,
                item_index,
                |family, items| InclusionFamilyConflict { family, items },
                |item| InclusionMissingFamily { item },
            )
        ]
            .iter()
            .flat_map(|conflicts| conflicts)
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
    contents: &BTreeMap<Family, Vec<Item>>,
    item_index: &BTreeMap<Item, Family>,
) -> Vec<CatalogBuilderError> {
    contents.iter()
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

fn find_illegal_rules(
    rules: &BTreeMap<Item, Vec<Item>>,
    item_index: &BTreeMap<Item, Family>,
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
        .flat_map(find_selections_and_items_without_families)
        .collect::<Vec<_>>()
}