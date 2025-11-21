use anchor_lang::{prelude::Pubkey, pubkey};

pub const SOL_VAULT:&[u8] = b"sol-vault"; 

pub const USER_STATE:&[u8] = b"user-state";

pub const GLOBAL_STATE:&[u8] = b"global-state";

pub const KEEPER_STATE:&[u8] = b"keeper-state";

pub const WHITELIST_STATE:&[u8] = b"whitelist-state";

pub const RAYDIUM_DECREASE_LIQUIDITY_V2_DISCRIMINATOR:[u8;8] = 
    [58, 127, 188, 62, 79, 82, 196, 96];
    
pub const RAYDIUM_INCREASE_LIQUIDITY_V2_DISCRIMINATOR:[u8;8] = 
    [133, 29, 89, 223, 69, 238, 176, 10];

pub const METEORA_VAULT_PROGRAM:Pubkey = 
    pubkey!("24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi");

pub const METEORA_VAULT_WITHDRAW_DISCRIMINATOR:[u8;8] = 
    [183, 18, 70, 156, 148, 109, 161, 34];

pub const METEORA_VAULT_DEPOSIT_DISCRIMINATOR:[u8;8] = 
    [242, 35, 198, 137, 82, 225, 242, 182];

pub const ALL_BASIS_POINTS:u64 = 10_000;

pub const METEORA_DEPOSIT_LIQUIDITY_ACCOUNTS_COUNT:usize = 7 + 1; // Include the program account

pub const METEORA_DEPOSIT_LP_MINT_ACCOUNT_OFFSET:usize = 2 + 1; // Include the program account
pub const METEORA_DEPOSIT_GLOBAL_STATE_ACCOUNT_OFFSET:usize = 5 + 1; // Include the program account
pub const METEORA_DEPOSIT_GLOBAL_STATE_LP_ACCOUNT_OFFSET:usize = 4 + 1; // Include the program account
pub const METEORA_DEPOSIT_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET:usize = 3 + 1; // Include the program account

pub const RAYDIUM_DECREASE_LIQUIDITY_V2_ACCOUNTS_COUNT:usize = 16 + 1; // Include the program account

pub const RAYDIUM_DECREASE_USER_STATE_ACCOUNT_OFFSET:usize = 0 + 1; // Include the program account
pub const RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET:usize = 9 + 1; // Include the program account
pub const RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET:usize = 10 + 1; // Include the program account
pub const RAYDIUM_DECREASE_POOL_STATE_ACCOUNT_OFFSET:usize = 3 + 1; // Include the program account
pub const RAYDIUM_DECREASE_POSITION_STATE_ACCOUNT_OFFSET:usize = 2 + 1; // Include the program account

pub const METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT:usize = 7 + 1; // Include the program account

pub const METEORA_WITHDRAW_LP_MINT_ACCOUNT_OFFSET:usize = 2 + 1; // Include the program account
pub const METEORA_WITHDRAW_GLOBAL_STATE_ACCOUNT_OFFSET:usize = 5 + 1; // Include the program account
pub const METEORA_WITHDRAW_GLOBAL_STATE_LP_ACCOUNT_OFFSET:usize = 4 + 1; // Include the program account
pub const METEORA_WITHDRAW_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET:usize = 3 + 1; // Include the program account

pub const RAYDIUM_INCREASE_USER_STATE_ACCOUNT_OFFSET:usize = 0 + 1; // Include the program account
pub const RAYDIUM_INCREASE_USER_STATE_NFT_ACCOUNT_OFFSET:usize = 1 + 1; // Include the program account
pub const RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET:usize = 7 + 1; // Include the program account
pub const RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET:usize = 8 + 1; // Include the program account
pub const RAYDIUM_INCREASE_TOKEN_PROGRAM_ACCOUNT_OFFSET:usize = 11 + 1; // Include the program account
pub const RAYDIUM_INCREASE_LIQUIDITY_V2_ACCOUNTS_COUNT:usize = 15 + 1;
pub const RAYDIUM_INCREASE_POOL_STATE_ACCOUNT_OFFSET:usize = 2 + 1; // Include the program account
