#[derive(Serialize, Deserialize)]
#[serde(untagged)]
pub enum IgnitionErrorDetail {
    One(String),
    Many(Vec<IgnitionError>),
}

#[derive(Serialize, Deserialize)]
pub struct IgnitionError {
    pub error: String,
    pub description: String,
    pub details: IgnitionErrorDetail,
}
