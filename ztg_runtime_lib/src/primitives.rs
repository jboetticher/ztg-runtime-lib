use scale::{Encode, Decode};
use core::ops::{Range, RangeInclusive};
#[cfg(feature = "std")]
use ink::storage::traits::StorageLayout;

pub type CourtId = u128;
pub type CourtHash = [u8; 32];
pub type PoolId = u128;
pub type MarketId = u128;
pub type OrderId = u128;
pub type AssetIndexType = u16;
pub type CategoryIndex = u16;

/// A representation of a market's outcome.
#[derive(Encode, Decode, Clone, PartialEq, Debug)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum OutcomeReport {
    Categorical(CategoryIndex),
    Scalar(u128),
}

/// A vote for use in court.
#[derive(Encode, Decode, Clone, PartialEq, Debug)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum VoteItem {
    Outcome(OutcomeReport),
    Binary(bool),
}

/// Defines whether the period is represented as a blocknumber or a timestamp.
#[derive(Clone, Decode, Encode, Eq, PartialEq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum MarketPeriod {
    Block(Range<u64>),
    Timestamp(Range<u64>),
}

/// Defines deadlines for market.
#[derive(Clone, Decode, Encode, Eq, PartialEq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub struct Deadlines {
    pub grace_period: u64,
    pub oracle_duration: u64,
    pub dispute_duration: u64
}

/// Defines the hash of metadata stored for a market.
#[derive(Clone, Debug, Decode, Encode, Eq, PartialEq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum MultiHash {
    Sha3_384([u8; 50]),
}

/// Defines the type of market creation.
#[derive(Clone, Decode, Encode, PartialEq, Eq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum MarketCreation {
    // A completely permissionless market that requires a higher
    // validity bond. May resolve as `Invalid`.
    Permissionless,
    // An advised market that must pass inspection by the advisory
    // committee. After being approved will never resolve as `Invalid`.
    Advised,
}

/// Defines the type of market.
/// All markets also have themin_assets_out `Invalid` resolution.
#[derive(Clone, Decode, Encode, PartialEq, Eq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum MarketType {
    /// A market with a number of categorical outcomes.
    Categorical(u16),
    /// A market with a range of potential outcomes.
    Scalar(RangeInclusive<u128>),
}

/// How a market should resolve disputes
#[derive(Clone, Decode, Encode, PartialEq, Eq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum MarketDisputeMechanism {
    Authorized,
    Court,
    SimpleDisputes,
}

/// The scoring methodology for a market.
#[derive(Clone, Decode, Encode, PartialEq, Eq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum ScoringRule {
    Lmsr,
    Orderbook,
    Parimutuel
}

/// A type of asset.
#[derive(scale::Encode, scale::Decode, Clone, PartialEq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum ZeitgeistAsset {
    CategoricalOutcome(u128, u16),
    ScalarOutcome, //(u128, ScalarPosition),
    CombinatorialOutcome,
    PoolShare, //(SerdeWrapper<PoolId>),
    Ztg,       // default
    ForeignAsset(u32),
    ParimutuelShare(u128, u16)
}
