use std::ops::Sub;

use anchor_lang::{
    system_program::{
        Allocate,
        Transfer,
        allocate,
        transfer
    },
    prelude::*
};
use anchor_spl::{associated_token::get_associated_token_address, token_interface::{transfer_checked, TransferChecked}};

pub fn is_ata(account:&Pubkey, token_account_key:&Pubkey, mint_account_key: &Pubkey)->bool{
    get_associated_token_address(account, &mint_account_key).
    eq(token_account_key)
} 

pub fn transfer_token<'info>(
    from_account: AccountInfo<'info>,
    from_token_account: AccountInfo<'info>,
    mint_account: AccountInfo<'info>,
    to_token_account: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    if amount.ne(&0) {
        transfer_checked(
            CpiContext::new_with_signer(
                token_program,
                TransferChecked {
                    from: from_token_account,
                    mint: mint_account,
                    to: to_token_account,
                    authority: from_account,
                },
                signer_seeds,
            ),
            amount,
            decimals,
        )?;
    }
        
    Ok(())
}

pub fn resize_if_necessary<'info>(
    mut current_size:usize,
    buffer:usize,
    payer:AccountInfo<'info>,
    account:AccountInfo<'info>,
    system_program:AccountInfo<'info>
)->Result<()>{
    if account.data_len().lt(&current_size){
        current_size = current_size.checked_add(buffer).unwrap();

        let lamports = Rent::get()?.minimum_balance(current_size);

        transfer(
            CpiContext::new(
                system_program.clone(), 
                Transfer { 
                    from: payer, 
                    to: account.clone() 
                }
            ),
            lamports.sub(account.lamports())
        )?;

        allocate(
            CpiContext::new(
                system_program,
                Allocate { 
                    account_to_allocate: account 
                }
            ), 
            u64::try_from(current_size).unwrap()
        )?;
    }

    Ok(())
}

/// Build the deposit/withdraw account metas from the remaining accounts
/// Meteora uses the same set of accounts for both actions
pub fn build_meteora_deposit_withdraw_metas(
    remaining_accounts: &[AccountInfo<'_>]
)-> Vec<AccountMeta>{

    let mut account_metas: Vec<AccountMeta> = remaining_accounts
        .iter()
        .skip(1) // Skip the program account
        .map(|account| {
                AccountMeta{
                 pubkey:*account.key,
                 is_signer:account.is_signer,
                 is_writable:account.is_writable   
                }
        })
        .collect();

    // Ensure sixth account (depositor) is marked as a signer, it is the only signer account
    // https://github.com/MeteoraAg/vault-sdk/blob/main/programs/vault/src/context.rs#L39
    account_metas[5].is_signer = true;

    account_metas
}

/// Build the account metas from the remaining accounts
pub fn build_increase_liquidity_v2_metas(
    remaining_accounts: &[AccountInfo<'_>],
) -> Vec<AccountMeta> {
    build_decrease_increase_liquidity_v2_metas(remaining_accounts)
}

/// Build the account metas from the remaining accounts
pub fn build_decrease_liquidity_v2_metas(
    remaining_accounts: &[AccountInfo<'_>],
) -> Vec<AccountMeta> {
    build_decrease_increase_liquidity_v2_metas(remaining_accounts)
}

/// Build the account metas from the remaining accounts
/// The accounts for decrease_liquidity_v2 and increase_liquidity_v2
/// are different but the only thing this assumes is that the only 
/// signer is at the first position which is true for both
pub fn build_decrease_increase_liquidity_v2_metas(
    remaining_accounts: &[AccountInfo<'_>],
) -> Vec<AccountMeta> {
    let mut account_metas: Vec<AccountMeta> = remaining_accounts
        .iter()
        .skip(1) // Skip the program account
        .map(|account| {
                AccountMeta{
                 pubkey:*account.key,
                 is_signer:account.is_signer,
                 is_writable:account.is_writable   
                }
        })
        .collect();

    // Ensure first account (nft_owner) is marked as a signer, it is the only signer account
    // https://github.com/raydium-io/raydium-clmm/blob/master/programs/amm/src/instructions/increase_liquidity_v2.rs#L10
    // https://github.com/raydium-io/raydium-clmm/blob/master/programs/amm/src/instructions/decrease_liquidity_v2.rs#L11
    account_metas[0].is_signer = true;

    account_metas
}
