use std::collections::BTreeMap;
use std::collections::BTreeSet;

use itertools::Itertools;
use weave::ItemStatus;
use weave::zdd::Tree;

use super::Family;
use super::Item;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct Catalog {
    tree: Tree<Item>,
    item_index: BTreeMap<Item, Family>,
    selections: Vec<Item>,
    exclusions: Vec<Item>,
}

#[derive(Debug, Eq, PartialEq)]
pub enum CatalogError {
    UnknownItems(Vec<Item>),
}

impl Catalog {
    pub fn new(tree: Tree<Item>, item_index: BTreeMap<Item, Family>, selections: Vec<Item>, exclusions: Vec<Item>) -> Catalog {
        Catalog { tree, item_index, selections, exclusions }
    }

    pub fn select(&self, selections: &[Item]) -> Result<Catalog, CatalogError> {
        self.find_unknown_items(&[selections])?;

        let selections: Vec<Item> = chain(&self.selections[..], selections);

        let catalog = Catalog::new(self.tree.clone(), self.item_index.clone(), selections, vec![]);
        Ok(catalog)
    }

    pub fn outfits(&self, selections: &[Item], exclusions: &[Item]) -> Result<BTreeSet<BTreeSet<Item>>, CatalogError> {
        self.find_unknown_items(&[selections, exclusions])?;

        let selections: Vec<Item> = chain(&self.selections[..], selections);

        Ok(self.tree.combinations_with(&selections[..], exclusions))
    }

    pub fn options(&self, selections: &[Item], exclusions: &[Item]) -> Result<BTreeMap<Family, Vec<ItemStatus<Item>>>, CatalogError> {
        self.find_unknown_items(&[selections, exclusions])?;

        let selections: Vec<Item> = chain(&self.selections[..], selections);

        let summary = self.tree.summarize(&selections[..], exclusions)
            .into_iter()
            .map(|status| (&self.item_index[status.item()], status))
            .fold(BTreeMap::new(), |mut duplicates: BTreeMap<Family, Vec<ItemStatus<Item>>>, (family, status): (&Family, ItemStatus<Item>)| {
                duplicates.entry(family.clone()).or_insert_with(|| vec![]).push(status);
                duplicates
            });

        Ok(summary)
    }

    fn find_unknown_items(&self, items: &[&[Item]]) -> Result<(), CatalogError> {
        let unknown_items = items.iter()
            .flat_map(|items| items.iter())
            .filter(|item| self.item_index.get(item).is_none())
            .cloned()
            .collect::<Vec<_>>();

        if !unknown_items.is_empty() {
            return Err(CatalogError::UnknownItems(unknown_items));
        }
        Ok(())
    }
}

fn chain(v1: &[Item], v2: &[Item]) -> Vec<Item> {
    v1.iter()
        .chain(v2)
        .cloned()
        .unique()
        .sorted()
        .collect_vec()
}

#[cfg(test)]
mod options_tests {
    use weave::ItemStatus;

    use super::super::CatalogBuilder;

    use super::CatalogError;
    use super::Family;
    use super::Item;

    #[test]
    fn options_with_empty_selections_has_all_options_available() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let options = catalog.options(&[], &[]).unwrap();
        assert_eq!(
            btreemap! {
                shirts => vec![
                    ItemStatus::Available(blue),
                    ItemStatus::Available(red),
                ],
                pants => vec![
                    ItemStatus::Available(jeans),
                    ItemStatus::Available(slacks),
                ]
            },
            options
        );
    }

    #[test]
    fn options_with_one_selection_has_correct_options() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let options = catalog.options(&[red.clone()], &[]).unwrap();
        assert_eq!(
            btreemap! {
                shirts.clone() => vec![
                    ItemStatus::Excluded(blue.clone()),
                    ItemStatus::Selected(red.clone()),
                ],
                pants.clone() => vec![
                    ItemStatus::Required(slacks.clone()),
                    ItemStatus::Excluded(jeans.clone()),
                ]
            },
            options
        );

        let options = catalog.options(&[blue.clone()], &[]).unwrap();
        assert_eq!(
            btreemap! {
                shirts.clone() => vec![
                    ItemStatus::Excluded(red.clone()),
                    ItemStatus::Selected(blue.clone()),
                ],
                pants.clone() => vec![
                    ItemStatus::Available(jeans.clone()),
                    ItemStatus::Available(slacks.clone()),
                ]
            },
            options
        );
    }

    #[test]
    fn options_with_red_excluded_has_correct_options() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let options = catalog.options(&[], &[red.clone()]).unwrap();
        assert_eq!(
            btreemap! {
                shirts.clone() => vec![
                    ItemStatus::Required(blue.clone()),
                    ItemStatus::Excluded(red.clone()),
                ],
                pants.clone() => vec![
                    ItemStatus::Available(jeans.clone()),
                    ItemStatus::Available(slacks.clone()),
                ]
            },
            options
        );

        let options = catalog.options(&[], &[blue.clone()]).unwrap();
        assert_eq!(
            btreemap! {
                shirts.clone() => vec![
                    ItemStatus::Required(red.clone()),
                    ItemStatus::Excluded(blue.clone()),
                ],
                pants.clone() => vec![
                    ItemStatus::Required(slacks.clone()),
                    ItemStatus::Excluded(jeans.clone()),
                ]
            },
            options
        );
    }

    #[test]
    fn options_with_unknown_selection_returns_error() {
        let black = Item::new("shirts:black");
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let options = catalog.options(&[black.clone()], &[]).unwrap_err();
        assert_eq!(
            CatalogError::UnknownItems(vec![black.clone()]),
            options
        );
    }

    #[test]
    fn options_with_unknown_exclusion_returns_error() {
        let black = Item::new("shirts:black");
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let options = catalog.options(&[], &[black.clone()]).unwrap_err();
        assert_eq!(
            CatalogError::UnknownItems(vec![black.clone()]),
            options
        );
    }
}

