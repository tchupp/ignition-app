extern crate base64;
extern crate bincode;
extern crate cfg_if;
extern crate itertools;
extern crate js_sys;
#[cfg(test)]
#[macro_use]
extern crate maplit;
extern crate reduce;
#[macro_use]
extern crate serde_derive;
extern crate wasm_bindgen;
extern crate weave;

use wasm_bindgen::prelude::*;

use catalog::CatalogToken;
use catalog_builder::CatalogAssembly;
use inner::Item;

mod catalog;
mod catalog_builder;
mod utils;
mod inner;

#[wasm_bindgen(js_name = findOutfitsWasm)]
pub fn find_outfits(catalog_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    catalog::find_outfits(catalog_token, selections, exclusions)
        .into_promise()
}

#[wasm_bindgen(js_name = findOptionsWasm)]
pub fn find_options(catalog_token: &JsValue, selections: &JsValue, exclusions: &JsValue) -> js_sys::Promise {
    let selections: Vec<Item> = to_items(selections);
    let exclusions: Vec<Item> = to_items(exclusions);

    catalog::find_options(catalog_token, selections, exclusions)
        .into_promise()
}

#[wasm_bindgen(js_name = buildCatalogWasm)]
pub fn build_catalog(assembly: &JsValue) -> js_sys::Promise {
    let assembly: CatalogAssembly = assembly.into_serde().unwrap();
    catalog_builder::build_catalog(assembly)
        .map(|catalog| CatalogToken::from(catalog))
        .into_promise()
}

fn to_items(items: &JsValue) -> Vec<Item> {
    let items: Vec<Item> = items.into_serde().unwrap();

    items.into_iter()
        .flat_map(|item| item.split(",").map(String::from).collect::<Vec<String>>())
        .map(|item| String::from(item.trim()))
        .filter(|item| !item.is_empty())
        .collect()
}

trait IntoPromise {
    fn into_promise(self) -> js_sys::Promise;
}

impl<T, E> IntoPromise for Result<T, E>
    where
        T: serde::Serialize,
        E: serde::Serialize
{
    fn into_promise(self) -> js_sys::Promise {
        self
            .map(|res| JsValue::from_serde(&res).unwrap())
            .map(|res| js_sys::Promise::resolve(&res))
            .map_err(|err| JsValue::from_serde(&err).unwrap())
            .unwrap_or_else(|err| js_sys::Promise::reject(&err))
    }
}