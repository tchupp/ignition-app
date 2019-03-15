use std::collections::{BTreeMap, HashMap};
use std::str;

use reduce::Reduce;
use weave::zdd2::Forest;

use catalog::Catalog;
use types::{Family, Item};

use self::validation::{CatalogBuilderError, validate_catalog};

mod validation;

#[derive(Serialize, Deserialize)]
pub struct CatalogAssembly {
    families: BTreeMap<Family, Vec<Item>>,
    exclusions: Vec<CatalogExclusionRule>,
    inclusions: Vec<CatalogInclusionRule>,
}

trait CatalogRule {
    fn check(&self, outfit: &[Item]) -> bool;

    fn has_conditions(&self) -> bool;
}

#[derive(Serialize, Deserialize)]
pub struct CatalogExclusionRule {
    conditions: Vec<Item>,
    exclusions: Vec<Item>,
}

impl CatalogRule for CatalogExclusionRule {
    fn check(&self, outfit: &[Item]) -> bool {
        self.conditions.iter().all(|condition| outfit.contains(condition))
            && self.exclusions.iter().any(|item| outfit.contains(item))
    }

    fn has_conditions(&self) -> bool {
        !self.conditions.is_empty()
    }
}

#[derive(Serialize, Deserialize)]
pub struct CatalogInclusionRule {
    conditions: Vec<Item>,
    inclusions: Vec<Item>,
}

impl CatalogRule for CatalogInclusionRule {
    fn check(&self, outfit: &[Item]) -> bool {
        self.conditions.iter().all(|condition| outfit.contains(condition))
            && self.inclusions.iter().any(|item| !outfit.contains(item))
    }

    fn has_conditions(&self) -> bool {
        !self.conditions.is_empty()
    }
}

pub fn build_catalog(CatalogAssembly { families, exclusions, inclusions }: CatalogAssembly) -> Result<Catalog, CatalogBuilderError> {
    let item_index: HashMap<Item, Family> = families.iter()
        .flat_map(|(family, items)| items.iter()
            .map(|item| (item.clone(), family.clone()))
            .collect::<Vec<_>>()
        )
        .collect();

    validate_catalog(
        &families,
        &item_index,
        &exclusions,
        &inclusions,
    )?;

    let forest = families.into_iter()
        .map(|(_, items)| Forest::unique(&items))
        .reduce(Forest::product)
        .ok_or(validation::CatalogBuilderError::EmptyCatalog)?;

    let combinations = forest.trees().into_iter()
        .filter(|outfit| {
            !exclusions.iter()
                .any(|rule| rule.check(outfit))
        })
        .filter(|outfit| {
            !inclusions.iter()
                .any(|rule| rule.check(outfit))
        })
        .collect::<Vec<Vec<_>>>();

    let combinations = Forest::many(&combinations);

    Ok(Catalog::new(combinations, item_index))
}

#[cfg(test)]
mod no_rules_tests {
    use types::{Family, Item};

    use super::build_catalog;
    use super::CatalogAssembly;
    use super::CatalogBuilderError;

    #[test]
    fn empty_catalog_returns_error() {
        let error = build_catalog(CatalogAssembly {
            families: btreemap! {},
            exclusions: vec![],
            inclusions: vec![],
        }).unwrap_err();

        assert_eq!(
            CatalogBuilderError::EmptyCatalog,
            error
        );
    }

    #[test]
    fn two_families_cannot_share_items() {
        let blue = Item::from("blue");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let error = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts.clone() => vec![blue.clone()],
                pants.clone() => vec![blue.clone()],
            },
            exclusions: vec![],
            inclusions: vec![],
        }).unwrap_err();

        assert_eq!(
            CatalogBuilderError::MultipleFamiliesRegistered { item: blue, families: vec![shirts, pants] },
            error
        );
    }

    #[test]
    fn one_family_with_two_items() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");
        let black = Item::from("shirts:black");

        let shirts = Family::from("shirts");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone(), black.clone()]
            },
            exclusions: vec![],
            inclusions: vec![],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![black],
            vec![blue],
            vec![red]
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn two_families_with_two_item_each() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![jeans.clone(), blue.clone()],
            vec![jeans.clone(), red.clone()],
            vec![slacks.clone(), blue.clone()],
            vec![slacks.clone(), red.clone()],
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }
}

#[cfg(test)]
mod exclusion_rules_tests {
    use types::{Family, Item};

    use super::build_catalog;
    use super::CatalogAssembly;
    use super::CatalogBuilderError;
    use super::CatalogExclusionRule;

