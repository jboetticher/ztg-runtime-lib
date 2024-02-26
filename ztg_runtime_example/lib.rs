#![cfg_attr(not(feature = "std"), no_std, no_main)]
#[ink::contract]
mod ztg_runtime_example {
    use core::ops::Range;
    use sp_runtime::Perbill;
    use ztg_runtime_lib::primitives::*;
    use ztg_runtime_lib::runtime_structs::{PredictionMarketsCall, RuntimeCall, StyxCall};
    use ink::env::Error as EnvError;

    #[derive(Debug, PartialEq, Eq, scale::Encode, scale::Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error { CallRuntimeFailed }

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

        // region: Styx

        #[ink(message)]
        pub fn set_burn_amount(&mut self, amount: Balance) -> Result<()> {
            self.env().call_runtime(
                &RuntimeCall::Styx(
                    StyxCall::SetBurnAmount {
                        amount
                    }
                )
            ).map_err(Into::<Error>::into)
        }

        #[ink(message)]
        pub fn cross(&mut self) -> Result<()> {
            self.env().call_runtime(
                &RuntimeCall::Styx(
                    StyxCall::Cross
                )
            ).map_err(Into::<Error>::into)
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
            self.env()
                .call_runtime(&RuntimeCall::PredictionMarkets(
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

    /// This is how you'd write end-to-end (E2E) or integration tests for ink! contracts.
    ///
    /// When running these you need to make sure that you:
    /// - Compile the tests with the `e2e-tests` feature flag enabled (`--features e2e-tests`)
    /// - Are running a Substrate node which contains `pallet-contracts` in the background
    #[cfg(all(test))]
    mod e2e_tests {
        /// Imports all the definitions from the outer scope so we can use them here.
        use super::*;

        /// A helper function used for calling contract messages.

        /// The End-to-End test `Result` type.
        type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

        /// We test that we can upload and instantiate the contract using its default constructor.
        #[ink_e2e::test]
        async fn default_works(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
            // Instantiate the smart contract
            let contract_account_id = client
                .instantiate(
                    "ztg_runtime_example",
                    &ink_e2e::alice(),
                    ZtgRuntimeExampleRef::default(),
                    0,
                    None,
                )
                .await
                .expect("instantiate failed")
                .account_id;

            // Then check to see that the default outcome was created
            let get = ink_e2e::build_message::<ZtgRuntimeExampleRef>(contract_account_id.clone())
                .call(|ztg_runtime_example| ztg_runtime_example.get_outcome());
            let get_result = client.call_dry_run(&ink_e2e::alice(), &get, 0, None).await;
            assert!(matches!(
                get_result.return_value(),
                OutcomeReport::Scalar(0)
            ));

            Ok(())
        }
    }
}
