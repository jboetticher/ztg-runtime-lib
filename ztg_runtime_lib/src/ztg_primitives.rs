/* ========================== Zeitgeist Types ========================== */
pub type CategoryIndex = u16;

/* ========================== Zeitgeist Primitives ========================== */
#[derive(scale::Encode, scale::Decode, Clone, PartialEq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum OutcomeReport {
    Categorical(CategoryIndex),
    Scalar(u128),
}