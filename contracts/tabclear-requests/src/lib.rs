#![no_std]
// events().publish is deprecated in favor of #[contractevent], but we keep the
// v1 topic/data layout as a stable event ABI for the existing frontend feed.
#![allow(deprecated)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Settlement,
    Counter,
    Request(u32),
}

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

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    AlreadyPaid = 2,
    InvalidAmount = 3,
    Unauthorized = 4,
    Cancelled = 5,
    NotInitialized = 6,
    AlreadyInitialized = 7,
}

const DAY_LEDGERS: u32 = 17280;
const MAX_PAGE: u32 = 50;

#[contract]
pub struct TabclearRequests;

#[contractimpl]
impl TabclearRequests {
    /// One-time setup. The admin can later wire in the settlement contract.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .extend_ttl(30 * DAY_LEDGERS, 90 * DAY_LEDGERS);
        Ok(())
    }

    /// Admin wires (or re-wires) the settlement contract allowed to call `settle`.
    pub fn set_settlement(env: Env, settlement: Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Settlement, &settlement);
        Ok(())
    }

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
            status: Status::Open,
            created_at: env.ledger().timestamp(),
            paid_by: None,
            paid_at: None,
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

    /// Newest-first page of requests. `start` is 1-based; 0 means "latest".
    pub fn list_requests(env: Env, start: u32, limit: u32) -> Vec<(u32, Request)> {
        let counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        let mut out: Vec<(u32, Request)> = Vec::new(&env);
        if counter == 0 {
            return out;
        }
        let from = if start == 0 || start > counter { counter } else { start };
        let take = limit.min(MAX_PAGE).max(1);
        let mut id = from;
        let mut taken = 0u32;
        while id >= 1 && taken < take {
            if let Some(req) = env.storage().persistent().get(&DataKey::Request(id)) {
                out.push_back((id, req));
                taken += 1;
            }
            if id == 1 {
                break;
            }
            id -= 1;
        }
        out
    }

    /// Atomic settlement hook: ONLY the wired settlement contract may call this.
    /// Records who paid and when, then emits the `paid` event.
    pub fn settle(env: Env, id: u32, payer: Address) -> Result<(), Error> {
        let settlement: Address = env
            .storage()
            .instance()
            .get(&DataKey::Settlement)
            .ok_or(Error::NotInitialized)?;
        // Implicit invoker auth: passes automatically when the settlement
        // contract is the direct cross-contract caller.
        settlement.require_auth();

        let mut request: Request = env
            .storage()
            .persistent()
            .get(&DataKey::Request(id))
            .ok_or(Error::NotFound)?;
        match request.status {
            Status::Paid => return Err(Error::AlreadyPaid),
            Status::Cancelled => return Err(Error::Cancelled),
            Status::Open => {}
        }
        request.status = Status::Paid;
        request.paid_by = Some(payer);
        request.paid_at = Some(env.ledger().timestamp());
        let merchant = request.merchant.clone();
        env.storage().persistent().set(&DataKey::Request(id), &request);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Request(id), 30 * DAY_LEDGERS, 90 * DAY_LEDGERS);

        // topics: ("paid", merchant) | data: id
        env.events().publish((symbol_short!("paid"), merchant), id);
        Ok(())
    }

    /// Merchant voids an unpaid request.
    pub fn cancel_request(env: Env, id: u32) -> Result<(), Error> {
        let mut request: Request = env
            .storage()
            .persistent()
            .get(&DataKey::Request(id))
            .ok_or(Error::NotFound)?;
        request.merchant.require_auth();
        match request.status {
            Status::Paid => return Err(Error::AlreadyPaid),
            Status::Cancelled => return Err(Error::Cancelled),
            Status::Open => {}
        }
        request.status = Status::Cancelled;
        let merchant = request.merchant.clone();
        env.storage().persistent().set(&DataKey::Request(id), &request);

        // topics: ("cancelled", merchant) | data: id
        env.events()
            .publish((symbol_short!("cancelled"), merchant), id);
        Ok(())
    }

    /// Legacy manual settle: the merchant marks a request paid themselves.
    pub fn mark_paid(env: Env, id: u32) -> Result<(), Error> {
        let mut request: Request = env
            .storage()
            .persistent()
            .get(&DataKey::Request(id))
            .ok_or(Error::NotFound)?;
        request.merchant.require_auth();
        match request.status {
            Status::Paid => return Err(Error::AlreadyPaid),
            Status::Cancelled => return Err(Error::Cancelled),
            Status::Open => {}
        }
        request.status = Status::Paid;
        request.paid_at = Some(env.ledger().timestamp());
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
