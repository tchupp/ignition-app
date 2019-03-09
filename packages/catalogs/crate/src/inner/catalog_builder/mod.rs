use std::collections::BTreeMap;
use std::collections::BTreeSet;

use itertools::Itertools;
use weave::zdd::Tree;
use weave::zdd::Universe;

use super::Catalog;
use super::Family;
use super::Item;

pub use self::validation::CatalogBuilderError;

mod validation;

#[derive(Debug, Clone, PartialEq, Default)]
pub struct CatalogBuilder {
    contents: BTreeMap<Family, Vec<Item>>,
    item_index: BTreeMap<Item, Family>,
    exclusions: BTreeMap<Item, Vec<Item>>,
    inclusions: BTreeMap<Item, Vec<Item>>,
}

impl CatalogBuilder {
    pub fn new() -> CatalogBuilder {
        CatalogBuilder {
            contents: BTreeMap::new(),
            item_index: BTreeMap::new(),
            exclusions: BTreeMap::new(),
            inclusions: BTreeMap::new(),
        }
    }

    pub fn add_item(mut self, family: &Family, item: &Item) -> CatalogBuilder {
        self.contents.entry(family.clone())
            .or_insert_with(|| vec![])
            .push(item.clone());

        self.item_index.entry(item.clone())
            .or_insert_with(|| family.clone());

        self
    }

    pub fn add_items(self, family: &Family, items: &[Item]) -> CatalogBuilder {
        items.iter()
            .fold(self, |catalog_builder, item| catalog_builder.add_item(family, item))
    }

    pub fn add_exclusion_rule(mut self, selection: &Item, exclusion: &Item) -> CatalogBuilder {
        self.exclusions.entry(selection.clone())
            .or_insert_with(|| vec![])
            .push(exclusion.clone());

        self
    }

    pub fn add_exclusion_rules(self, selection: &Item, exclusions: &[Item]) -> CatalogBuilder {
        exclusions.iter()
            .fold(self, |catalog_builder, item| catalog_builder.add_exclusion_rule(selection, item))
    }

    pub fn add_inclusion_rule(mut self, selection: &Item, inclusion: &Item) -> CatalogBuilder {
        self.inclusions.entry(selection.clone())
            .or_insert_with(|| vec![])
            .push(inclusion.clone());

        self
    }

    pub fn add_inclusion_rules(self, selection: &Item, inclusions: &[Item]) -> CatalogBuilder {
        inclusions.iter()
            .fold(self, |catalog_builder, item| catalog_builder.add_inclusion_rule(selection, item))
    }

    pub fn build(&self) -> Result<Catalog, CatalogBuilderError> {
        validation::validate_catalog(
            &self.contents,
            &self.item_index,
            &self.exclusions,
            &self.inclusions,
        )?;

        let universe: Universe<Item> = self.contents.iter()
            .flat_map(|(_, items)| items)
            .cloned()
            .collect_vec()
            .into();

        let tree = self.contents.iter()
            .map(|(_, siblings)| sibling_relationship(&universe, siblings))
            .fold(universe.unit_tree(), |new_tree, tree| family_relationship(&new_tree, &tree));

        let exclusion_rules = self.exclusions.iter()
            .flat_map(|(selection, exclusions)| exclusions.iter().map(|exclusion| (selection, exclusion)).collect_vec())
            .collect_vec();
        let inclusion_rules = self.inclusions.iter()
            .flat_map(|(selection, inclusions)| inclusions.iter().map(|inclusion| (selection, inclusion)).collect_vec())
            .collect_vec();

        let outfits = tree.combinations().into_iter()
            .filter(|outfit| !violates_rules(&exclusion_rules, outfit, violates_exclusion_rule))
            .filter(|outfit| !violates_rules(&inclusion_rules, outfit, violates_inclusion_rule))
            .map(|o| o.into_iter().collect_vec())
            .collect_vec();

        let tree = universe.hyper_tree(&outfits[..]);

        Ok(Catalog::new(tree, self.item_index.clone(), vec![], vec![]))
    }
}

fn sibling_relationship(universe: &Universe<Item>, siblings: &[Item]) -> Tree<Item> {
    universe.unique_tree(siblings)
}

fn family_relationship(family1: &Tree<Item>, family2: &Tree<Item>) -> Tree<Item> {
    Tree::product(family1, family2)
}

