use std::collections::{BTreeMap, HashMap};
use std::error::Error;

use itertools::Itertools;
use serde::{Serialize, Serializer};
use wasm_bindgen::prelude::*;
use weave::zdd2::Forest;

use types::Family;
use types::Item;
use types::ItemStatus;

use self::CatalogError::{UnknownExclusions, UnknownItems, UnknownSelections};

#[derive(Serialize, Deserialize, Debug)]
pub struct Catalog {
    combinations: Forest<Item>,
    #[serde(serialize_with = "ordered_map")]
    items: HashMap<Item, Family>,
}

fn ordered_map<S: Serializer>(value: &HashMap<Item, Family>, serializer: S) -> Result<S::Ok, S::Error> {
    let ordered: BTreeMap<_, _> = value.iter().collect();
    ordered.serialize(serializer)
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

    pub fn item_occurrences<'a>(&'a self) -> impl Iterator<Item=(Family, (Item, usize))> + 'a {
        self.combinations.occurrences()
            .into_iter()
            .map(move |(item, count)| {
                let family = self.items[&item].clone();

                (family, (item, count))
            })
            .chain(self.items.iter()
                .map(|(item, family)| (family.clone(), (item.clone(), 0usize)))
            )
            .unique_by(|(_, (item, _))| item.clone())
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
    UnknownSelections { items: Vec<Item> },
    UnknownExclusions { items: Vec<Item> },
    BadState,
    BadToken { token: String, detail: String },
    UnknownItems { selections: Vec<Item>, exclusions: Vec<Item> },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CatalogToken(String);

#[derive(Serialize, Deserialize, Debug)]
pub struct CatalogState {
    token: CatalogToken,
    selections: Vec<Item>,
    exclusions: Vec<Item>,
}

pub type OptionsByFamily = BTreeMap<Family, Vec<ItemStatus<Item>>>;

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
        Self::validate_selections_and_exclusions(&catalog, selections, exclusions)?;

        let catalog = catalog.restrict(selections, exclusions);
        let combinations = catalog.combinations();

        let new_state = CatalogState {
            token: Self::catalog_to_token(&catalog),
            selections: Self::chain(&self.selections, selections),
            exclusions: Self::chain(&self.exclusions, exclusions),
        };

        Ok((combinations, new_state))
    }

    pub fn options(self, selections: &[Item], exclusions: &[Item]) -> Result<(OptionsByFamily, Self), CatalogError> {
        let catalog = Self::catalog_from_token(&self.token)?;
        Self::validate_selections_and_exclusions(&catalog, selections, exclusions)?;

        let catalog = catalog.restrict(selections, exclusions);
        let total = catalog.combinations.len();

        let selections = Self::chain(&self.selections, selections);
        let exclusions = Self::chain(&self.exclusions, exclusions);

        let options = catalog.item_occurrences()
            .map(|(family, (item, count))| {
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
            .into_group_map::<Family, ItemStatus<Item>>()
            .into_iter()
            .collect::<BTreeMap<_, _>>();

        let new_state = CatalogState {
            token: Self::catalog_to_token(&catalog),
            selections,
            exclusions,
        };

        Ok((options, new_state))
    }

    pub fn catalog_from_token(catalog_token: &CatalogToken) -> Result<Catalog, CatalogError> {
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

    fn validate_selections_and_exclusions(catalog: &Catalog, selections: &[Item], exclusions: &[Item]) -> Result<(), CatalogError> {
        let unknown_selections = catalog.not_recognized(selections);
        let unknown_exclusions = catalog.not_recognized(exclusions);

        match (unknown_selections.len(), unknown_exclusions.len()) {
            (0, 0) => Ok(()),
            (_, 0) => Err(UnknownSelections { items: unknown_selections }),
            (0, _) => Err(UnknownExclusions { items: unknown_exclusions }),
            (_, _) => Err(UnknownItems {
                selections: unknown_selections,
                exclusions: unknown_exclusions,
            }),
        }
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
