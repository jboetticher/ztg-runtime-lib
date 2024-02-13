use ink::primitives::AccountId;
use sp_runtime::{MultiAddress, Perbill};

use crate::primitives::*;

#[derive(scale::Encode, scale::Decode)]
pub enum RuntimeCall {
    /// This index can be found by investigating runtime configuration. You can check the
    /// pallet order inside `construct_runtime!` block and read the position of your
    /// pallet (0-based).
    ///
    /// https://github.com/zeitgeistpm/zeitgeist/blob/7ea631dbff5ea519a970c5bc0f3d3d143849d3b9/runtime/common/src/lib.rs#L274-L330
    ///
    /// [See here for more.](https://substrate.stackexchange.com/questions/778/how-to-get-pallet-index-u8-of-a-pallet-in-runtime)
    #[codec(index = 40)]
    AssetManager(AssetManagerCall),
    #[codec(index = 51)]
    Authorized(AuthorizedCall),
    #[codec(index = 52)]
    Court(CourtCall),
    #[codec(index = 56)]
    Swaps(SwapsCall),
    #[codec(index = 57)]
    PredictionMarkets(PredictionMarketsCall),
    #[codec(index = 58)]
    Styx(StyxCall),
    #[codec(index = 59)]
    GlobalDisputes(GlobalDisputesCall),
    #[codec(index = 60)]
    NeoSwaps(NeoSwapsCall),
    #[codec(index = 61)]
    Orderbook(OrderbookCall),
    #[codec(index = 62)]
    Parimutuel(ParimutelCall),
}

/* ========================== Zeitgeist Pallets ========================== */

#[derive(scale::Encode, scale::Decode)]
pub enum AssetManagerCall {
    // https://github.com/open-web3-stack/open-runtime-module-library/blob/22a4f7b7d1066c1a138222f4546d527d32aa4047/currencies/src/lib.rs#L129-L131C19
    #[codec(index = 0)]
    Transfer {
        dest: MultiAddress<AccountId, ()>,
        currency_id: ZeitgeistAsset,
        #[codec(compact)]
        amount: u128,
    },
}

/// https://github.com/zeitgeistpm/zeitgeist/tree/release-v0.5.0/zrml/authorized
#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum AuthorizedCall {
    /// Overwrites already provided outcomes for the same market and account.
    /// https://github.com/zeitgeistpm/zeitgeist/blob/7ea631dbff5ea519a970c5bc0f3d3d143849d3b9/zrml/authorized/src/lib.rs#L88
    #[codec(index = 0)]
    AuthorizeMarketOutcome {
        market_id: u128,
        outcome: OutcomeReport
    },
}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum CourtCall {}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum SwapsCall {
    #[codec(index = 1)]
    PoolExit {
        #[codec(compact)]
        pool_id: u128,
        #[codec(compact)]
        pool_amount: u128,
        min_assets_out: ink::prelude::vec::Vec<u128>,
    },
    #[codec(index = 5)]
    PoolJoin {
        #[codec(compact)]
        pool_id: u128,
        #[codec(compact)]
        pool_amount: u128,
        max_assets_in: ink::prelude::vec::Vec<u128>,
    },
    // https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fbsr.zeitgeist.pm#/extrinsics/decode/0x380981040402286bee00b102000000000000000000000000000001000100cdbe7b00000000000000000000000000
    #[codec(index = 9)]
    SwapExactAmountIn {
        #[codec(compact)]
        pool_id: u128,
        asset_in: ZeitgeistAsset,
        #[codec(compact)]
        asset_amount_in: u128,
        asset_out: ZeitgeistAsset,
        min_asset_amount_out: Option<u128>,
        max_price: Option<u128>,
    },
    #[codec(index = 10)]
    SwapExactAmountOut {
        #[codec(compact)]
        pool_id: u128,
        asset_in: ZeitgeistAsset,
        max_asset_amount_in: Option<u128>,
        asset_out: ZeitgeistAsset,
        #[codec(compact)]
        asset_amount_out: u128,
        max_price: Option<u128>,
    },
}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum PredictionMarketsCall {
    #[codec(index = 5)]
    BuyCompleteSet {
        #[codec(compact)]
        market_id: u128,
        #[codec(compact)]
        amount: u128,
    },
    #[codec(index = 8)]
    CreateMarket {
        base_asset: ZeitgeistAsset, // Asset<u128>,
        creator_fee: Perbill,
        oracle: AccountId,
        period: MarketPeriod,
        deadlines: Deadlines,
        metadata: MultiHash,
        creation: MarketCreation,
        market_type: MarketType,
        dispute_mechanism: Option<MarketDisputeMechanism>,
        scoring_rule: ScoringRule
    },
    #[codec(index = 11)]
    DeploySwapPoolForMarket {
        #[codec(compact)]
        market_id: u128,
        #[codec(compact)]
        swap_fee: u128,
        #[codec(compact)]
        amount: u128,
    },
    #[codec(index = 12)]
    RedeemShares {
        #[codec(compact)]
        market_id: u128,
    },
    #[codec(index = 15)]
    SellCompleteSet {
        #[codec(compact)]
        market_id: u128,
        #[codec(compact)]
        amount: u128,
    },
}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum StyxCall {}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum GlobalDisputesCall {}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum NeoSwapsCall {}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum OrderbookCall {}

#[derive(scale::Encode, scale::Decode)]
#[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
pub enum ParimutelCall {}

