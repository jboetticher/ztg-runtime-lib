#![cfg_attr(not(feature = "std"), no_std, no_main)]
#[ink::contract]
mod ztg_runtime_example {
    use core::ops::Range;
    use ink::env::Error as EnvError;
    use sp_runtime::Perbill;
    use ztg_runtime_lib::primitives::*;
    use ztg_runtime_lib::runtime_structs::{AssetManagerCall, CourtCall, PredictionMarketsCall, RuntimeCall, StyxCall};

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
                    amount
                }))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Court

        #[ink(message)]
        pub fn join_court(&mut self, amount: Balance) -> Result<()>  {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::JoinCourt { amount }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn delegate(&mut self, amount: Balance, delegations: ink::prelude::vec::Vec<AccountId>) -> Result<()>  {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::Delegate { amount, delegations }))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn prepare_exit_court(&mut self) -> Result<()>  {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::PrepareExitCourt))
                .map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn exit_court(&mut self, court_participant: AccountId) -> Result<()>  {
            self.env()
                .call_runtime(&RuntimeCall::Court(CourtCall::ExitCourt { 
                    court_participant: court_participant.into() 
                }))
                .map_err(Into::<Error>::into)
        }

        // endregion

        // region: Styx

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

        #[ink(message)]
        pub fn set_outcome_to_scalar_five(&mut self) {
            self.outcome_report = OutcomeReport::Scalar(5);
        }

        /// Returns the current value of the Flipper's boolean.
        #[ink(message)]
        pub fn get_outcome(&self) -> OutcomeReport {
            self.outcome_report.clone()
        }

        pub fn create_market(&mut self) -> ink::env::Result<()> {
            self.env().call_runtime(&RuntimeCall::PredictionMarkets(
                PredictionMarketsCall::CreateMarket {
                    base_asset: ZeitgeistAsset::Ztg,
                    creator_fee: Perbill::zero(),
                    oracle: self.env().account_id(),
                    period: MarketPeriod::Block(Range { start: 5, end: 8 }),
                    deadlines: Deadlines {
                        grace_period: 0,
                        oracle_duration: 0,
                        dispute_duration: 0,
                    },
                    metadata: MultiHash::Sha3_384([0; 50]),
                    creation: MarketCreation::Permissionless,
                    market_type: MarketType::Categorical(2),
                    dispute_mechanism: None,
                    scoring_rule: ScoringRule::Orderbook,
                },
            ))?;

            Ok(())
        }
    }
}
