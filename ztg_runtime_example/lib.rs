#![cfg_attr(not(feature = "std"), no_std, no_main)]
#[ink::contract]
mod ztg_runtime_example {
    use core::ops::Range;
    use ink::env::Error as EnvError;
    use sp_runtime::Perbill;
    use ztg_runtime_lib::primitives::*;
    use ztg_runtime_lib::runtime_structs::{
        AssetManagerCall, CourtCall, PredictionMarketsCall, RuntimeCall, StyxCall,
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

        // TODO:
        /*

        #[codec(index = 4)]
        Vote {
            #[codec(compact)]
            court_id: CourtId,
            commitment_vote: Hash,
        },
        /// Denounce a juror during the voting period for which the commitment vote is known.
        /// https://github.com/zeitgeistpm/zeitgeist/tree/release-v0.5.0/zrml/court/src/lib.rs#L784
        #[codec(index = 5)]
        DenounceVote {
            #[codec(compact)]
            court_id: CourtId,
            juror: AccountId, // AccountIdLookupOf<T>
            vote_item: VoteItem,
            salt: Hash,
        },
        /// Reveal the commitment vote of the caller, who is a selected juror.
        /// https://github.com/zeitgeistpm/zeitgeist/tree/release-v0.5.0/zrml/court/src/lib.rs#L868
        #[codec(index = 6)]
        RevealVote {
            #[codec(compact)]
            court_id: CourtId,
            vote_item: VoteItem,
            salt: Hash,
        },
        /// Initiate an appeal for a court
        /// https://github.com/zeitgeistpm/zeitgeist/tree/release-v0.5.0/zrml/court/src/lib.rs#L957
        #[codec(index = 7)]
        Appeal {
            #[codec(compact)]
            court_id: CourtId,
        },
        /// Reassign the stakes of the jurors and delegators
        /// https://github.com/zeitgeistpm/zeitgeist/tree/release-v0.5.0/zrml/court/src/lib.rs#L1046
        #[codec(index = 8)]
        ReassignCourtStakes {
            #[codec(compact)]
            court_id: CourtId,
        },
        /// Set the yearly inflation rate of the court system.
        /// https://github.com/zeitgeistpm/zeitgeist/tree/release-v0.5.0/zrml/court/src/lib.rs#L1167
        #[codec(index = 9)]
        SetInflation { inflation: Perbill },

        */

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
                        scoring_rule
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
                        scoring_rule
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
        pub fn reject_market(&mut self, market_id: MarketId, reject_reason: ink::prelude::vec::Vec<u8>) -> Result<()> {
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
                    PredictionMarketsCall::RejectMarket { market_id, reject_reason },
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
            swap_fee: Balance
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
                        swap_fee
                    },
                ))
                .map_err(Into::<Error>::into)
        }
        
        /// @note: Requires SUDO
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

        // #[ink(message)]
        // pub fn set_outcome_to_scalar_five(&mut self) {
        //     self.outcome_report = OutcomeReport::Scalar(5);
        // }

        // /// Returns the current value of the Flipper's boolean.
        // #[ink(message)]
        // pub fn get_outcome(&self) -> OutcomeReport {
        //     self.outcome_report.clone()
        // }

        // pub fn create_market(&mut self) -> ink::env::Result<()> {
        //     self.env().call_runtime(&RuntimeCall::PredictionMarkets(
        //         PredictionMarketsCall::CreateMarket {
        //             base_asset: ZeitgeistAsset::Ztg,
        //             creator_fee: Perbill::zero(),
        //             oracle: self.env().account_id(),
        //             period: MarketPeriod::Block(Range { start: 5, end: 8 }),
        //             deadlines: Deadlines {
        //                 grace_period: 0,
        //                 oracle_duration: 0,
        //                 dispute_duration: 0,
        //             },
        //             metadata: MultiHash::Sha3_384([0; 50]),
        //             creation: MarketCreation::Permissionless,
        //             market_type: MarketType::Categorical(2),
        //             dispute_mechanism: None,
        //             scoring_rule: ScoringRule::Orderbook,
        //         },
        //     ))?;

        //     Ok(())
        // }
    }
}
