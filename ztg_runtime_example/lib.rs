#![cfg_attr(not(feature = "std"), no_std, no_main)]
#[ink::contract]
mod ztg_runtime_example {
    use ink::env::Error as EnvError;
    use sp_runtime::Perbill;
    use ztg_runtime_lib::primitives::{AssetIndexType, MarketId, OrderId, *};
    use ztg_runtime_lib::runtime_structs::{
        AssetManagerCall, AuthorizedCall, CourtCall, GlobalDisputesCall, NeoSwapsCall,
        OrderbookCall, ParimutelCall, PredictionMarketsCall, RuntimeCall, StyxCall, SwapsCall,
    };

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        CallRuntimeFailed,
    }

    impl From<EnvError> for Error {
        fn from(e: EnvError) -> Self {
            match e {
                EnvError::CallRuntimeFailed => Error::CallRuntimeFailed,
                _ => panic!("Unexpected error from `pallet-contracts`."),
            }
        }
    }

    pub type Result<T> = core::result::Result<T, Error>;

    #[ink(storage)]
    pub struct ZtgRuntimeExample {
        outcome_report: OutcomeReport,
    }

    impl ZtgRuntimeExample {
        #[ink(constructor)]
        pub fn new(_outcome: OutcomeReport) -> Self {
            ZtgRuntimeExample {
                outcome_report: _outcome,
            }
        }

        #[ink(constructor)]
        pub fn default() -> Self {
            Self::new(OutcomeReport::Scalar(0))
        }

        // region: Asset Manager

        #[ink(message)]
        pub fn transfer(&mut self, dest: AccountId, amount: Balance) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::AssetManager(AssetManagerCall::Transfer {
                    dest: dest.into(),
                    currency_id: ZeitgeistAsset::Ztg,
                    amount,
                }))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Authorized

        /// @note: Requires SUDO or Advisory Committee
        #[ink(message)]
        pub fn authorize_market_outcome(
            &mut self,
            market_id: MarketId,
            outcome: OutcomeReport,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Authorized(
                    AuthorizedCall::AuthorizeMarketOutcome { market_id, outcome },
                ))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Swaps

        /// @note: Disabled
        #[ink(message)]
        pub fn pool_exit(
            &mut self,
            pool_id: PoolId,
            pool_amount: Balance,
            min_assets_out: ink::prelude::vec::Vec<Balance>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(SwapsCall::PoolExit {
                    pool_id,
                    pool_amount,
                    min_assets_out,
                }))
                .map_err(Into::<Error>::into)
        }

        /// @note: Disabled
        #[ink(message)]
        pub fn pool_exit_with_exact_asset_amount(
            &mut self,
            pool_id: PoolId,
            asset: ZeitgeistAsset,
            asset_amount: Balance,
            max_pool_amount: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(
                    SwapsCall::PoolExitWithExactAssetAmount {
                        pool_id,
                        asset,
                        asset_amount,
                        max_pool_amount,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Disabled
        #[ink(message)]
        pub fn pool_exit_with_exact_pool_amount(
            &mut self,
            pool_id: PoolId,
            asset: ZeitgeistAsset,
            pool_amount: Balance,
            min_asset_amount: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(
                    SwapsCall::PoolExitWithExactPoolAmount {
                        pool_id,
                        asset,
                        pool_amount,
                        min_asset_amount,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Disabled
        #[ink(message)]
        pub fn pool_join(
            &mut self,
            pool_id: PoolId,
            pool_amount: Balance,
            max_assets_in: ink::prelude::vec::Vec<Balance>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(SwapsCall::PoolJoin {
                    pool_id,
                    pool_amount,
                    max_assets_in,
                }))
                .map_err(Into::<Error>::into)
        }

        /// @note: Disabled
        #[ink(message)]
        pub fn pool_join_with_exact_asset_amount(
            &mut self,
            pool_id: PoolId,
            asset_in: ZeitgeistAsset,
            asset_amount: Balance,
            min_pool_amount: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(
                    SwapsCall::PoolJoinWithExactAssetAmount {
                        pool_id,
                        asset_in,
                        asset_amount,
                        min_pool_amount,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Disabled
        #[ink(message)]
        pub fn pool_join_with_exact_pool_amount(
            &mut self,
            pool_id: PoolId,
            asset: ZeitgeistAsset,
            pool_amount: Balance,
            max_asset_amount: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(
                    SwapsCall::PoolJoinWithExactPoolAmount {
                        pool_id,
                        asset,
                        pool_amount,
                        max_asset_amount,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Disabled
        #[ink(message)]
        pub fn swap_exact_amount_in(
            &mut self,
            pool_id: PoolId,
            asset_in: ZeitgeistAsset,
            asset_amount_in: Balance,
            asset_out: ZeitgeistAsset,
            min_asset_amount_out: Option<Balance>,
            max_price: Option<Balance>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(SwapsCall::SwapExactAmountIn {
                    pool_id,
                    asset_in,
                    asset_amount_in,
                    asset_out,
                    min_asset_amount_out,
                    max_price,
                }))
                .map_err(Into::<Error>::into)
        }

        /// @note: Disabled
        #[ink(message)]
        pub fn swap_exact_amount_out(
            &mut self,
            pool_id: PoolId,
            asset_in: ZeitgeistAsset,
            max_asset_amount_in: Option<u128>,
            asset_out: ZeitgeistAsset,
            asset_amount_out: u128,
            max_price: Option<u128>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(SwapsCall::SwapExactAmountOut {
                    pool_id,
                    asset_in,
                    max_asset_amount_in,
                    asset_out,
                    asset_amount_out,
                    max_price,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn force_pool_exit(
            &mut self,
            who: AccountId,
            pool_id: PoolId,
            pool_amount: Balance,
            min_assets_out: ink::prelude::vec::Vec<Balance>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Swaps(SwapsCall::ForcePoolExit {
                    who,
                    pool_id,
                    pool_amount,
                    min_assets_out,
                }))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Court

        #[ink(message)]
        pub fn join_court(&mut self, amount: Balance) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::JoinCourt { amount }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn delegate(
            &mut self,
            amount: Balance,
            delegations: ink::prelude::vec::Vec<AccountId>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::Delegate {
                    amount,
                    delegations,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn prepare_exit_court(&mut self) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::PrepareExitCourt))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn exit_court(&mut self, court_participant: AccountId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::ExitCourt {
                    court_participant: court_participant.into(),
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn vote(&mut self, court_id: CourtId, commitment_vote: CourtHash) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::Vote {
                    court_id,
                    commitment_vote,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn denounce_vote(
            &mut self,
            court_id: CourtId,
            juror: AccountId,
            vote_item: VoteItem,
            salt: CourtHash,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::DenounceVote {
                    court_id,
                    juror: juror.into(),
                    vote_item,
                    salt,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn reveal_vote(
            &mut self,
            court_id: CourtId,
            vote_item: VoteItem,
            salt: CourtHash,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::RevealVote {
                    court_id,
                    vote_item,
                    salt,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn appeal(&mut self, court_id: CourtId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::Appeal { court_id }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn reassign_court_stakes(&mut self, court_id: CourtId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::ReassignCourtStakes {
                    court_id,
                }))
                .map_err(Into::<Error>::into)
        }

        /// @note: Requires SUDO
        #[ink(message)]
        pub fn set_inflation(&mut self, inflation: Perbill) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::SetInflation { inflation }))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Styx

        /// @note: Requires SUDO
        #[ink(message)]
        pub fn set_burn_amount(&mut self, amount: Balance) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Styx(StyxCall::SetBurnAmount { amount }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn cross(&mut self) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Styx(StyxCall::Cross))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Global Disputes

        #[ink(message)]
        pub fn add_vote_outcome(
            &mut self,
            market_id: MarketId,
            outcome: OutcomeReport,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::GlobalDisputes(
                    GlobalDisputesCall::AddVoteOutcome { market_id, outcome },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn purge_outcomes(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::GlobalDisputes(
                    GlobalDisputesCall::PurgeOutcomes { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn reward_outcome_owner(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::GlobalDisputes(
                    GlobalDisputesCall::RewardOutcomeOwner { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn vote_on_outcome(
            &mut self,
            market_id: MarketId,
            outcome: OutcomeReport,
            amount: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::GlobalDisputes(
                    GlobalDisputesCall::VoteOnOutcome {
                        market_id,
                        outcome,
                        amount,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn unlock_vote_balance(&mut self, voter: AccountId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::GlobalDisputes(
                    GlobalDisputesCall::UnlockVoteBalance {
                        voter: voter.into(),
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn refund_vote_fees(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::GlobalDisputes(
                    GlobalDisputesCall::RefundVoteFees { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Prediction Markets

        /// @note: Requires SUDO
        #[ink(message)]
        pub fn admin_move_market_to_closed(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::AdminMoveMarketToClosed { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Requires SUDO
        #[ink(message)]
        pub fn admin_move_market_to_resolved(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::AdminMoveMarketToResolved { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Requires SUDO
        #[ink(message)]
        pub fn approve_market(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::ApproveMarket { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Requires SUDO
        #[ink(message)]
        pub fn request_edit(
            &mut self,
            market_id: MarketId,
            edit_reason: ink::prelude::vec::Vec<u8>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::RequestEdit {
                        market_id,
                        edit_reason,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn buy_complete_set(&mut self, market_id: MarketId, amount: Balance) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::BuyCompleteSet { market_id, amount },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn dispute(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::Dispute { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn create_market(
            &mut self,
            base_asset: ZeitgeistAsset,
            creator_fee: Perbill,
            oracle: AccountId,
            period: MarketPeriod,
            deadlines: Deadlines,
            metadata: MultiHash,
            creation: MarketCreation,
            market_type: MarketType,
            dispute_mechanism: Option<MarketDisputeMechanism>,
            scoring_rule: ScoringRule,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::CreateMarket {
                        base_asset,
                        creator_fee,
                        oracle,
                        period,
                        deadlines,
                        metadata,
                        creation,
                        market_type,
                        dispute_mechanism,
                        scoring_rule,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn edit_market(
            &mut self,
            base_asset: ZeitgeistAsset,
            market_id: MarketId,
            oracle: AccountId,
            period: MarketPeriod,
            deadlines: Deadlines,
            metadata: MultiHash,
            market_type: MarketType,
            dispute_mechanism: Option<MarketDisputeMechanism>,
            scoring_rule: ScoringRule,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::EditMarket {
                        base_asset,
                        market_id,
                        oracle,
                        period,
                        deadlines,
                        metadata,
                        market_type,
                        dispute_mechanism,
                        scoring_rule,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn redeem_shares(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::RedeemShares { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        /// @note: Requires SUDO
        #[ink(message)]
        pub fn reject_market(
            &mut self,
            market_id: MarketId,
            reject_reason: ink::prelude::vec::Vec<u8>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::RejectMarket {
                        market_id,
                        reject_reason,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn report(&mut self, market_id: MarketId, outcome: OutcomeReport) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::Report { market_id, outcome },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn sell_complete_set(&mut self, market_id: MarketId, amount: Balance) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::SellCompleteSet { market_id, amount },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn start_global_dispute(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::StartGlobalDispute { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn create_market_and_deploy_pool(
            &mut self,
            base_asset: ZeitgeistAsset,
            creator_fee: Perbill,
            oracle: AccountId,
            period: MarketPeriod,
            deadlines: Deadlines,
            metadata: MultiHash,
            market_type: MarketType,
            dispute_mechanism: Option<MarketDisputeMechanism>,
            amount: Balance,
            spot_prices: ink::prelude::vec::Vec<Balance>,
            swap_fee: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::CreateMarketAndDeployPool {
                        base_asset,
                        creator_fee,
                        oracle,
                        period,
                        deadlines,
                        metadata,
                        market_type,
                        dispute_mechanism,
                        amount,
                        spot_prices,
                        swap_fee,
                    },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn schedule_early_close(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::ScheduleEarlyClose { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn dispute_early_close(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::DisputeEarlyClose { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn reject_early_close(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::RejectEarlyClose { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn close_trusted_market(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::CloseTrustedMarket { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn manually_close_market(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::ManuallyCloseMarket { market_id },
                ))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Neoswaps

        #[ink(message)]
        pub fn neoswap_buy(
            &mut self,
            market_id: MarketId,
            asset_count: AssetIndexType,
            asset_out: ZeitgeistAsset,
            amount_in: Balance,
            min_amount_out: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::NeoSwaps(NeoSwapsCall::Buy {
                    market_id,
                    asset_count,
                    asset_out,
                    amount_in,
                    min_amount_out,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn neoswap_sell(
            &mut self,
            market_id: MarketId,
            asset_count: AssetIndexType,
            asset_in: ZeitgeistAsset,
            amount_in: Balance,
            min_amount_out: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::NeoSwaps(NeoSwapsCall::Sell {
                    market_id,
                    asset_count,
                    asset_in,
                    amount_in,
                    min_amount_out,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn neoswap_join(
            &mut self,
            market_id: MarketId,
            pool_shares_amount: Balance,
            max_amounts_in: ink::prelude::vec::Vec<Balance>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::NeoSwaps(NeoSwapsCall::Join {
                    market_id,
                    pool_shares_amount,
                    max_amounts_in,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn neoswap_exit(
            &mut self,
            market_id: MarketId,
            pool_shares_amount_out: Balance,
            min_amounts_out: ink::prelude::vec::Vec<Balance>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::NeoSwaps(NeoSwapsCall::Exit {
                    market_id,
                    pool_shares_amount_out,
                    min_amounts_out,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn neoswap_withdraw_fees(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::NeoSwaps(NeoSwapsCall::WithdrawFees {
                    market_id,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn neoswap_deploy_pool(
            &mut self,
            market_id: MarketId,
            amount: Balance,
            spot_prices: ink::prelude::vec::Vec<Balance>,
            swap_fee: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::NeoSwaps(NeoSwapsCall::DeployPool {
                    market_id,
                    amount,
                    spot_prices,
                    swap_fee,
                }))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Orderbook

        #[ink(message)]
        pub fn remove_order(&mut self, order_id: OrderId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Orderbook(OrderbookCall::RemoveOrder {
                    order_id,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn fill_order(
            &mut self,
            order_id: OrderId,
            maker_partial_fill: Option<Balance>,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Orderbook(OrderbookCall::FillOrder {
                    order_id,
                    maker_partial_fill,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn place_order(
            &mut self,
            market_id: MarketId,
            maker_asset: ZeitgeistAsset,
            maker_amount: Balance,
            taker_asset: ZeitgeistAsset,
            taker_amount: Balance,
        ) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Orderbook(OrderbookCall::PlaceOrder {
                    market_id,
                    maker_asset,
                    maker_amount,
                    taker_asset,
                    taker_amount,
                }))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Parimutuel

        #[ink(message)]
        pub fn parimutuel_buy(&mut self, asset: ZeitgeistAsset, amount: Balance) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Parimutuel(ParimutelCall::Buy {
                    asset,
                    amount,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn parimutuel_claim_rewards(&mut self, market_id: MarketId) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Parimutuel(ParimutelCall::ClaimRewards {
                    market_id,
                }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn parimutuel_claim_refunds(&mut self, refund_asset: ZeitgeistAsset) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::Parimutuel(ParimutelCall::ClaimRefunds {
                    refund_asset,
                }))
                .map_err(Into::<Error>::into)
        }

        // endregion
    }
}
