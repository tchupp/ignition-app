use std::collections::HashMap;
use std::str;

use wasm_bindgen::prelude::*;

use inner::CatalogBuilder;
use inner::CatalogBuilderError;
use inner::Family;
use inner::Item;

use super::catalog::CatalogToken;

mod validation;

#[derive(Serialize, Deserialize)]
pub struct CatalogAssembly {
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

pub fn build_catalog(CatalogAssembly { families, exclusions, inclusions }: CatalogAssembly) -> Result<CatalogToken, CatalogBuilderError> {
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
