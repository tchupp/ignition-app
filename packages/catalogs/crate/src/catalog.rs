use std::collections::BTreeMap;
use std::error::Error;

use inner::Catalog;
use inner::CatalogError;
use inner::Family;
use inner::Item;
use wasm_bindgen::prelude::*;
use weave::ItemStatus;

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

#[wasm_bindgen(js_name = findOutfitsWasm)]
pub fn find_outfits(catalog_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    let catalog = to_catalog(catalog_token).unwrap();
    let outfits = catalog.outfits(&selections[..], &exclusions[..]).unwrap();

    js_sys::Promise::resolve(&JsValue::from_serde(&outfits).unwrap())
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

#[wasm_bindgen(js_name = findOptionsWasm)]
pub fn find_options(catalog_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    find_options_inner(catalog_token, selections, exclusions)
        .map(|options| JsValue::from_serde(&options).unwrap())
        .map(|options| js_sys::Promise::resolve(&options))
        .map_err(|err| JsValue::from_serde(&err).unwrap())
        .unwrap_or_else(|err| js_sys::Promise::reject(&err))
}

fn find_options_inner(
    catalog_token: &JsValue,
    selections: &JsValue,
    exclusions: &JsValue,
) -> Result<(Options, CatalogToken), IgnitionOptionsError> {
    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

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
    let items: Vec<String> = items.into_serde().unwrap();

    items.into_iter()
        .flat_map(|item| item.split(",").map(String::from).collect::<Vec<String>>())
        .map(|item| String::from(item.trim()))
        .filter(|item| !item.is_empty())
        .map(|item| Item::new(item))
        .collect()
}
