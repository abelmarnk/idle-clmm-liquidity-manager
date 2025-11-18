use std::ops::Add;

use anchor_lang::prelude::*;
use anchor_spl::token::{CloseAccount, Mint, Token, TokenAccount, close_account};
use crate::{constants::{GLOBAL_STATE, METEORA_WITHDRAW_GLOBAL_STATE_ACCOUNT_OFFSET, METEORA_WITHDRAW_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET, METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT, RAYDIUM_INCREASE_LIQUIDITY_V2_ACCOUNTS_COUNT, USER_STATE}, error::StrategyError, helpers::transfer_token, increase_liquidity, state::{GlobalState, UserState}, withdraw_from_meteora_vault};


#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct UserClosePositionArgs{
    /// The minimum amount of the token to be gotten from meteora given our lp amount    
    pub token_amount_min:u64,
}

#[derive(Accounts)]
pub struct UserClosePositionAccounts<'info> {

    /// The user owning this position
    #[account(
        mut
    )]
    pub user: Signer<'info>,

    /// The user state
    #[account(
        mut,
        close = user
    )]
    pub user_state: Account<'info, UserState>,

    /// The user nft account    
    #[account(
        mut
    )]
    pub user_nft_account: Account<'info, TokenAccount>,

    /// The user state nft account
    #[account(
        mut
    )]
    pub user_state_nft_account: Account<'info, TokenAccount>,

    /// The mint for the nft
    pub nft_mint: Account<'info, Mint>,

    /// The token program, required for transferrring tokens
    pub token_program: Program<'info, Token>
}

#[inline(never)]
pub fn user_close_position_handler<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, UserClosePositionAccounts<'info>>,
    args: UserClosePositionArgs
) -> Result<()> {

    // Ensure the user matches
    require_keys_eq!(
        ctx.accounts.user_state.user,
        *ctx.accounts.user.key,
        StrategyError::UnauthorizedUser
    );

    if ctx.accounts.user_state.is_deployed(){
        require_gte!(
            ctx.remaining_accounts.len(),
            METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT.add(
                RAYDIUM_INCREASE_LIQUIDITY_V2_ACCOUNTS_COUNT
            ),
            StrategyError::MissingRaydiumOrMeteoraAccounts
        );

        let raydium_accounts = &ctx.remaining_accounts[METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT..];

        let user_state_account = &mut ctx.accounts.user_state;

        let meteora_accounts = &ctx.remaining_accounts[..METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT];

        let global_state_account = &meteora_accounts[METEORA_WITHDRAW_GLOBAL_STATE_ACCOUNT_OFFSET];

        let global_state = GlobalState::try_deserialize(&mut &global_state_account.try_borrow_data()?[..])?;

        let global_state_seeds: &[&[&[u8]]] = &[&[
            GLOBAL_STATE,
            &[global_state.bump]
        ]];

        let user_state_seeds: &[&[&[u8]]] = &[&[
            USER_STATE,
            user_state_account.user_mint.as_ref(),
            &[user_state_account.bump]
        ]];        

        // Withdraw from the meteora vaults into the global state token accounts
        let withdraw_amount = withdraw_from_meteora_vault(
            meteora_accounts, 
            global_state_account.key,
            user_state_account.lp_amount,
            args.token_amount_min, 
            global_state_seeds
        )?;
        

        let expected_token_account = 
            &meteora_accounts[METEORA_WITHDRAW_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET];

        let withdraw_amount = global_state.
            get_amount(
                user_state_account.amount_deposited_into_vault, 
                withdraw_amount
            )?;

        increase_liquidity(
                raydium_accounts,
                user_state_account,
                expected_token_account,
                withdraw_amount,
                user_state_seeds,
                global_state_seeds,
                true
        )?;
    }

    transfer_user_nft_and_close_account(&ctx)
}

pub fn transfer_user_nft_and_close_account(
    ctx: &Context<UserClosePositionAccounts>
)-> Result<()>{

    let signer_seeds: &[&[&[u8]]] = &[&[
            USER_STATE,
            ctx.accounts.user_state.user_mint.as_ref(),
            &[ctx.accounts.user_state.bump]
    ]];
    
    transfer_token(
        ctx.accounts.user_state.to_account_info(), 
        ctx.accounts.user_state_nft_account.to_account_info(), 
        ctx.accounts.nft_mint.to_account_info(), 
        ctx.accounts.user_nft_account.to_account_info(), 
        ctx.accounts.token_program.to_account_info(), 
        1, // NFT
        0, // NFT
        signer_seeds
    )?;

    close_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            CloseAccount{
                account:ctx.accounts.user_state_nft_account.to_account_info(),
                authority:ctx.accounts.user_state.to_account_info(),
                destination:ctx.accounts.user.to_account_info()
            }, 
            signer_seeds
        )
    )
}