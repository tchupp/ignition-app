use std::collections::HashMap;
use std::str;

use bincode;
use ignition::ClosetBuilder;
use ignition::ClosetBuilderError;
use ignition::Family;
use ignition::Item;
use itertools::Itertools;
use wasm_bindgen::prelude::*;

use error::IgnitionError;
use error::IgnitionErrorDetail;

#[derive(Serialize, Deserialize)]
struct ClosetContents {
    families: HashMap<String, Vec<String>>,
    exclusions: HashMap<String, Vec<String>>,
    inclusions: HashMap<String, Vec<String>>,
}

#[wasm_bindgen(js_name = buildClosetWasm)]
pub fn build_closet(contents: &JsValue) -> js_sys::Promise {
    let contents: ClosetContents = contents.into_serde().unwrap();

    let families: HashMap<String, Vec<String>> = contents.families.clone();
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

    let exclusions: HashMap<String, Vec<String>> = contents.exclusions.clone();
    let exclusions: HashMap<Item, Vec<Item>> = exclusions.into_iter()
        .map(|(selection, exclusions)|
            (
                Item::new(selection),
                exclusions.into_iter()
                    .map(|id| Item::new(id))
                    .collect::<Vec<Item>>()
            )
        )
        .collect();

    let inclusions: HashMap<String, Vec<String>> = contents.inclusions.clone();
    let inclusions: HashMap<Item, Vec<Item>> = inclusions.into_iter()
        .map(|(selection, inclusions)|
            (
                Item::new(selection),
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
        .map(|closet| bincode::serialize(&closet).unwrap())
        .map(|closet| base64::encode(&closet[..]))
        .map(|closet| JsValue::from_str(closet.as_str()))
        .map(|closet| js_sys::Promise::resolve(&closet))
        .map_err(|err| IgnitionError::from(err))
        .map_err(|err| JsValue::from_serde(&err).unwrap())
        .unwrap_or_else(|err| js_sys::Promise::reject(&err))
}

impl From<ClosetBuilderError> for IgnitionError {
    fn from(error: ClosetBuilderError) -> Self {
        match error {
            ClosetBuilderError::CompoundError(errors) => IgnitionError {
                error: String::from("CompoundError"),
                description: String::from("Multiple errors occurred"),
                details: IgnitionErrorDetail::Many(errors.into_iter().map(IgnitionError::from).collect_vec()),
            },
            ClosetBuilderError::ConflictingFamilies(item, families) => IgnitionError {
                error: String::from("ConflictingFamilies"),
                description: String::from("Items may only be registered to one family"),
                details: IgnitionErrorDetail::One(format!("Item {:?} has multiple families: {:?}", item, families)),
            },
            ClosetBuilderError::InclusionError(family, items) => IgnitionError {
                error: String::from("InclusionError"),
                description: String::from("Inclusion rules may only contain items from other families"),
                details: IgnitionErrorDetail::One(format!("Inclusion rule has multiple items {:?} from the same family {:?}", items, family)),
            },
            ClosetBuilderError::ExclusionError(family, items) => IgnitionError {
                error: String::from("ExclusionError"),
                description: String::from("Exclusion rules may only contain items from other families"),
                details: IgnitionErrorDetail::One(format!("Exclusion rule has multiple items {:?} from the same family {:?}", items, family)),
            },
            ClosetBuilderError::MissingFamily(item) => IgnitionError {
                error: String::from("MissingFamily"),
                description: String::from("Items must be registered to exactly one family"),
                details: IgnitionErrorDetail::One(format!("Item is not registered to any family: {:?}", item)),
            },
        }
    }
}
