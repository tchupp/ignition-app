use std::collections::BTreeMap;
use std::error::Error;

use ignition::Closet;
use ignition::ClosetError;
use ignition::Family;
use ignition::Item;
use wasm_bindgen::prelude::*;
use weave::ItemStatus;

#[derive(Serialize, Deserialize, Debug)]
pub struct ClosetToken(String);

impl From<Closet> for ClosetToken {
    fn from(closet: Closet) -> Self {
        let bytes = bincode::serialize(&closet).unwrap();
        ClosetToken(base64::encode(&bytes[..]))
    }
}

impl From<ClosetToken> for JsValue {
    fn from(token: ClosetToken) -> Self {
        JsValue::from_str(token.0.as_str())
    }
}

#[wasm_bindgen(js_name = findOutfitsWasm)]
pub fn find_outfits(closet_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    let closet = to_closet(closet_token).unwrap();
    let outfits = closet.outfits(&selections[..], &exclusions[..]).unwrap();

    js_sys::Promise::resolve(&JsValue::from_serde(&outfits).unwrap())
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum IgnitionOptionsError {
    UnknownSelections { items: Vec<String> },
    MissingToken,
    BadToken { token: String, detail: String },
}

impl From<ClosetError> for IgnitionOptionsError {
    fn from(error: ClosetError) -> Self {
        match error {
            ClosetError::UnknownItems(items) => {
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
pub fn find_options(closet_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    find_options_inner(closet_token, selections, exclusions)
        .map(|options| JsValue::from_serde(&options).unwrap())
        .map(|options| js_sys::Promise::resolve(&options))
        .map_err(|err| JsValue::from_serde(&err).unwrap())
        .unwrap_or_else(|err| js_sys::Promise::reject(&err))
}

fn find_options_inner(
    closet_token: &JsValue,
    selections: &JsValue,
    exclusions: &JsValue,
) -> Result<(Options, ClosetToken), IgnitionOptionsError> {
    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    let closet = to_closet(closet_token)?;
    let closet = closet.select(&selections[..])?;
    let options = closet.options(&selections[..], &exclusions[..])?;

    Ok((options, ClosetToken::from(closet)))
}

fn to_closet(closet_token: &JsValue) -> Result<Closet, IgnitionOptionsError> {
    let closet_token = match closet_token.as_string() {
        Some(str) => str,
        None => return Err(IgnitionOptionsError::MissingToken),
    };

    let decoded_token = match base64::decode(closet_token.as_str()) {
        Ok(t) => t,
        Err(err) => return Err(IgnitionOptionsError::BadToken {
            token: closet_token,
            detail: err.description().into(),
        })
    };

    let closet: Closet = match bincode::deserialize(&decoded_token[..]) {
        Ok(c) => c,
        Err(err) => {
            return Err(IgnitionOptionsError::BadToken {
                token: closet_token,
                detail: err.description().into(),
            });
        }
    };

    Ok(closet)
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
