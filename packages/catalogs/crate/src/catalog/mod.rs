use std::collections::HashMap;
use std::error::Error;

use itertools::Itertools;
use wasm_bindgen::prelude::*;
use weave::ItemStatus;
use weave::zdd2::Forest;

use types::Family;
use types::Item;

use self::CatalogError::{CompoundError, UnknownExclusions, UnknownSelections};

#[derive(Serialize, Deserialize, Debug)]
pub struct Catalog {
    combinations: Forest<Item>,
    items: HashMap<Item, Family>,
}

impl Catalog {
    pub fn new(combinations: Forest<Item>, items: HashMap<Item, Family>) -> Self {
        Catalog { combinations, items }
    }

    pub fn restrict(self, selections: &[Item], exclusions: &[Item]) -> Self {
        let combinations = self.combinations
            .subset_all(selections)
            .subset_none(exclusions);

        Catalog { combinations, items: self.items }
    }

    pub fn combinations(&self) -> Vec<Vec<Item>> {
        self.combinations.trees()
    }

    pub fn family(&self, item: &Item) -> Family {
        self.items[item].clone()
    }

    fn not_recognized(&self, items: &[Item]) -> Vec<Item> {
        items.iter()
            .filter(|&item| !self.items.contains_key(item))
            .cloned()
            .collect()
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum CatalogError {
    UnknownSelections { items: Vec<String> },
    UnknownExclusions { items: Vec<String> },
    MissingToken,
    BadState,
    BadToken { token: String, detail: String },
    CompoundError { errors: Vec<CatalogError> },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CatalogToken(String);

#[derive(Serialize, Deserialize, Debug)]
pub struct CatalogState {
    token: CatalogToken,
    selections: Vec<Item>,
    exclusions: Vec<Item>,
}

impl CatalogState {
    pub fn from_jsvalue(value: &JsValue) -> Result<Self, CatalogError> {
        value.into_serde()
            .map_err(|_| CatalogError::BadState)
    }

    pub fn from_catalog(catalog: Catalog) -> Self {
        Self {
            token: Self::catalog_to_token(&catalog),
            selections: vec![],
            exclusions: vec![],
        }
    }

    pub fn combinations(self, selections: &[Item], exclusions: &[Item]) -> Result<(Vec<Vec<Item>>, Self), CatalogError> {
        let catalog = Self::catalog_from_token(&self.token)?;

        let unknown_selections = catalog.not_recognized(selections);
        let unknown_exclusions = catalog.not_recognized(exclusions);

        let catalog = match (unknown_selections.len(), unknown_exclusions.len()) {
            (0, 0) => catalog,
            (_, 0) => return Err(UnknownSelections { items: unknown_selections }),
            (0, _) => return Err(UnknownExclusions { items: unknown_exclusions }),
            (_, _) => return Err(CompoundError {
                errors: vec![
                    UnknownSelections { items: unknown_selections },
                    UnknownExclusions { items: unknown_exclusions }]
            }),
        };

        let catalog = catalog.restrict(selections, exclusions);
        let combinations = catalog.combinations();

        let new_state = CatalogState {
            token: Self::catalog_to_token(&catalog),
            selections: Self::chain(&self.selections, selections),
            exclusions: Self::chain(&self.exclusions, exclusions),
        };

        Ok((combinations, new_state))
    }

    pub fn options(self, selections: &[Item], exclusions: &[Item]) -> Result<(HashMap<Family, Vec<ItemStatus<Item>>>, Self), CatalogError> {
        let catalog = Self::catalog_from_token(&self.token)?;

        let unknown_selections = catalog.not_recognized(selections);
        let unknown_exclusions = catalog.not_recognized(exclusions);

        let catalog = match (unknown_selections.len(), unknown_exclusions.len()) {
            (0, 0) => catalog,
            (_, 0) => return Err(UnknownSelections { items: unknown_selections }),
            (0, _) => return Err(UnknownExclusions { items: unknown_exclusions }),
            (_, _) => return Err(CompoundError {
                errors: vec![
                    UnknownSelections { items: unknown_selections },
                    UnknownExclusions { items: unknown_exclusions }]
            }),
        };

        let catalog = catalog.restrict(selections, exclusions);
        let combinations = catalog.combinations();
        let total = combinations.len();

        let selections = Self::chain(&self.selections, selections);
        let exclusions = Self::chain(&self.exclusions, exclusions);

        let options = catalog.combinations.occurrences()
            .into_iter()
            .chain(catalog.items.keys()
                .map(|f| (f.clone(), 0usize))
            )
            .unique_by(|(item, _)| item.clone())
            .map(|(item, count)| ((catalog.family(&item), item), count))
            .map(|((family, item), count)| {
                let item = if count == 0 {
                    ItemStatus::Excluded(item)
                } else if selections.contains(&item) {
                    ItemStatus::Selected(item)
                } else if count == total {
                    ItemStatus::Required(item)
                } else {
                    ItemStatus::Available(item)
                };

                (family, item)
            })
            .into_group_map::<Family, ItemStatus<Item>>();

        let new_state = CatalogState {
            token: Self::catalog_to_token(&catalog),
            selections,
            exclusions,
        };

        Ok((options, new_state))
    }

    fn catalog_from_token(catalog_token: &CatalogToken) -> Result<Catalog, CatalogError> {
        let catalog_token = &catalog_token.0;
        let decoded_token = match base64::decode(catalog_token.as_str()) {
            Ok(t) => t,
            Err(err) => return Err(CatalogError::BadToken {
                token: catalog_token.clone(),
                detail: err.description().into(),
            })
        };

        let catalog: Catalog = match bincode::deserialize(&decoded_token[..]) {
            Ok(c) => c,
            Err(err) => {
                return Err(CatalogError::BadToken {
                    token: catalog_token.clone(),
                    detail: err.description().into(),
                });
            }
        };

        Ok(catalog)
    }

    fn catalog_to_token(catalog: &Catalog) -> CatalogToken {
        let bytes = bincode::serialize(catalog).unwrap();
        CatalogToken(base64::encode(&bytes[..]))
    }

    fn chain(v1: &[Item], v2: &[Item]) -> Vec<Item> {
        v1.iter()
            .chain(v2)
            .cloned()
            .unique()
            .sorted()
            .collect()
    }
}
