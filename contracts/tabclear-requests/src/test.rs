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
    assert_eq!(req.paid, false);
    assert_eq!(client.total_requests(), 1);
}

#[test]
fn mark_paid_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, merchant) = setup(&env);

    let id = client.create_request(&merchant, &50, &String::from_str(&env, "coffee"));
    client.mark_paid(&id);
    assert_eq!(client.get_request(&id).paid, true);
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
