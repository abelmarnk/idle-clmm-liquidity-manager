use anchor_lang::prelude::*;

#[error_code]
pub enum StrategyError{
    #[msg("The pool given does not match what is expected")]
    InvalidPool,
    #[msg("The NFT mint supplied not match what is expected")]
    InvalidNFTMint,
    #[msg("The destination mint supplied is not whitelisted")]
    DestinationMintNotWhitelisted,
    #[msg("The destination mint does not match the supplied mint and swaps are not enabled")]
    DestinationMintDoesNotMatchSwapMint,
    #[msg("The program is currently not open to creating positions")]
    ProgramNotOpenToCreatingPositions,
    #[msg("The account provided is not a valid user state account")]
    InvalidUserStateAccount,
    #[msg("The account provided is an unexpected token account")]
    InvalidTokenAccount,
    #[msg("The account provided is not the global state token account")]
    InvalidGlobalStateAccount,    
    #[msg("The current tick is not out of the required range to perform the decrease liquidity")]
    TickNotOutOfRange, 
    #[msg("Tick not within range")]
    TickNotWithinRange,
    #[msg("The position is deployed")]   
    PositionDeployed,
    #[msg("The position is not deployed")]   
    PositionNotDeployed,
    #[msg("The user is not authorized to perform this action")]
    UnauthorizedUser,
    #[msg("Insufficient liquidity in the position to perform this action")]
    InsufficientLiquidity,
    #[msg("Missing token accounts to withdraw dust")]
    MissingDustAccounts,
    #[msg("The action is not authorized")]
    UnauthorizedAction,
    #[msg("The account provided is not expected")]
    UnexpectedAccount,
    #[msg("Insufficient credits")]
    InsufficientCredits,
    #[msg("Numerical overflow occurred")]
    NumericalOverflow,
    #[msg("Missing raydium or meteora accounts")]
    MissingRaydiumOrMeteoraAccounts

}