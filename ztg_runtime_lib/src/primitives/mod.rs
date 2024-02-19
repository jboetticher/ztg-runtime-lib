use scale::{Encode, Decode};
use core::ops::{Range, RangeInclusive};
#[cfg(feature = "std")]
use ink::storage::traits::StorageLayout;

pub type PoolId = u128;
pub type MarketId = u128;

// region: ZEITGEIST AUTHORITY

pub type CategoryIndex = u16;

#[derive(Encode, Decode, Clone, PartialEq, Debug)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum OutcomeReport {
    Categorical(CategoryIndex),
    Scalar(u128),
}

// endregion

// region: ZEITGEIST COURT

pub type CourtId = u128;

#[derive(Encode, Decode, Clone, PartialEq, Debug)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum VoteItem {
    Outcome(OutcomeReport),
    Binary(bool),
}

// endregion

// region: ZEITGEIST MARKET

// TODO: implement storage layout for "Range"
/// Defines whether the period is represented as a blocknumber or a timestamp.
///
/// ****** IMPORTANT *****
///
/// Must be an exclusive range because:
///
/// 1. `zrml_predition_markets::Pallet::admin_move_market_to_closed` uses the current block as the
/// end period.
/// 2. The liquidity mining pallet takes into consideration the different between the two blocks.
/// So 1..5 correctly outputs 4 (`5 - 1`) while 1..=5 would incorrectly output the same 4.
/// 3. With inclusive ranges it is not possible to express empty ranges and this feature
/// mostly conflicts with existent tests and corner cases.
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

// TODO: implement storage layout for "[u8; 50]"
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

// TODO: implement StorageLayout for "RangeInclusive"
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

#[derive(Clone, Decode, Encode, PartialEq, Eq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo, StorageLayout))]
pub enum ScoringRule {
    CPMM,
    RikiddoSigmoidFeeMarketEma,
    Lmsr,
    Orderbook,
}

#[derive(scale::Encode, scale::Decode, Clone, PartialEq)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum ZeitgeistAsset {
    CategoricalOutcome(u128, u16),
    ScalarOutcome, //(u128, ScalarPosition),
    CombinatorialOutcome,
    PoolShare, //(SerdeWrapper<PoolId>),
    Ztg,       // default
    ForeignAsset(u32),
}

// endregion