mod catalog;
mod catalog_builder;

pub use self::catalog::*;
pub use self::catalog_builder::*;

//#[derive(Debug, Clone, Hash, Ord, PartialOrd, Eq, PartialEq, Serialize, Deserialize)]
//pub struct Family(String);

pub type Family = String;

//impl Family {
//    pub fn new<S>(id: S) -> Family where S: Into<String> {
//        Family(id.into())
//    }
//}

//impl From<Family> for String {
//    fn from(family: Family) -> Self {
//        family.0
//    }
//}

//#[derive(Debug, Clone, Hash, Ord, PartialOrd, Eq, PartialEq, Serialize, Deserialize)]
//pub struct Item(String);

pub type Item = String;

//impl Item {
//    pub fn new<S>(id: S) -> Item where S: Into<String> {
//        Item(id.into())
//    }
//}

//impl From<Item> for String {
//    fn from(item: Item) -> Self {
//        item.0
//    }
//}