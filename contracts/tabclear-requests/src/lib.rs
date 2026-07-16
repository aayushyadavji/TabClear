#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Counter,
    Request(u32),
}

#[contracttype]
#[derive(Clone)]
pub struct Request {
    pub merchant: Address,
    pub amount: i128,
    pub memo: String,
    pub paid: bool,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    AlreadyPaid = 2,
    InvalidAmount = 3,
}

const DAY_LEDGERS: u32 = 17280;

#[contract]
pub struct TabclearRequests;

#[contractimpl]
impl TabclearRequests {
    /// Merchant opens a payment request. Returns the new request id.
    pub fn create_request(
        env: Env,
        merchant: Address,
        amount: i128,
        memo: String,
    ) -> Result<u32, Error> {
        merchant.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let id: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0) + 1;
        let request = Request {
            merchant: merchant.clone(),
            amount,
            memo,
            paid: false,
        };
        env.storage().persistent().set(&DataKey::Request(id), &request);
        env.storage().instance().set(&DataKey::Counter, &id);
        env.storage()
            .instance()
            .extend_ttl(30 * DAY_LEDGERS, 90 * DAY_LEDGERS);

        // topics: ("created", merchant) | data: (id, amount)
        env.events()
            .publish((symbol_short!("created"), merchant), (id, amount));
        Ok(id)
    }

    /// Read a request by id.
    pub fn get_request(env: Env, id: u32) -> Result<Request, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Request(id))
            .ok_or(Error::NotFound)
    }

    /// Mark a request paid. Only the merchant may call; rejects double-pay.
    pub fn mark_paid(env: Env, id: u32) -> Result<(), Error> {
        let mut request: Request = env
            .storage()
            .persistent()
            .get(&DataKey::Request(id))
            .ok_or(Error::NotFound)?;
        request.merchant.require_auth();
        if request.paid {
            return Err(Error::AlreadyPaid);
        }
        request.paid = true;
        let merchant = request.merchant.clone();
        env.storage().persistent().set(&DataKey::Request(id), &request);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Request(id), 30 * DAY_LEDGERS, 90 * DAY_LEDGERS);

        // topics: ("paid", merchant) | data: id
        env.events().publish((symbol_short!("paid"), merchant), id);
        Ok(())
    }

    /// Total number of requests ever created.
    pub fn total_requests(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}

mod test;

