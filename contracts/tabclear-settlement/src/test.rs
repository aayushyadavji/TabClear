#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};
use tabclear_requests::{TabclearRequests, TabclearRequestsClient};

struct Fixture<'a> {
    env: Env,
    settlement: TabclearSettlementClient<'a>,
    requests: TabclearRequestsClient<'a>,
    token: TokenClient<'a>,
    token_admin: StellarAssetClient<'a>,
    merchant: Address,
    payer: Address,
}

fn setup<'a>() -> Fixture<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let requests_id = env.register(TabclearRequests, ());
    let requests = TabclearRequestsClient::new(&env, &requests_id);

    let settlement_id = env.register(TabclearSettlement, ());
    let settlement = TabclearSettlementClient::new(&env, &settlement_id);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let token_admin = StellarAssetClient::new(&env, &sac.address());

    let admin = Address::generate(&env);
    let merchant = Address::generate(&env);
    let payer = Address::generate(&env);

    requests.initialize(&admin);
    requests.set_settlement(&settlement_id);
    settlement.initialize(&requests_id, &sac.address());

    Fixture {
        env,
        settlement,
        requests,
        token,
        token_admin,
        merchant,
        payer,
    }
}

#[test]
fn atomic_settle_moves_funds_and_marks_paid() {
    let f = setup();
    f.token_admin.mint(&f.payer, &1_000);

    let id = f
        .requests
        .create_request(&f.merchant, &250, &String::from_str(&f.env, "table 4"));
    f.settlement.pay_request(&id, &f.payer);

    // One transaction: funds moved AND the request flipped to Paid.
    assert_eq!(f.token.balance(&f.payer), 750);
    assert_eq!(f.token.balance(&f.merchant), 250);
    let req = f.requests.get_request(&id);
    assert_eq!(req.status, tabclear_requests::Status::Paid);
    assert_eq!(req.paid_by, Some(f.payer.clone()));
}

#[test]
fn insufficient_balance_rolls_everything_back() {
    let f = setup();
    f.token_admin.mint(&f.payer, &10); // not enough for a 250 request

    let id = f
        .requests
        .create_request(&f.merchant, &250, &String::from_str(&f.env, "big order"));
    assert!(f.settlement.try_pay_request(&id, &f.payer).is_err());

    // Atomicity: no partial state — balances untouched, request still Open.
    assert_eq!(f.token.balance(&f.payer), 10);
    assert_eq!(f.token.balance(&f.merchant), 0);
    assert_eq!(
        f.requests.get_request(&id).status,
        tabclear_requests::Status::Open
    );
}

#[test]
fn double_settle_rejected() {
    let f = setup();
    f.token_admin.mint(&f.payer, &1_000);

    let id = f
        .requests
        .create_request(&f.merchant, &100, &String::from_str(&f.env, "coffee"));
    f.settlement.pay_request(&id, &f.payer);

    let err = f
        .settlement
        .try_pay_request(&id, &f.payer)
        .err()
        .unwrap()
        .unwrap();
    assert_eq!(err, Error::RequestNotOpen);
    // Only charged once.
    assert_eq!(f.token.balance(&f.payer), 900);
}

#[test]
fn cancelled_request_cannot_be_paid() {
    let f = setup();
    f.token_admin.mint(&f.payer, &1_000);

    let id = f
        .requests
        .create_request(&f.merchant, &100, &String::from_str(&f.env, "typo"));
    f.requests.cancel_request(&id);

    let err = f
        .settlement
        .try_pay_request(&id, &f.payer)
        .err()
        .unwrap()
        .unwrap();
    assert_eq!(err, Error::RequestNotOpen);
    assert_eq!(f.token.balance(&f.payer), 1_000);
}

#[test]
fn initialize_only_once() {
    let f = setup();
    let other = Address::generate(&f.env);
    let err = f
        .settlement
        .try_initialize(&other, &other)
        .err()
        .unwrap()
        .unwrap();
    assert_eq!(err, Error::AlreadyInitialized);
}

#[test]
fn getters_expose_wiring() {
    let f = setup();
    assert_eq!(f.settlement.requests_address(), f.requests.address);
    assert_eq!(f.settlement.token_address(), f.token.address);
}
