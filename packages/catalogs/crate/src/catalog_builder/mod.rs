use std::collections::HashMap;
use std::str;

use inner::CatalogBuilder;
use inner::Family;
use inner::Item;
use wasm_bindgen::prelude::*;

use super::catalog::CatalogToken;
use inner;

#[derive(Serialize, Deserialize)]
struct CatalogAssembly {
    families: HashMap<Family, Vec<Item>>,
    exclusions: Vec<CatalogExclusionRule>,
    inclusions: Vec<CatalogInclusionRule>,
}

#[derive(Serialize, Deserialize)]
struct CatalogExclusionRule {
    conditions: Vec<Item>,
    exclusions: Vec<Item>,
}

#[derive(Serialize, Deserialize)]
struct CatalogInclusionRule {
    conditions: Vec<Item>,
    inclusions: Vec<Item>,
}

pub fn build_catalog(assembly: &JsValue) -> Result<CatalogToken, CatalogBuilderError> {
    let CatalogAssembly { families, exclusions, inclusions } = assembly.into_serde().unwrap();

    let exclusions: HashMap<Item, Vec<Item>> = exclusions.into_iter()
        .map(|CatalogExclusionRule { conditions, exclusions }|
            (
                conditions[0].clone(),
                exclusions
            )
        )
        .collect();

    let inclusions: HashMap<Item, Vec<Item>> = inclusions.into_iter()
        .map(|CatalogInclusionRule { conditions, inclusions }|
            (
                conditions[0].clone(),
                inclusions
            )
        )
        .collect();

    let catalog_builder = families.iter()
        .fold(CatalogBuilder::new(), |catalog_builder, (family, items)| catalog_builder.add_items(&family, items));

    let catalog_builder = exclusions.iter()
        .fold(catalog_builder, |catalog_builder, (selection, exclusions)| catalog_builder.add_exclusion_rules(&selection, exclusions));

    let catalog_builder = inclusions.iter()
        .fold(catalog_builder, |catalog_builder, (selection, inclusions)| catalog_builder.add_inclusion_rules(&selection, inclusions));

    catalog_builder.build()
        .map(|catalog| CatalogToken::from(catalog))
        .map_err(|err| CatalogBuilderError::from(err))
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

impl From<inner::CatalogBuilderError> for CatalogBuilderError {
    fn from(error: inner::CatalogBuilderError) -> Self {
        match error {
            inner::CatalogBuilderError::CompoundError(errors) =>
                CatalogBuilderError::CompoundError {
                    errors: errors.into_iter().map(CatalogBuilderError::from).collect()
                },
            inner::CatalogBuilderError::MultipleFamiliesRegistered(item, families) =>
                CatalogBuilderError::MultipleFamiliesRegistered {
                    item: String::from(item),
                    families: families.into_iter().map(String::from).collect(),
                },
            inner::CatalogBuilderError::InclusionFamilyConflict(family, items) =>
                CatalogBuilderError::InclusionFamilyConflict {
                    family: String::from(family),
                    items: items.into_iter().map(String::from).collect(),
                },
            inner::CatalogBuilderError::ExclusionFamilyConflict(family, items) =>
                CatalogBuilderError::ExclusionFamilyConflict {
                    family: String::from(family),
                    items: items.into_iter().map(String::from).collect(),
                },
            inner::CatalogBuilderError::InclusionMissingFamily(item) =>
                CatalogBuilderError::InclusionMissingFamily {
                    item: String::from(item)
                },
            inner::CatalogBuilderError::ExclusionMissingFamily(item) =>
                CatalogBuilderError::ExclusionMissingFamily {
                    item: String::from(item)
                },
        }
    }
}