fn violates_rules<F: Fn(&BTreeSet<Item>, (&Item, &Item)) -> bool>(rules: &[(&Item, &Item)], outfit: &BTreeSet<Item>, predicate: F) -> bool {
    rules.iter().any(|&f| predicate(outfit, f))
}

fn violates_exclusion_rule(outfit: &BTreeSet<Item>, (selection, exclusion): (&Item, &Item)) -> bool {
    if outfit.contains(selection) {
        return outfit.contains(exclusion);
    }
    false
}

fn violates_inclusion_rule(outfit: &BTreeSet<Item>, (selection, inclusion): (&Item, &Item)) -> bool {
    if outfit.contains(selection) {
        return !outfit.contains(inclusion);
    }
    false
}

#[cfg(test)]
mod no_rules_tests {
    use super::CatalogBuilder;
    use super::Family;
    use super::Item;

    #[test]
    fn one_family_with_two_items() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");
        let black = Item::new("shirts:black");

        let shirts = Family::new("shirts");

        let catalog_builder = CatalogBuilder::new()
            .add_items(&shirts, &[red.clone(), blue.clone(), black.clone()]);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![
            btreeset![blue],
            btreeset![red],
            btreeset![black]
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }

    #[test]
    fn two_families_with_two_item_each() {
        let blue = Item::new("shirts:blue");
        let red = Item::new("shirts:red");

        let jeans = Item::new("pants:jeans");
        let slacks = Item::new("pants:slacks");

        let shirts = Family::new("shirts");
        let pants = Family::new("pants");

        let catalog_builder = CatalogBuilder::new()
            .add_items(&shirts, &[red.clone(), blue.clone()])
            .add_items(&pants, &[jeans.clone(), slacks.clone()]);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![
            btreeset![red.clone(), jeans.clone()],
            btreeset![red.clone(), slacks.clone()],
            btreeset![blue.clone(), jeans.clone()],
            btreeset![blue.clone(), slacks.clone()],
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }
}

#[cfg(test)]
mod exclusion_rules_tests {
    use super::CatalogBuilder;

    use super::Family;
    use super::Item;

    #[test]
    fn exclusion_rule_removes_single_outfit() {
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

        let expected = btreeset![
            btreeset![red.clone(), slacks.clone()],
            btreeset![blue.clone(), jeans.clone()],
            btreeset![blue.clone(), slacks.clone()],
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }

    #[test]
    fn exclusion_rule_removes_multiple_outfit() {
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
            .add_exclusion_rule(&red, &jeans)
            .add_exclusion_rule(&blue, &slacks);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![
            btreeset![blue.clone(), jeans.clone()],
            btreeset![red.clone(), slacks.clone()],
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }

    #[test]
    fn exclusion_rules_can_remove_all_outfits() {
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
            .add_exclusion_rules(&red, &[jeans.clone(), slacks.clone()])
            .add_exclusion_rules(&blue, &[jeans.clone(), slacks.clone()]);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }

    #[test]
    fn exclusion_rules_can_remove_all_outfits_for_a_selection() {
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
            .add_exclusion_rules(&blue, &[jeans.clone(), slacks.clone()]);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![
            btreeset![red.clone(), jeans.clone()],
            btreeset![red.clone(), slacks.clone()],
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }
}

#[cfg(test)]
mod inclusion_rules_tests {
    use super::CatalogBuilder;
    use super::Family;
    use super::Item;

    #[test]
    fn inclusion_rule_removes_single_outfit() {
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
            .add_inclusion_rule(&red, &jeans);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![
            btreeset![red.clone(), jeans.clone()],
            btreeset![blue.clone(), jeans.clone()],
            btreeset![blue.clone(), slacks.clone()],
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }

    #[test]
    fn inclusion_rule_removes_multiple_outfit() {
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
            .add_inclusion_rule(&red, &jeans)
            .add_inclusion_rule(&blue, &slacks);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![
            btreeset![red.clone(), jeans.clone()],
            btreeset![blue.clone(), slacks.clone()]
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }

    #[test]
    fn inclusion_rules_cannot_include_two_from_same_family() {
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
            .add_inclusion_rules(&red, &[jeans.clone(), slacks.clone()]);

        let catalog = catalog_builder.build()
            .expect("expected build to return Catalog");

        let expected = btreeset![
            btreeset![blue.clone(), jeans.clone()],
            btreeset![blue.clone(), slacks.clone()]
        ];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }
}