#[cfg(test)]
mod outfits_tests {
    use super::CatalogError;
    use super::super::CatalogBuilder;

    use super::Family;
    use super::Item;

    #[test]
    fn outfits_with_empty_selections_has_all_outfits_available() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let outfits = catalog.outfits(&[], &[]).unwrap();
        assert_eq!(
            btreeset!(
                btreeset!(blue.clone(), jeans.clone()),
                btreeset!(red.clone(), slacks.clone()),
                btreeset!(blue.clone(), slacks.clone()),
            ),
            outfits
        );
    }

    #[test]
    fn outfits_with_one_selection_has_correct_outfits() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let outfits = catalog.outfits(&[red.clone()], &[]).unwrap();
        assert_eq!(
            btreeset!(
                btreeset!(red.clone(), slacks.clone()),
            ),
            outfits
        );

        let outfits = catalog.outfits(&[blue.clone()], &[]).unwrap();
        assert_eq!(
            btreeset!(
                btreeset!(blue.clone(), jeans.clone()),
                btreeset!(blue.clone(), slacks.clone()),
            ),
            outfits
        );
    }

    #[test]
    fn outfits_with_red_excluded_has_correct_outfits() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let outfits = catalog.outfits(&[], &[red.clone()]).unwrap();
        assert_eq!(
            btreeset!(
                btreeset!(blue.clone(), jeans.clone()),
                btreeset!(blue.clone(), slacks.clone()),
            ),
            outfits
        );

        let outfits = catalog.outfits(&[], &[blue.clone()]).unwrap();
        assert_eq!(
            btreeset!(
                btreeset!(red.clone(), slacks.clone()),
            ),
            outfits
        );
    }

    #[test]
    fn outfits_with_unknown_selection_returns_error() {
        let black = Item::new("shirts:black");
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let outfits = catalog.outfits(&[black.clone()], &[]).unwrap_err();
        assert_eq!(
            CatalogError::UnknownItems(vec![black.clone()]),
            outfits
        );
    }

    #[test]
    fn outfits_with_unknown_exclusion_returns_error() {
        let black = Item::new("shirts:black");
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let outfits = catalog.outfits(&[], &[black.clone()]).unwrap_err();
        assert_eq!(
            CatalogError::UnknownItems(vec![black.clone()]),
            outfits
        );
    }
}

#[cfg(test)]
mod select_tests {
    use super::Catalog;
    use super::CatalogError;
    use super::super::CatalogBuilder;

    use super::Family;
    use super::Item;

    #[test]
    fn order_doesnt_matter_when_selecting_multiple() {
        let red = Item::new("shirts:red");
        let jeans = Item::new("pants:jeans");
        let catalog = build_catalog();

        let catalog1 = catalog.select(&[red.clone(), jeans.clone()]).unwrap();
        let catalog2 = catalog.select(&[jeans.clone(), red.clone()]).unwrap();
        assert_eq!(
            catalog1,
            catalog2
        );
    }

    #[test]
    fn selecting_duplicates_doesnt_matter() {
        let red = Item::new("shirts:red");
        let catalog = build_catalog();

        let catalog1 = catalog.select(&[red.clone(), red.clone()]).unwrap();
        let catalog2 = catalog.select(&[red.clone()]).unwrap();
        assert_eq!(
            catalog1,
            catalog2
        );
    }

    #[test]
    fn selecting_red_is_the_same_as_filtering_outfits() {
        let red = Item::new("shirts:red");

        let catalog_pre = build_catalog();
        let outfits_pre = catalog_pre.outfits(&[red.clone()], &[]);
        let options_pre = catalog_pre.options(&[red.clone()], &[]);

        let catalog = catalog_pre.select(&[red.clone()]).unwrap();
        let outfits = catalog.outfits(&[], &[]);
        let options = catalog.options(&[], &[]);

        assert_eq!(
            outfits_pre,
            outfits
        );
        assert_eq!(
            options_pre,
            options
        );
    }

    #[test]
    fn selecting_multiple_is_the_same_as_filtering_outfits() {
        let red = Item::new("shirts:red");
        let slacks = Item::new("pants:slacks");

        let catalog_pre = build_catalog();
        let outfits_pre = catalog_pre.outfits(&[red.clone(), slacks.clone()], &[]);
        let options_pre = catalog_pre.options(&[red.clone(), slacks.clone()], &[]);

        let catalog = catalog_pre.select(&[red.clone(), slacks.clone()]).unwrap();
        let outfits = catalog.outfits(&[], &[]);
        let options = catalog.options(&[], &[]);

        assert_eq!(
            outfits_pre,
            outfits
        );
        assert_eq!(
            options_pre,
            options
        );
    }

    #[test]
    fn selecting_black_returns_an_error() {
        let black = Item::new("shirts:black");

        let catalog = build_catalog();

        let outfits = catalog.select(&[black.clone()]).unwrap_err();
        assert_eq!(
            CatalogError::UnknownItems(vec![black.clone()]),
            outfits
        );
    }

    fn build_catalog() -> Catalog {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_item(&shirts, &red)
            .add_item(&shirts, &blue)
            .add_item(&pants, &slacks)
            .add_item(&pants, &jeans)
            .add_exclusion_rule(&red, &jeans);

        catalog_builder.build()
            .expect("expected build to return Catalog")
    }
}