    #[test]
    fn exclusion_rule_removes_single_outfit() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![CatalogExclusionRule { conditions: vec![red.clone()], exclusions: vec![jeans.clone()] }],
            inclusions: vec![],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![slacks.clone(), blue.clone()],
            vec![slacks.clone(), red.clone()],
            vec![jeans.clone(), blue.clone()],
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn exclusion_rules_removes_multiple_outfit() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![
                CatalogExclusionRule { conditions: vec![red.clone()], exclusions: vec![jeans.clone()] },
                CatalogExclusionRule { conditions: vec![blue.clone()], exclusions: vec![slacks.clone()] },
            ],
            inclusions: vec![],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![jeans.clone(), blue.clone()],
            vec![slacks.clone(), red.clone()],
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn exclusion_rules_can_remove_all_outfits() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![
                CatalogExclusionRule { conditions: vec![red.clone()], exclusions: vec![jeans.clone(), slacks.clone()] },
                CatalogExclusionRule { conditions: vec![blue.clone()], exclusions: vec![jeans.clone(), slacks.clone()] },
            ],
            inclusions: vec![],
        })
            .expect("expected build to return Catalog");

        let expected: Vec<Vec<Item>> = vec![];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn exclusion_rules_can_remove_all_outfits_for_a_selection() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![
                CatalogExclusionRule { conditions: vec![blue.clone()], exclusions: vec![jeans.clone(), slacks.clone()] },
            ],
            inclusions: vec![],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![jeans.clone(), red.clone()],
            vec![slacks.clone(), red.clone()],
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn exclusion_rules_must_have_a_condition() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let error = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![
                CatalogExclusionRule { conditions: vec![], exclusions: vec![jeans.clone()] },
            ],
            inclusions: vec![],
        })
            .expect_err("expected build to return Error");

        assert_eq!(
            CatalogBuilderError::ExclusionMissingCondition,
            error
        );
    }

    #[test]
    fn exclusion_rule_condition_must_have_family() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");
        let black = Item::from("shirts:black");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let error = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![
                CatalogExclusionRule { conditions: vec![black.clone()], exclusions: vec![jeans.clone()] },
                CatalogExclusionRule { conditions: vec![jeans.clone()], exclusions: vec![black.clone()] },
            ],
            inclusions: vec![],
        })
            .expect_err("expected build to return Error");

        assert_eq!(
            CatalogBuilderError::ExclusionMissingFamily { item: black },
            error
        );
    }

    #[test]
    fn exclusion_rule_must_have_different_families_for_conditions_and_exclusions() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let error = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts.clone() => vec![red.clone(), blue.clone()],
                pants.clone() => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![
                CatalogExclusionRule { conditions: vec![jeans.clone()], exclusions: vec![slacks.clone()] },
                CatalogExclusionRule { conditions: vec![slacks.clone()], exclusions: vec![jeans.clone()] },
            ],
            inclusions: vec![],
        })
            .expect_err("expected build to return Error");

        assert_eq!(
            CatalogBuilderError::ExclusionFamilyConflict { family: pants, items: vec![jeans, slacks] },
            error
        );
    }
}

#[cfg(test)]
mod inclusion_rules_tests {
    use catalog_builder::validation::CatalogBuilderError;
    use types::{Family, Item};

    use super::build_catalog;
    use super::CatalogAssembly;
    use super::CatalogInclusionRule;

    #[test]
    fn inclusion_rule_removes_single_outfit() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![red.clone()], inclusions: vec![jeans.clone()] },
            ],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![jeans.clone(), blue.clone()],
            vec![jeans.clone(), red.clone()],
            vec![slacks.clone(), blue.clone()],
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn inclusion_rules_removes_multiple_outfit() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![red.clone()], inclusions: vec![jeans.clone()] },
                CatalogInclusionRule { conditions: vec![blue.clone()], inclusions: vec![slacks.clone()] },
            ],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![jeans.clone(), red.clone()],
            vec![slacks.clone(), blue.clone()]
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn inclusion_rules_can_remove_all_outfits() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![red.clone()], inclusions: vec![jeans.clone(), slacks.clone()] },
                CatalogInclusionRule { conditions: vec![blue.clone()], inclusions: vec![jeans.clone(), slacks.clone()] },
            ],
        })
            .expect("expected build to return Catalog");

        let expected: Vec<Vec<Item>> = vec![];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn inclusion_rules_cannot_include_two_from_same_family() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![red.clone()], inclusions: vec![jeans.clone(), slacks.clone()] },
            ],
        })
            .expect("expected build to return Catalog");

        let expected = vec![
            vec![jeans.clone(), blue.clone()],
            vec![slacks.clone(), blue.clone()]
        ];
        assert_eq!(
            expected,
            catalog.combinations()
        );
    }

    #[test]
    fn inclusion_rules_must_have_a_condition() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let error = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![], inclusions: vec![jeans.clone()] },
            ],
        })
            .expect_err("expected build to return Error");

        assert_eq!(
            CatalogBuilderError::InclusionMissingCondition,
            error
        );
    }

    #[test]
    fn inclusion_rule_condition_must_have_family() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");
        let black = Item::from("shirts:black");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let error = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![black.clone()], inclusions: vec![jeans.clone()] },
                CatalogInclusionRule { conditions: vec![jeans.clone()], inclusions: vec![black.clone()] },
            ],
        })
            .expect_err("expected build to return Error");

        assert_eq!(
            CatalogBuilderError::InclusionMissingFamily { item: black },
            error
        );
    }

    #[test]
    fn inclusion_rule_must_have_different_families_for_conditions_and_exclusions() {
        let blue = Item::from("shirts:blue");
        let red = Item::from("shirts:red");

        let jeans = Item::from("pants:jeans");
        let slacks = Item::from("pants:slacks");

        let shirts = Family::from("shirts");
        let pants = Family::from("pants");

        let error = build_catalog(CatalogAssembly {
            families: btreemap! {
                shirts.clone() => vec![red.clone(), blue.clone()],
                pants.clone() => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![jeans.clone()], inclusions: vec![slacks.clone()] },
                CatalogInclusionRule { conditions: vec![slacks.clone()], inclusions: vec![jeans.clone()] },
            ],
        })
            .expect_err("expected build to return Error");

        assert_eq!(
            CatalogBuilderError::InclusionFamilyConflict { family: pants, items: vec![jeans, slacks] },
            error
        );
    }
}
