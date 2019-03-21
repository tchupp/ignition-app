pub type Family = String;
pub type Item = String;

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", content = "item")]
pub enum ItemStatus<T> {
    Required(T),
    Excluded(T),
    Available(T),
    Selected(T),
}
