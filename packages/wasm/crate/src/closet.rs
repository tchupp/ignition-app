use ignition::Closet;
use ignition::ClosetError;
use ignition::Item;
use wasm_bindgen::prelude::*;

use error::IgnitionError;
use error::IgnitionErrorDetail;

impl From<ClosetError> for IgnitionError {
    fn from(error: ClosetError) -> Self {
        match error {
            ClosetError::UnknownItems(items) => {
                let items = items.iter()
                    .map(|item| String::from(item.clone()))
                    .collect::<Vec<_>>();

                IgnitionError {
                    error: String::from("UnknownItems"),
                    description: String::from("Only known items may be selected"),
                    details: IgnitionErrorDetail::One(format!("Selected items are unknown: {:?}", items)),
                }
            }
        }
    }
}

#[wasm_bindgen(js_name = findOutfitsWasm)]
pub fn find_outfits(closet: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let closet: Closet = closet.as_string()
        .map(|bytes| base64::decode(bytes.as_str()).unwrap())
        .map(|bytes| bincode::deserialize(&bytes[..]).unwrap())
        .unwrap();

    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    let outfits = closet.outfits_with(&selections[..], &exclusions[..]);

    js_sys::Promise::resolve(&JsValue::from_serde(&outfits).unwrap())
}

#[wasm_bindgen(js_name = findOptionsWasm)]
pub fn find_options(closet: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let closet: Closet = closet.as_string()
        .map(|bytes| base64::decode(bytes.as_str()).unwrap())
        .map(|bytes| bincode::deserialize(&bytes[..]).unwrap())
        .unwrap();

    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    closet.options(&selections[..], &exclusions[..])
        .map(|options| JsValue::from_serde(&options).unwrap())
        .map(|options| js_sys::Promise::resolve(&options))
        .map_err(|err| IgnitionError::from(err))
        .map_err(|err| JsValue::from_serde(&err).unwrap())
        .unwrap_or_else(|err| js_sys::Promise::reject(&err))
}

fn to_items(items: &JsValue) -> Vec<Item> {
    let items: Vec<String> = items.into_serde().unwrap();

    items.into_iter()
        .map(|item| String::from(item.trim()))
        .filter(|item| !item.is_empty())
        .map(|item| Item::new(item))
        .collect()
}
