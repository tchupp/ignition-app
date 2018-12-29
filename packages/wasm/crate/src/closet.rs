use std::error::Error;

use ignition::Closet;
use ignition::ClosetError;
use ignition::Item;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = findOutfitsWasm)]
pub fn find_outfits(closet_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let closet: Closet = closet_token.as_string()
        .map(|bytes| base64::decode(bytes.as_str()).unwrap())
        .map(|bytes| bincode::deserialize(&bytes[..]).unwrap())
        .unwrap();

    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    let outfits = closet.outfits_with(&selections[..], &exclusions[..]);

    js_sys::Promise::resolve(&JsValue::from_serde(&outfits).unwrap())
}

#[derive(Serialize, Deserialize)]
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

#[wasm_bindgen(js_name = findOptionsWasm)]
pub fn find_options(closet_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let closet = to_closet(closet_token);

    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    closet.and_then(|closet|
        closet.options(&selections[..], &exclusions[..])
            .map_err(|err| IgnitionOptionsError::from(err)))
        .map(|options| JsValue::from_serde(&options).unwrap())
        .map(|options| js_sys::Promise::resolve(&options))
        .map_err(|err| JsValue::from_serde(&err).unwrap())
        .unwrap_or_else(|err| js_sys::Promise::reject(&err))
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
        .map(|item| String::from(item.trim()))
        .filter(|item| !item.is_empty())
        .map(|item| Item::new(item))
        .collect()
}
