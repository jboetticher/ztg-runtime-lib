#[cfg(test)]
mod tests {
    mod mock;

    use frame_support::assert_ok;
    use zrml_styx::{Event, pallet::Pallet, BurnAmount};

    use crate::tests::mock::{Runtime, RuntimeOrigin, System};

    use self::mock::ExtBuilder;

    

    #[test]
    fn it_works() {
        // assert_ok!(true);
        assert!(true);
    }

    #[test]
fn should_set_burn_amount() {
    ExtBuilder::default().build().execute_with(|| {
        frame_system::Pallet::<Runtime>::set_block_number(1);
        assert_ok!(Pallet::set_burn_amount(RuntimeOrigin::signed(SUDO), 144u128));
        System::assert_last_event(Event::CrossingFeeChanged(144u128).into());
        assert_eq!(BurnAmount::<Runtime>::get(), 144u128);
    });
}
}
