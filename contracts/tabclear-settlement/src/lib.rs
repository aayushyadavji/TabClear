#![no_std]
// Stable event ABI kept via events().publish; see tabclear-requests for rationale.
#![allow(deprecated)]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, symbol_short, token,
    Address, Env, String,
};

// Cross-contract interface to tabclear-requests. Declared locally (rather than
// depending on the requests crate for the wasm build) so the two contracts don't
// export colliding `#[contractimpl]` symbols into one cdylib. The shapes below
// must stay in sync with tabclear-requests' `Request` / `Status` / `settle`.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Open,
    Paid,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct Request {
    pub merchant: Address,
    pub amount: i128,
    pub memo: String,
    pub status: Status,
    pub created_at: u64,
    pub paid_by: Option<Address>,
    pub paid_at: Option<u64>,
}

#[contractclient(name = "RequestsClient")]
pub trait RequestsInterface {
    fn get_request(env: Env, id: u32) -> Request;
    fn settle(env: Env, id: u32, payer: Address);
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Requests,
    Token,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    RequestNotOpen = 3,
}

const DAY_LEDGERS: u32 = 17280;

#[contract]
pub struct TabclearSettlement;

#[contractimpl]
impl TabclearSettlement {
    /// One-time wiring: the requests contract to settle against and the token
    /// (native XLM Stellar Asset Contract) used to move funds.
    pub fn initialize(env: Env, requests: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Requests) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Requests, &requests);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage()
            .instance()
            .extend_ttl(30 * DAY_LEDGERS, 90 * DAY_LEDGERS);
        Ok(())
    }

    /// Atomically settle a payment request in ONE transaction:
    ///   1. read the request from tabclear-requests   (cross-contract read)
    ///   2. move XLM payer -> merchant via the SAC     (token contract call)
    ///   3. mark the request settled with the payer    (cross-contract write)
    /// If any step fails the whole transaction rolls back.
    pub fn pay_request(env: Env, id: u32, payer: Address) -> Result<(), Error> {
        payer.require_auth();

        let requests_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Requests)
            .ok_or(Error::NotInitialized)?;
        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;

        let requests = RequestsClient::new(&env, &requests_addr);
        let request = requests.get_request(&id);
        if request.status != Status::Open {
            return Err(Error::RequestNotOpen);
        }

        token::Client::new(&env, &token_addr).transfer(&payer, &request.merchant, &request.amount);
        requests.settle(&id, &payer);

        // topics: ("settled", id) | data: (payer, merchant, amount)
        env.events().publish(
            (symbol_short!("settled"), id),
            (payer, request.merchant, request.amount),
        );
        Ok(())
    }

    /// The wired requests contract address.
    pub fn requests_address(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Requests)
            .ok_or(Error::NotInitialized)
    }

    /// The wired token (SAC) address.
    pub fn token_address(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)
    }
}

mod test;
