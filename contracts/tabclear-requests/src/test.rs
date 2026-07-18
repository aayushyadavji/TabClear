#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup(env: &Env) -> (TabclearRequestsClient, Address) {
    let contract_id = env.register(TabclearRequests, ());
    let client = TabclearRequestsClient::new(env, &contract_id);
    let merchant = Address::generate(env);
    (client, merchant)
}

#[test]
fn create_and_read() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);

    let id = client.create_request(&merchant, &100, &String::from_str(&env, "table 4"));
    assert_eq!(id, 1);

    let req = client.get_request(&id);
    assert_eq!(req.merchant, merchant);
    assert_eq!(req.amount, 100);
    assert_eq!(req.status, Status::Open);
    assert_eq!(req.paid_by, None);
    assert_eq!(client.total_requests(), 1);
}

#[test]
fn mark_paid_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);

    let id = client.create_request(&merchant, &50, &String::from_str(&env, "coffee"));
    client.mark_paid(&id);
    assert_eq!(client.get_request(&id).status, Status::Paid);
}

#[test]
fn double_pay_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);

    let id = client.create_request(&merchant, &50, &String::from_str(&env, "coffee"));
    client.mark_paid(&id);
    let err = client.try_mark_paid(&id).err().unwrap().unwrap();
    assert_eq!(err, Error::AlreadyPaid);
}

#[test]
fn missing_request_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _merchant) = setup(&env);

    let err = client.try_get_request(&999).err().unwrap().unwrap();
    assert_eq!(err, Error::NotFound);
}

#[test]
fn invalid_amount_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);

    let err = client
        .try_create_request(&merchant, &0, &String::from_str(&env, "x"))
        .err()
        .unwrap()
        .unwrap();
    assert_eq!(err, Error::InvalidAmount);
}

#[test]
fn initialize_only_once() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _merchant) = setup(&env);
    let admin = Address::generate(&env);

    client.initialize(&admin);
    let err = client.try_initialize(&admin).err().unwrap().unwrap();
    assert_eq!(err, Error::AlreadyInitialized);
}

#[test]
fn set_settlement_requires_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _merchant) = setup(&env);
    let settlement = Address::generate(&env);

    let err = client.try_set_settlement(&settlement).err().unwrap().unwrap();
    assert_eq!(err, Error::NotInitialized);
}

#[test]
fn settle_records_payer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);
    let admin = Address::generate(&env);
    let settlement = Address::generate(&env);
    let payer = Address::generate(&env);

    client.initialize(&admin);
    client.set_settlement(&settlement);

    let id = client.create_request(&merchant, &75, &String::from_str(&env, "lunch"));
    client.settle(&id, &payer);

    let req = client.get_request(&id);
    assert_eq!(req.status, Status::Paid);
    assert_eq!(req.paid_by, Some(payer));
    assert!(req.paid_at.is_some());
}

#[test]
fn settle_requires_wiring() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);
    let payer = Address::generate(&env);

    let id = client.create_request(&merchant, &75, &String::from_str(&env, "lunch"));
    // No settlement contract wired -> settle must be rejected.
    let err = client.try_settle(&id, &payer).err().unwrap().unwrap();
    assert_eq!(err, Error::NotInitialized);
}

#[test]
fn settle_rejects_double_pay_and_cancelled() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);
    let admin = Address::generate(&env);
    let settlement = Address::generate(&env);
    let payer = Address::generate(&env);

    client.initialize(&admin);
    client.set_settlement(&settlement);

    let paid = client.create_request(&merchant, &10, &String::from_str(&env, "a"));
    client.settle(&paid, &payer);
    let err = client.try_settle(&paid, &payer).err().unwrap().unwrap();
    assert_eq!(err, Error::AlreadyPaid);

    let cancelled = client.create_request(&merchant, &10, &String::from_str(&env, "b"));
    client.cancel_request(&cancelled);
    let err = client.try_settle(&cancelled, &payer).err().unwrap().unwrap();
    assert_eq!(err, Error::Cancelled);
}

#[test]
fn cancel_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);

    let id = client.create_request(&merchant, &10, &String::from_str(&env, "typo"));
    client.cancel_request(&id);
    assert_eq!(client.get_request(&id).status, Status::Cancelled);

    // A cancelled request can't be paid manually either.
    let err = client.try_mark_paid(&id).err().unwrap().unwrap();
    assert_eq!(err, Error::Cancelled);
}

#[test]
fn list_requests_pages_newest_first() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);

    for i in 1..=5 {
        client.create_request(&merchant, &(i as i128 * 10), &String::from_str(&env, "r"));
    }

    // start=0 means "latest"; page of 2 -> ids 5, 4
    let page = client.list_requests(&0, &2);
    assert_eq!(page.len(), 2);
    assert_eq!(page.get(0).unwrap().0, 5);
    assert_eq!(page.get(1).unwrap().0, 4);

    // continue from id 3 -> ids 3, 2, 1
    let rest = client.list_requests(&3, &10);
    assert_eq!(rest.len(), 3);
    assert_eq!(rest.get(0).unwrap().0, 3);
    assert_eq!(rest.get(2).unwrap().0, 1);

    // empty contract -> empty page
    let fresh = env.register(TabclearRequests, ());
    let fresh_client = TabclearRequestsClient::new(&env, &fresh);
    assert_eq!(fresh_client.list_requests(&0, &10).len(), 0);
}
