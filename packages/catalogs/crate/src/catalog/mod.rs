use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;

use wasm_bindgen::prelude::*;
use weave::ItemStatus;

use inner::Catalog;
use inner::CatalogError;
use inner::Family;
use inner::Item;

#[derive(Serialize, Deserialize, Debug)]
pub struct CatalogToken(String);

impl From<Catalog> for CatalogToken {
    fn from(catalog: Catalog) -> Self {
        let bytes = bincode::serialize(&catalog).unwrap();
        CatalogToken(base64::encode(&bytes[..]))
    }
}

impl From<CatalogToken> for JsValue {
    fn from(token: CatalogToken) -> Self {
        JsValue::from_str(token.0.as_str())
    }
}

type Outfits = BTreeSet<BTreeSet<Item>>;

pub fn find_outfits(
    catalog_token: &JsValue,
    selections: Vec<Item>,
    exclusions: Vec<Item>,
) -> Result<Outfits, IgnitionOptionsError> {
    let catalog = to_catalog(catalog_token)?;
    let outfits = catalog.outfits(&selections[..], &exclusions[..])?;

    Ok(outfits)
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum IgnitionOptionsError {
    UnknownSelections { items: Vec<String> },
    MissingToken,
    BadToken { token: String, detail: String },
}

impl From<CatalogError> for IgnitionOptionsError {
    fn from(error: CatalogError) -> Self {
        match error {
            CatalogError::UnknownItems(items) => {
                let items = items.iter()
                    .map(|item| String::from(item.clone()))
                    .collect::<Vec<_>>();

                IgnitionOptionsError::UnknownSelections {
                    items: items.into_iter().map(String::from).collect()
                }
            }
        }
    }
}

type Options = BTreeMap<Family, Vec<ItemStatus<Item>>>;

pub fn find_options(
    catalog_token: &JsValue,
    selections: Vec<Item>,
    exclusions: Vec<Item>,
) -> Result<(Options, CatalogToken), IgnitionOptionsError> {
    let catalog = to_catalog(catalog_token)?;
    let catalog = catalog.select(&selections[..])?;
    let options = catalog.options(&selections[..], &exclusions[..])?;

    Ok((options, CatalogToken::from(catalog)))
}

fn to_catalog(catalog_token: &JsValue) -> Result<Catalog, IgnitionOptionsError> {
    let catalog_token = match catalog_token.as_string() {
        Some(str) => str,
        None => return Err(IgnitionOptionsError::MissingToken),
    };

    let decoded_token = match base64::decode(catalog_token.as_str()) {
        Ok(t) => t,
        Err(err) => return Err(IgnitionOptionsError::BadToken {
            token: catalog_token,
            detail: err.description().into(),
        })
    };

    let catalog: Catalog = match bincode::deserialize(&decoded_token[..]) {
        Ok(c) => c,
        Err(err) => {
            return Err(IgnitionOptionsError::BadToken {
                token: catalog_token,
                detail: err.description().into(),
            });
        }
    };

    Ok(catalog)
}

fn to_items(items: &JsValue) -> Vec<Item> {
    let items: Vec<Item> = items.into_serde().unwrap();

    items.into_iter()
        .flat_map(|item| item.split(",").map(String::from).collect::<Vec<String>>())
        .map(|item| String::from(item.trim()))
        .filter(|item| !item.is_empty())
        .collect()
}
