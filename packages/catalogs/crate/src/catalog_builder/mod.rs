use std::collections::HashMap;
use std::str;

use wasm_bindgen::prelude::*;

use inner::{Catalog, CatalogBuilder, CatalogBuilderError};
use inner::{Family, Item};

mod validation;

#[derive(Serialize, Deserialize)]
pub struct CatalogAssembly {
    families: HashMap<Family, Vec<Item>>,
    exclusions: Vec<CatalogExclusionRule>,
    inclusions: Vec<CatalogInclusionRule>,
}

#[derive(Serialize, Deserialize)]
struct CatalogExclusionRule {
    conditions: Vec<Item>,
    exclusions: Vec<Item>,
}

#[derive(Serialize, Deserialize)]
struct CatalogInclusionRule {
    conditions: Vec<Item>,
    inclusions: Vec<Item>,
}

pub fn build_catalog(CatalogAssembly { families, exclusions, inclusions }: CatalogAssembly) -> Result<Catalog, CatalogBuilderError> {
    let exclusions: HashMap<Item, Vec<Item>> = exclusions.into_iter()
        .map(|CatalogExclusionRule { conditions, exclusions }|
            (
                conditions[0].clone(),
                exclusions
            )
        )
        .collect();

    let inclusions: HashMap<Item, Vec<Item>> = inclusions.into_iter()
        .map(|CatalogInclusionRule { conditions, inclusions }|
            (
                conditions[0].clone(),
                inclusions
            )
        )
        .collect();

    let catalog_builder = families.iter()
        .fold(CatalogBuilder::new(), |catalog_builder, (family, items)| catalog_builder.add_items(&family, items));

    let catalog_builder = exclusions.iter()
        .fold(catalog_builder, |catalog_builder, (selection, exclusions)| catalog_builder.add_exclusion_rules(&selection, exclusions));

    let catalog_builder = inclusions.iter()
        .fold(catalog_builder, |catalog_builder, (selection, inclusions)| catalog_builder.add_inclusion_rules(&selection, inclusions));

    catalog_builder.build()
}

#[cfg(test)]
mod no_rules_tests {
    use super::build_catalog;
    use super::CatalogAssembly;
    use super::CatalogBuilder;
    use super::CatalogExclusionRule;

    #[test]
    fn one_family_with_two_items() {
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");
        let black = String::from("shirts:black");

        let shirts = String::from("shirts");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
                shirts => vec![red.clone(), blue.clone(), black.clone()]
            },
            exclusions: vec![],
            inclusions: vec![],
        })
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
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![],
        })
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
    use super::build_catalog;
    use super::CatalogAssembly;
    use super::CatalogBuilder;
    use super::CatalogExclusionRule;

    #[test]
    fn exclusion_rule_removes_single_outfit() {
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![CatalogExclusionRule { conditions: vec![red.clone()], exclusions: vec![jeans.clone()] }],
            inclusions: vec![],
        })
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
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
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
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
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

        let expected = btreeset![];
        assert_eq!(
            expected,
            catalog.outfits(&[], &[]).unwrap()
        );
    }

    #[test]
    fn exclusion_rules_can_remove_all_outfits_for_a_selection() {
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![
                CatalogExclusionRule { conditions: vec![blue.clone()], exclusions: vec![jeans.clone(), slacks.clone()] },
            ],
            inclusions: vec![],
        })
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
    use super::build_catalog;
    use super::CatalogAssembly;
    use super::CatalogBuilder;
    use super::CatalogInclusionRule;

    #[test]
    fn inclusion_rule_removes_single_outfit() {
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![red.clone()], inclusions: vec![jeans.clone()] },
            ],
        })
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
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
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
        let blue = String::from("shirts:blue");
        let red = String::from("shirts:red");

        let jeans = String::from("pants:jeans");
        let slacks = String::from("pants:slacks");

        let shirts = String::from("shirts");
        let pants = String::from("pants");

        let catalog = build_catalog(CatalogAssembly {
            families: hashmap! {
                shirts => vec![red.clone(), blue.clone()],
                pants => vec![jeans.clone(), slacks.clone()],
            },
            exclusions: vec![],
            inclusions: vec![
                CatalogInclusionRule { conditions: vec![red.clone()], inclusions: vec![jeans.clone(), slacks.clone()] },
            ],
        })
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
