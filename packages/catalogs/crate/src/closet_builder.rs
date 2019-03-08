use std::collections::HashMap;
use std::str;

use ignition::ClosetBuilder;
use ignition::ClosetBuilderError;
use ignition::Family;
use ignition::Item;
use wasm_bindgen::prelude::*;

use super::closet::ClosetToken;

#[derive(Serialize, Deserialize)]
struct CatalogAssembly {
    families: HashMap<String, Vec<String>>,
    exclusions: Vec<CatalogExclusionRule>,
    inclusions: Vec<CatalogInclusionRule>,
}

#[derive(Serialize, Deserialize)]
struct CatalogExclusionRule {
    conditions: Vec<String>,
    exclusions: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct CatalogInclusionRule {
    conditions: Vec<String>,
    inclusions: Vec<String>,
}

#[wasm_bindgen(js_name = buildClosetWasm)]
pub fn build_closet(contents: &JsValue) -> js_sys::Promise {
    let CatalogAssembly { families, exclusions, inclusions } = contents.into_serde().unwrap();

    let families: HashMap<Family, Vec<Item>> = families.into_iter()
        .map(|(family, items)|
            (
                Family::new(family),
                items.into_iter()
                    .map(|id| Item::new(id))
                    .collect::<Vec<Item>>()
            )
        )
        .collect();

    let exclusions: HashMap<Item, Vec<Item>> = exclusions.into_iter()
        .map(|CatalogExclusionRule { conditions, exclusions }|
            (
                Item::new(conditions[0].clone()),
                exclusions.into_iter()
                    .map(|id| Item::new(id.clone()))
                    .collect::<Vec<Item>>()
            )
        )
        .collect();

    let inclusions: HashMap<Item, Vec<Item>> = inclusions.into_iter()
        .map(|CatalogInclusionRule { conditions, inclusions }|
            (
                Item::new(conditions[0].clone()),
                inclusions.into_iter()
                    .map(|id| Item::new(id))
                    .collect::<Vec<Item>>()
            )
        )
        .collect();

    let closet_builder = families.iter()
        .fold(ClosetBuilder::new(), |closet_builder, (family, items)| closet_builder.add_items(&family, items));

    let closet_builder = exclusions.iter()
        .fold(closet_builder, |closet_builder, (selection, exclusions)| closet_builder.add_exclusion_rules(&selection, exclusions));

    let closet_builder = inclusions.iter()
        .fold(closet_builder, |closet_builder, (selection, inclusions)| closet_builder.add_inclusion_rules(&selection, inclusions));

    closet_builder.build()
        .map(|closet| ClosetToken::from(closet))
        .map(|token| token.into())
        .map(|closet| js_sys::Promise::resolve(&closet))
        .map_err(|err| CatalogBuilderError::from(err))
        .map_err(|err| JsValue::from_serde(&err).unwrap())
        .unwrap_or_else(|err| js_sys::Promise::reject(&err))
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CatalogBuilderError {
    InclusionMissingFamily { item: String },
    ExclusionMissingFamily { item: String },
    MultipleFamiliesRegistered { item: String, families: Vec<String> },
    InclusionFamilyConflict { family: String, items: Vec<String> },
    ExclusionFamilyConflict { family: String, items: Vec<String> },
    CompoundError { errors: Vec<CatalogBuilderError> },
}

impl From<ClosetBuilderError> for CatalogBuilderError {
    fn from(error: ClosetBuilderError) -> Self {
        match error {
            ClosetBuilderError::CompoundError(errors) =>
                CatalogBuilderError::CompoundError {
                    errors: errors.into_iter().map(CatalogBuilderError::from).collect()
                },
            ClosetBuilderError::MultipleFamiliesRegistered(item, families) =>
                CatalogBuilderError::MultipleFamiliesRegistered {
                    item: String::from(item),
                    families: families.into_iter().map(String::from).collect(),
                },
            ClosetBuilderError::InclusionFamilyConflict(family, items) =>
                CatalogBuilderError::InclusionFamilyConflict {
                    family: String::from(family),
                    items: items.into_iter().map(String::from).collect(),
                },
            ClosetBuilderError::ExclusionFamilyConflict(family, items) =>
                CatalogBuilderError::ExclusionFamilyConflict {
                    family: String::from(family),
                    items: items.into_iter().map(String::from).collect(),
                },
            ClosetBuilderError::InclusionMissingFamily(item) =>
                CatalogBuilderError::InclusionMissingFamily {
                    item: String::from(item)
                },
            ClosetBuilderError::ExclusionMissingFamily(item) =>
                CatalogBuilderError::ExclusionMissingFamily {
                    item: String::from(item)
                },
        }
    }
}
