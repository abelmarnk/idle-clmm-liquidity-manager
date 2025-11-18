use anchor_lang::prelude::*;

declare_id!("FUydjpRuVPkaWQkDSU32aKGG1qFZ4C23KiNh7b66hB79");

pub mod state;
pub mod error;
pub mod constants;
pub mod helpers;

pub mod instructions;
pub use instructions::*;

#[program]
pub mod strategy {

    use super::*;

    pub fn admin_initialize_config(ctx:Context<AdminInitializeConfigAccounts>, args:AdminInitializeConfigArgs)->Result<()>{
        admin_initialize_config_handler(ctx, args)
    }

    pub fn admin_change_config(ctx:Context<AdminChangeConfigAccounts>, args:AdminChangeConfigArgs)->Result<()>{
        admin_change_config_handler(ctx, args)
    }

    pub fn admin_whitelist_mint(ctx:Context<AdminWhitelistMintAccounts>)->Result<()>{
        admin_whitelist_mint_handler(ctx)
    }

    pub fn admin_unwhitelist_mint(ctx:Context<AdminUnwhitelistMintAccounts>)->Result<()>{
        admin_unwhitelist_mint_handler(ctx)
    }

    pub fn admin_withdraw_sol(ctx:Context<AdminWithdrawSolAccounts>, args:AdminWithdrawSolArgs)->Result<()>{
        admin_withdraw_sol_handler(ctx, args)
    }

    pub fn admin_withdraw_tokens(ctx:Context<AdminWithdrawTokenAccounts>, args:AdminWithdrawTokenArgs)->Result<()>{
        admin_withdraw_tokens_handler(ctx, args)
    }

    pub fn create_keeper_account(ctx:Context<KeeperCreateAccounts>)->Result<()>{
        create_keeper_account_handler(ctx)
    }

    #[instruction(discriminator = 1)]
    pub fn keeper_increase_liquidity_position<'a, 'b, 'c, 'info>(ctx:Context<'a, 'b, 'c, 'info, KeeperIncreaseLiquidityPositionAccounts<'info>>, args:KeeperIncreaseLiquidityPositionArgs)->Result<()>{
        keeper_increase_liquidity_position_handler(ctx, args)
    }

    pub fn keeper_decrease_liquidity_position<'a, 'b, 'c, 'info>(ctx:Context<'a, 'b, 'c, 'info, KeeperDecreaseLiquidityPositionAccounts<'info>>, args:KeeperDecreaseLiquidityPositionArgs)->Result<()>{
        keeper_decrease_liquidity_position_handler(ctx, args)   
    }
    
    pub fn keeper_withdraw_rewards(ctx:Context<KeeperWithdrawRewardsAccounts>)->Result<()>{
        keeper_withdraw_rewards_handler(ctx)
    }

    pub fn user_create_position_from_raydium<'a, 'b, 'c, 'info>( 
        ctx:Context<'a, 'b, 'c, 'info, UserCreatePositionFromRaydiumAccounts<'info>>, 
        args:UserCreatePositionFromRaydiumArgs)->Result<()>
        {
        user_create_position_from_raydium_handler(ctx, args)
    }

    pub fn user_close_position<'a, 'b, 'c, 'info>(ctx:Context<'a, 'b, 'c, 'info,UserClosePositionAccounts<'info>>, args:UserClosePositionArgs)->Result<()>{
        user_close_position_handler(ctx, args)
    }
}
