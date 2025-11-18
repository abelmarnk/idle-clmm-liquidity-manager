import * as fs from "fs";
import * as assert from "assert";
import * as anchor from "@coral-xyz/anchor";
import * as meteora from "@meteora-ag/vault-sdk"
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, clusterApiUrl, SystemProgram, Transaction, sendAndConfirmTransaction, AccountMeta, Connection } from "@solana/web3.js";
import { Strategy } from "../target/types/strategy";
import vaultIDL  from "../target/idl/meteora.json"
import { Vault } from "../target/types/meteora"
import { ASSOCIATED_PROGRAM_ID, TOKEN_PROGRAM_ID, } from "@coral-xyz/anchor/dist/cjs/utils/token";
import {ASSOCIATED_TOKEN_PROGRAM_ID, createAccount, createAssociatedTokenAccount, createAssociatedTokenAccountIdempotent, createMint, getAssociatedTokenAddressSync, mintTo, TOKEN_2022_PROGRAM_ID, getMint} from "@solana/spl-token";
import { ApiV3PoolInfoConcentratedItem, ClmmKeys, ComputeClmmPoolInfo, DEV_API_URLS, DEVNET_PROGRAM_ID, MEMO_PROGRAM_ID, PoolUtils, Price, publicKey, Raydium, RENT_PROGRAM_ID, ReturnTypeFetchMultiplePoolTickArrays, sleep, SYSTEM_PROGRAM_ID, TickArrayBitmap, TickUtils, TransferAmountFee, TxVersion } from "@raydium-io/raydium-sdk-v2";
import Decimal from "decimal.js";
import { BN } from "bn.js";

describe("strategy", () => {

  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const program = anchor.workspace.strategy as Program<Strategy>;
  const meteoraProgram = new anchor.Program(vaultIDL as anchor.Idl, provider) as Program<Vault>;
  
  let raydium: Raydium | undefined

  type RaydiumAccounts = {
    nftAccount?: PublicKey;
    nftMint?: PublicKey;
    personalPosition?: PublicKey;
    poolState?: PublicKey;
    protocolPosition?: PublicKey;

    tokenVault0?: PublicKey;
    tokenVault1?: PublicKey;

    tickArrayLower?: PublicKey;
    tickArrayUpper?: PublicKey;

    tokenProgram?: PublicKey;
    tokenProgram2022?: PublicKey;

    memoProgram?: PublicKey;

    tickArrayBitmap?: PublicKey;

    programId?:PublicKey;
  };

  let raydiumAccounts:RaydiumAccounts = {};

  type MeteoraAccounts = {
    vault0?: PublicKey;
    tokenVault0?: PublicKey;
    lpMint0?: PublicKey;
    vault1?: PublicKey;
    tokenVault1?: PublicKey;
    lpMint1?: PublicKey;    
  };

  let meteoraAccounts:MeteoraAccounts = {};

  const USER_STATE_SEED = "user-state";
  const GLOBAL_STATE_SEED = "global-state";
  const SOL_VAULT_SEED = "sol-vault";
  const KEEPER_STATE_SEED = "keeper-state";
  const WHITELIST_STATE_SEED = "whitelist-state";
  const CLUSTER = 'devnet' as 'mainnet' | 'devnet'
  
  let mint0:PublicKey;
  let mint1:PublicKey;

  const initialPrice = new Decimal(10);

  const userPositionStartPrice = 12;

  const userPositionEndPrice = 16;

  let userToken0DepositedAmount = new BN(20);
  let userToken1DepositedAmount:anchor.BN;

  type ThresholdAmounts = {
      tickLowerIndexInThreshold:number,
      tickUpperIndexInThreshold:number,
      tickLowerIndexOutThreshold:number,
      tickUpperIndexOutThreshold:number,
  }

  let thresholdAmounts:ThresholdAmounts; 
  
  let globalStateToken0Account:PublicKey;
  let globalStateToken1Account:PublicKey;

  let globalStateLp0Account:PublicKey;
  let globalStateLp1Account:PublicKey;

  const adminKeypair = provider.wallet.payer;

  const [globalStatePda, globalStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_STATE_SEED)],
      program.programId
  );

  const [solVaultPda, solVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from(SOL_VAULT_SEED)],
      program.programId
  );

  const keeperKeypair = Keypair.generate();

  const [keeperStatePda, keeperStateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(KEEPER_STATE_SEED), keeperKeypair.publicKey.toBuffer()],
    program.programId
  );

  const userKeypairJson = JSON.parse((fs.readFileSync("./tests/user.json")).toString());
  const userKeypair =  Keypair.fromSecretKey(new Uint8Array(userKeypairJson));
  
  let userStateToken0Account:PublicKey;
  let userStateToken1Account:PublicKey;

  let userStatePda:PublicKey;

  let userStateNftAccount:PublicKey;

  async function fundAccount(to:PublicKey, amount:number = 10_000_000) {
    let instruction = SystemProgram.transfer({
      fromPubkey:adminKeypair.publicKey,
      toPubkey:to,
      lamports:amount
    });

    let transaction = new Transaction;

    transaction.add(instruction);

    await sendAndConfirmTransaction(provider.connection, transaction, [adminKeypair]);
  }

  function getWhitelistPda(mint:PublicKey){
    return PublicKey.findProgramAddressSync(
      [Buffer.from(WHITELIST_STATE_SEED), mint.toBuffer()],
      program.programId
    )[0];
  }

  async function getRaydium() {

    console.log(`Connected to RPC ${provider.connection.rpcEndpoint} in ${CLUSTER}`)

    return await Raydium.load({
      owner:userKeypair,
      connection:provider.connection,
      cluster:CLUSTER,
      disableFeatureCheck: true,
      blockhashCommitment: 'finalized',
      ...(CLUSTER === 'devnet'
        ? {
            urlConfigs: {
              ...DEV_API_URLS,
              BASE_HOST: 'https://api-v3-devnet.raydium.io',
              OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
              SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
              CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position',
            },
          }
        : {}),
    });
  }  

  async function fundTokenAccount(mint:PublicKey, account:PublicKey, amount:number = 200_000_000_000_000) {
      await mintTo(
        provider.connection,
        adminKeypair,
        mint,
        account,
        adminKeypair,
        amount
      );
  }

  async function fundToken0Account(account:PublicKey, amount:number = 200_000_000_000_000) {
      await fundTokenAccount(mint0, account, amount)
  }

  async function fundToken1Account(account:PublicKey, amount:number = 200_000_000_000_000) {
      await fundTokenAccount(mint1, account, amount)
  } 

  async function createTokenAcccount(mint:PublicKey, account:PublicKey){
    return await createAssociatedTokenAccount(
      provider.connection,
      adminKeypair,
      mint,
      account,
      {},
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
      true
    );
  }

  async function createToken0Acccount(account:PublicKey){
    return await createTokenAcccount(mint0, account);
  }

  async function createToken1Acccount(account:PublicKey){
    return await createTokenAcccount(mint1, account);
  }

  async function createNewMint(){
    return await createMint(
      provider.connection,
      adminKeypair,
      adminKeypair.publicKey,
      null,            
      3                
    );
  }

  async function createPoolWithMint(mint0:PublicKey, mint1:PublicKey, initialPrice:Decimal){
    const mintA = await raydium.token.getTokenInfo(mint0);
    const mintB = await raydium.token.getTokenInfo(mint1);

    const clmmConfigs = await raydium.api.getClmmConfigs();

    const {execute, extInfo} = await raydium.clmm.createPool({
      programId: DEVNET_PROGRAM_ID.CLMM_PROGRAM_ID,
      mint1:mintA,
      mint2:mintB,
      ammConfig: { 
        ...clmmConfigs[0], 
        id: new PublicKey(clmmConfigs[0].id), 
        fundOwner: '', 
        description: '' 
      },
      initialPrice
    });

    const txID = await execute({sendAndConfirm: true});

    console.log(`Pool successfully created: ${txID.txId}`);
    
    return extInfo;
  }  
  
  async function createPool(){
    return await createPoolWithMint(mint0, mint1, initialPrice);
  }

  async function createPositionWithPoolId(poolId:PublicKey, startPrice:number, endPrice:number){

    let poolInfo: ApiV3PoolInfoConcentratedItem;

    let poolKeys: ClmmKeys | undefined;

    const data = await raydium.clmm.getPoolInfoFromRpc(poolId.toBase58());
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;

    const inputAmount = 200 //userToken0DepositedAmount.toNumber();

    const { tick: lowerTick } = TickUtils.getPriceAndTick({
      poolInfo,
      price: new Decimal(startPrice),
      baseIn: true,
    });

    const { tick: upperTick } = TickUtils.getPriceAndTick({
      poolInfo,
      price: new Decimal(endPrice),
      baseIn: true,
    });

    const epochInfo = await raydium.fetchEpochInfo();
    
    const res = await PoolUtils.getLiquidityAmountOutFromAmountIn({
      poolInfo,
      slippage: 0,
      inputA: true,
      tickUpper: Math.max(lowerTick, upperTick),
      tickLower: Math.min(lowerTick, upperTick),
      amount: 
        new BN(new Decimal(inputAmount || '0').
        mul(10 ** poolInfo.mintA.decimals).
        toFixed(0)
      ),
      add: true,
      amountHasFee: true,
      epochInfo: epochInfo,
    });

    console.log("Position amounts: ", {
      userToken0DepositedAmount: res.amountA.amount.toString(),
      userToken1DepositedAmount: res.amountB.amount.toString(),
    });

    const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
      poolInfo,
      poolKeys,
      tickUpper: Math.max(lowerTick, upperTick),
      tickLower: Math.min(lowerTick, upperTick),
      base: 'MintA',
      ownerInfo: {
        useSOLBalance: true,
      },
      baseAmount: 
        new BN(
          new Decimal(inputAmount || '0').
          mul(10 ** poolInfo.mintA.decimals).
          toFixed(0)
        ),
      otherAmountMax: res.amountSlippageB.amount,
     computeBudgetConfig: {
       units: 500000,
       microLamports: 500000,
     },      
    });

    const { txId } = await execute({ sendAndConfirm: true });

    console.log("CLMM position opened:", { txId, nft: extInfo.nftMint.toBase58() });

    return extInfo;
  }  

  async function createPosition(){
    return await createPositionWithPoolId(raydiumAccounts.poolState, userPositionStartPrice, userPositionEndPrice)
  }

  async function createVaults(){
    meteoraAccounts.tokenVault0
    const tx0 = await meteoraProgram.methods.
      initialize().
      accounts({
        payer:adminKeypair.publicKey,
        tokenMint:mint0,
        vault:meteoraAccounts.vault0,
        tokenVault:meteoraAccounts.tokenVault0,
        lpMint:meteoraAccounts.lpMint0,
        rent:RENT_PROGRAM_ID,
        systemProgram:SYSTEM_PROGRAM_ID,
        tokenProgram:TOKEN_PROGRAM_ID
      }).
      signers([]).
      rpc();
      
    const tx1 = await meteoraProgram.methods.
      initialize().
      accounts({
        payer:adminKeypair.publicKey,
        tokenMint:mint1,
        vault:meteoraAccounts.vault1,
        tokenVault:meteoraAccounts.tokenVault1,
        lpMint:meteoraAccounts.lpMint1,
        rent:RENT_PROGRAM_ID,
        systemProgram:SYSTEM_PROGRAM_ID,
        tokenProgram:TOKEN_PROGRAM_ID        
      }).
      signers([]).
      rpc();

    console.log("Vault 0 created: ", tx0);
    console.log("Vault 1 created: ", tx1);
  }

  // Simulate server threshold simulation
  async function getTickThresholdFromPriceAndInfo(poolId:PublicKey, startPrice:number, endPrice:number){
    let poolInfo: ApiV3PoolInfoConcentratedItem

    const data = await raydium.clmm.getPoolInfoFromRpc(poolId.toBase58());
    poolInfo = data.poolInfo;
    
    // Make it slightly more lax than the swap target so the swap can fall within the
    // server provided threshold while still being outside the user's range
    startPrice = startPrice * (0.85); 
    endPrice = endPrice * (1.1);

    const { tick: lowerTick } = TickUtils.getPriceAndTick({
      poolInfo,
      price: new Decimal(startPrice),
      baseIn: true,
    });

    const { tick: upperTick } = TickUtils.getPriceAndTick({
      poolInfo,
      price: new Decimal(endPrice),
      baseIn: true,
    });

    return {
      tickLowerIndexInThreshold:lowerTick,
      tickUpperIndexInThreshold:upperTick,
      tickLowerIndexOutThreshold:lowerTick,
      tickUpperIndexOutThreshold:upperTick,
    }
  }

  // Simulate server threshold simulation
  async function getTickThresholdFromPrice(){
    return await getTickThresholdFromPriceAndInfo(raydiumAccounts.poolState!, userPositionStartPrice, userPositionEndPrice);
  }

  async function swap(baseIn: boolean, goingIn: boolean) {
    let poolInfo: ApiV3PoolInfoConcentratedItem;

    const poolId = raydiumAccounts.poolState.toBase58();
    const inputMint = baseIn ? mint0.toBase58() : mint1.toBase58();

    let poolKeys: ClmmKeys | undefined;
    let clmmPoolInfo: ComputeClmmPoolInfo;
    let tickCache: ReturnTypeFetchMultiplePoolTickArrays;

    const data = await raydium.clmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
    clmmPoolInfo = data.computePoolInfo;
    tickCache = data.tickData;

    if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address)
      throw new Error('input mint does not match pool');

    let inputAmount = new BN(800_000);
    
    let minAmountOut: TransferAmountFee;
    let remainingAccounts: PublicKey[];
    let currentPrice: Price = null;

    const startPrice = userPositionStartPrice * 0.9; 
    const endPrice = userPositionEndPrice * 1.1;     

    let wouldReachTarget = false;

    do {
      const freshData = await raydium.clmm.getPoolInfoFromRpc(poolId);
      poolInfo = freshData.poolInfo;
      clmmPoolInfo = freshData.computePoolInfo;
      tickCache = freshData.tickData;

      if (currentPrice) {
        console.log(
          `Amount ${inputAmount.toString()} not successful, increasing amount and trying again, current price is ${currentPrice.toFixed()}`
        );
      }

      inputAmount = inputAmount.mul(new BN(11_000_000)).div(new BN(10_000_000));

      ({ minAmountOut, remainingAccounts, currentPrice } = PoolUtils.computeAmountOutFormat({
        poolInfo: clmmPoolInfo,
        tickArrayCache: tickCache[poolId],
        amountIn: inputAmount,
        tokenOut: poolInfo[baseIn ? 'mintB' : 'mintA'],
        slippage: 0.05,
        epochInfo: await raydium.fetchEpochInfo(),
      }));

      // Check if this amount would reach our target
      if (goingIn){
        if (baseIn){
           wouldReachTarget = currentPrice.denominator.mul(new BN(Math.floor(endPrice))).
             gte(currentPrice.numerator);
         } else {
            wouldReachTarget = currentPrice.denominator.mul(new BN(Math.ceil(startPrice))).
              lte(currentPrice.numerator);
         }        
      } else{
        if (baseIn){
            wouldReachTarget = currentPrice.denominator.mul(new BN(Math.floor(startPrice))).
             gt(currentPrice.numerator);
        } else {
            wouldReachTarget = currentPrice.denominator.mul(new BN(Math.ceil(endPrice))).
              lt(currentPrice.numerator);          
        }
      }

      const { execute, extInfo } = await raydium.clmm.swap({
        poolInfo,
        poolKeys,
        inputMint: poolInfo[baseIn ? 'mintA' : 'mintB'].address,
        amountIn: inputAmount,
        amountOutMin: minAmountOut.amount.raw,
        observationId: clmmPoolInfo.observationId,
        ownerInfo: {
          useSOLBalance: false,
        },
        remainingAccounts,
        computeBudgetConfig: {
          units: 600000,
          microLamports: 600000,
        },
      });


      const { txId } = await execute({ sendAndConfirm: true });
      console.log(`Swap successful with txId: ${txId}`);

    } while (!wouldReachTarget);

    console.log(
      `Successfully moved price out of range!\nFinal price: ${currentPrice.toFixed()}\nInput amount: ${inputAmount.toString()} base units`
    );
  }

  function buildRemainingAccountsForKeeperDecrease(
    meteora: {
      vault: PublicKey;         
      tokenVault: PublicKey;    
      lpMint: PublicKey;        
      globalStateTokenAccount: PublicKey;
      globalStateLpAccount: PublicKey;
      meteoraProgramId: PublicKey;
    },

    raydium: {
      nftOwner: PublicKey;           
      nftAccount: PublicKey;         
      personalPosition: PublicKey;   
      poolState: PublicKey;          
      protocolPosition: PublicKey;   
      tokenVault0: PublicKey;        
      tokenVault1: PublicKey;        
      tickArrayLower: PublicKey;     
      tickArrayUpper: PublicKey;     
      recipientTokenAccount0: PublicKey; 
      recipientTokenAccount1: PublicKey; 
      tokenProgram: PublicKey;       
      tokenProgram2022: PublicKey;   
      memoProgram: PublicKey;        
      vault0Mint: PublicKey;         
      vault1Mint: PublicKey;         
      tickArrayBitmap: PublicKey;   
      raydiumProgramId: PublicKey;   
    },

    globalStatePda: PublicKey,
  ): AccountMeta[] {

    const metas: AccountMeta[] = [];

    metas.push(
      { pubkey: meteora.meteoraProgramId, isWritable: false, isSigner: false },
      { pubkey: meteora.vault, isWritable: true, isSigner: false },
      { pubkey: meteora.tokenVault, isWritable: true, isSigner: false },
      { pubkey: meteora.lpMint, isWritable: true, isSigner: false },
      { pubkey: meteora.globalStateTokenAccount, isWritable: true, isSigner: false },
      { pubkey: meteora.globalStateLpAccount, isWritable: true, isSigner: false },
      { pubkey: globalStatePda, isWritable: false, isSigner: false },
      { pubkey: raydium.tokenProgram, isWritable: false, isSigner: false },
    );

    metas.push(
      { pubkey: raydium.raydiumProgramId, isWritable: false, isSigner: false },
      { pubkey: raydium.nftOwner, isWritable: true, isSigner: false },
      { pubkey: raydium.nftAccount, isWritable: false, isSigner: false },
      { pubkey: raydium.personalPosition, isWritable: true, isSigner: false },
      { pubkey: raydium.poolState, isWritable: true, isSigner: false },
      { pubkey: raydium.protocolPosition, isWritable: false, isSigner: false },
      { pubkey: raydium.tokenVault0, isWritable: true, isSigner: false },
      { pubkey: raydium.tokenVault1, isWritable: true, isSigner: false },
      { pubkey: raydium.tickArrayLower, isWritable: true, isSigner: false },
      { pubkey: raydium.tickArrayUpper, isWritable: true, isSigner: false },
      { pubkey: raydium.recipientTokenAccount0, isWritable: true, isSigner: false },
      { pubkey: raydium.recipientTokenAccount1, isWritable: true, isSigner: false },
      { pubkey: raydium.tokenProgram, isWritable: false, isSigner: false },
      { pubkey: raydium.tokenProgram2022, isWritable: false, isSigner: false },
      { pubkey: raydium.memoProgram, isWritable: false, isSigner: false },
      { pubkey: raydium.vault0Mint, isWritable: false, isSigner: false },
      { pubkey: raydium.vault1Mint, isWritable: false, isSigner: false },
      { pubkey: raydium.tickArrayBitmap, isWritable: false, isSigner: false },
    );

    for (let counter = 0; counter < metas.length; counter++){
      if (metas[counter].pubkey === undefined){
        console.log("Undefined found at ", counter);
      }
    }

    return metas;
  }

  function buildRemainingAccountsForKeeperIncrease(
    meteora: {
      vault: PublicKey;         
      tokenVault: PublicKey;    
      lpMint: PublicKey;        
      globalStateTokenAccount: PublicKey;
      globalStateLpAccount: PublicKey;
      meteoraProgramId: PublicKey;
    },

    raydium: {
      nftAccount: PublicKey;         
      personalPosition: PublicKey;   
      poolState: PublicKey;          
      protocolPosition: PublicKey;   
      tokenVault0: PublicKey;        
      tokenVault1: PublicKey;        
      tickArrayLower: PublicKey;     
      tickArrayUpper: PublicKey;     
      recipientTokenAccount0: PublicKey; 
      recipientTokenAccount1: PublicKey; 
      tokenProgram: PublicKey;       
      tokenProgram2022: PublicKey;   
      vault0Mint: PublicKey;         
      vault1Mint: PublicKey;         
      tickArrayBitmap: PublicKey;   
      raydiumProgramId: PublicKey;   
    },

    globalStatePda: PublicKey,
  ): AccountMeta[] {

    const metas: AccountMeta[] = [];

    metas.push(
      { pubkey: meteora.meteoraProgramId, isWritable: false, isSigner: false },
      { pubkey: meteora.vault, isWritable: true, isSigner: false },
      { pubkey: meteora.tokenVault, isWritable: true, isSigner: false },
      { pubkey: meteora.lpMint, isWritable: true, isSigner: false },
      { pubkey: meteora.globalStateTokenAccount, isWritable: true, isSigner: false },
      { pubkey: meteora.globalStateLpAccount, isWritable: true, isSigner: false },
      { pubkey: globalStatePda, isWritable: false, isSigner: false },
      { pubkey: raydium.tokenProgram, isWritable: false, isSigner: false },
    );

    metas.push(
      { pubkey: raydium.raydiumProgramId, isWritable: false, isSigner: false },
      { pubkey: globalStatePda, isWritable: true, isSigner: false },
      { pubkey: raydium.nftAccount, isWritable: true, isSigner: false },
      { pubkey: raydium.poolState, isWritable: true, isSigner: false },
      { pubkey: raydium.protocolPosition, isWritable: false, isSigner: false },
      { pubkey: raydium.personalPosition, isWritable: true, isSigner: false },
      { pubkey: raydium.tickArrayLower, isWritable: true, isSigner: false },
      { pubkey: raydium.tickArrayUpper, isWritable: true, isSigner: false },
      { pubkey: raydium.recipientTokenAccount0, isWritable: true, isSigner: false },
      { pubkey: raydium.recipientTokenAccount1, isWritable: true, isSigner: false },
      { pubkey: raydium.tokenVault0, isWritable: true, isSigner: false },
      { pubkey: raydium.tokenVault1, isWritable: true, isSigner: false },
      { pubkey: raydium.tokenProgram, isWritable: false, isSigner: false },
      { pubkey: raydium.tokenProgram2022, isWritable: false, isSigner: false },
      { pubkey: raydium.vault0Mint, isWritable: false, isSigner: false },
      { pubkey: raydium.vault1Mint, isWritable: false, isSigner: false },
      { pubkey: raydium.tickArrayBitmap, isWritable: false, isSigner: false },
    );

    for (let counter = 0; counter < metas.length; counter++){
      if (metas[counter].pubkey === undefined){
        console.log("Undefined found at ", counter);
      }
    }

    return metas;
  }  

  before(async () => {

    [mint0, mint1] =  [await createNewMint(), await createNewMint()];

    const mint0Base58 = mint0.toBase58();
    const mint1Base58 = mint1.toBase58();

    if (mint0Base58.length > mint1Base58.length){
      [mint0,mint1] = [mint1, mint0];
    } else if (mint0Base58.length == mint1Base58.length){
      [mint0, mint1] = mint0Base58 < mint1Base58 ? [mint0, mint1] : [mint1, mint0];
    }

    globalStateToken0Account = await createToken0Acccount(globalStatePda);
    await fundToken0Account(globalStateToken0Account);

    globalStateToken1Account = await createToken1Acccount(globalStatePda);
    await fundToken1Account(globalStateToken1Account);    

    raydium = await getRaydium();

    console.log("Raydium token module: ", raydium.token);

    const info = await createPool();

    raydiumAccounts.poolState = new PublicKey(info.address.id);
    raydiumAccounts.tokenVault0 = new PublicKey(info.address.vault.A);
    raydiumAccounts.tokenVault1 = new PublicKey(info.address.vault.B);
    raydiumAccounts.tickArrayBitmap = new PublicKey(info.address.exBitmapAccount);
    raydiumAccounts.tokenProgram = TOKEN_PROGRAM_ID;
    raydiumAccounts.tokenProgram2022 = TOKEN_2022_PROGRAM_ID;
    raydiumAccounts.memoProgram = MEMO_PROGRAM_ID;
    raydiumAccounts.programId = new PublicKey(info.address.programId);

    userStateToken0Account = await createToken0Acccount(userKeypair.publicKey);
    await fundToken0Account(userStateToken0Account);

    userStateToken1Account = await createToken1Acccount(userKeypair.publicKey);
    await fundToken1Account(userStateToken1Account);

    await createPositionWithPoolId(raydiumAccounts.poolState, 5, 10);

    const userInfo = await createPosition();

    // await createPositionWithPoolId(raydiumAccounts.poolState, 8, 9);

    await createPositionWithPoolId(raydiumAccounts.poolState, 8, 10);

    await createPositionWithPoolId(raydiumAccounts.poolState, 10, 11);    

    await createPositionWithPoolId(raydiumAccounts.poolState, 10, 12);

    await createPositionWithPoolId(raydiumAccounts.poolState, 10, 16);

    await createPositionWithPoolId(raydiumAccounts.poolState, 10, 14);

    raydiumAccounts.nftAccount = userInfo.positionNftAccount;
    raydiumAccounts.nftMint = userInfo.nftMint;
    raydiumAccounts.personalPosition = userInfo.personalPosition;
    raydiumAccounts.protocolPosition = userInfo.protocolPosition;
    raydiumAccounts.tickArrayLower = userInfo.tickArrayLower;
    raydiumAccounts.tickArrayUpper = userInfo.tickArrayUpper;

    userStatePda = PublicKey.findProgramAddressSync(
          [Buffer.from(USER_STATE_SEED), raydiumAccounts.nftMint.toBuffer()],
          program.programId
        )[0];    

    userStateNftAccount = 
      getAssociatedTokenAddressSync(raydiumAccounts.nftMint!, userStatePda, true);

    let accounts0 = meteora.getVaultPdas(mint0, meteoraProgram.programId);
    
    meteoraAccounts.lpMint0 = accounts0.lpMintPda;
    meteoraAccounts.tokenVault0 = accounts0.tokenVaultPda;
    meteoraAccounts.vault0 = accounts0.vaultPda;

    let accounts1 = meteora.getVaultPdas(mint1, meteoraProgram.programId);

    meteoraAccounts.lpMint1 = accounts1.lpMintPda;
    meteoraAccounts.tokenVault1 = accounts1.tokenVaultPda;
    meteoraAccounts.vault1 = accounts1.vaultPda;
    
    await createVaults();
    
    console.log("Vaults created");

    globalStateLp0Account = await createTokenAcccount(
      meteoraAccounts.lpMint0!, 
      globalStatePda,
    );  
    
    globalStateLp1Account = await createTokenAcccount(
      meteoraAccounts.lpMint1!, 
      globalStatePda,
    );    

    console.log("Global state token accounts created");

    thresholdAmounts = await getTickThresholdFromPrice();

  });

  it("Initialize config failure: Invalid bootstrap key", async () => {

    const invalidBootsrapKey = Keypair.generate();

    const initializeArgs = {
      state: 0,
      creditsForDecreaseLiquidity: new anchor.BN(1),
      creditsForIncreaseLiquidity: new anchor.BN(1),
      solPerCredit: new anchor.BN(1_000_000_000),
      baseDeposit: new anchor.BN(1_000_000),
      feeBasisPoints: 500,
      whitelistMint: [] as PublicKey[],
    };

    try {
      await program.methods
        .adminInitializeConfig(initializeArgs)
        .accountsPartial({
          globalState: globalStatePda,
          solVault: solVaultPda,
          initializer: invalidBootsrapKey.publicKey,
          admin: adminKeypair.publicKey,
        })
        .signers([invalidBootsrapKey])
        .rpc();
        
      assert.fail("Expected initialization to fail");
    } catch (error) {
      const msg:string = error.toString().toLowerCase();

      assert.ok((msg.includes("constraint") && msg.includes("address")) || 
        msg.includes("already in use"), `Unknown error: ${msg}`);
    }
  });

  it("Initialize config success", async () => {

      try {
        const bootstrapKeySecret = JSON.parse(fs.readFileSync("./tests/bootstrap-key.json", "utf8"));

        const bootstrapKeypair = Keypair.fromSecretKey(Uint8Array.from(bootstrapKeySecret));

        const initializeArgs = {
          state: 7, // Allow all actions
          creditsForDecreaseLiquidity: new anchor.BN(1),
          creditsForIncreaseLiquidity: new anchor.BN(1),
          solPerCredit: new anchor.BN(1_000_000_000),
          baseDeposit: new anchor.BN(1_000_000),
          feeBasisPoints: 500,
          whitelistMint: [] as PublicKey[],
        };

        await program.methods
          .adminInitializeConfig(initializeArgs)
          .accountsPartial({
            globalState: globalStatePda,
            solVault: solVaultPda,
            initializer: bootstrapKeypair.publicKey,
            admin: adminKeypair.publicKey,
          })
          .signers([bootstrapKeypair, adminKeypair])
          .rpc();

        // Fund sol-vault
        fundAccount(solVaultPda);

        const globalState = await program.account.globalState.fetch(globalStatePda);

        assert.ok(globalState.admin.equals(adminKeypair.publicKey));
        assert.ok(globalState.solVault.equals(solVaultPda));
        assert.strictEqual(globalState.state, initializeArgs.state);
        assert.strictEqual(globalState.creditsForDecreaseLiquidity.toString(), initializeArgs.creditsForDecreaseLiquidity.toString());
        assert.strictEqual(globalState.creditsForIncreaseLiquidity.toString(), initializeArgs.creditsForIncreaseLiquidity.toString());
        assert.strictEqual(globalState.solPerCredit.toString(), initializeArgs.solPerCredit.toString());
        assert.strictEqual(globalState.baseDeposit.toString(), initializeArgs.baseDeposit.toString());
        assert.strictEqual(globalState.bump, globalStateBump);
        assert.strictEqual(globalState.solVaultBump, solVaultBump);
      }catch(error){
        const msg:string = error.toString().toLowerCase();

        assert.ok(msg.includes("already in use"), `Unknown error: ${msg}`);
      } 
  });

  it("Admin change config success", async () => {

    // CreditsForDecrease
    const newDecrease = new anchor.BN(25);
    await program.methods
      .adminChangeConfig({ change: { creditsForDecrease: { value: newDecrease } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    let globalState: any = await program.account.globalState.fetch(globalStatePda);
    assert.strictEqual(globalState.creditsForDecreaseLiquidity.toString(), newDecrease.toString());

    // CreditsForIncrease
    const newIncrease = new anchor.BN(25);
    await program.methods
      .adminChangeConfig({ change: { creditsForIncrease: { value: newIncrease } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.strictEqual(globalState.creditsForIncreaseLiquidity.toString(), newIncrease.toString());

    // SolPerCredit
    const newSolPerCredit = new anchor.BN(1000);
    await program.methods
      .adminChangeConfig({ change: { solPerCredit: { value: newSolPerCredit } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.strictEqual(globalState.solPerCredit.toString(), newSolPerCredit.toString());

    // BaseDeposit
    const newBaseDeposit = new anchor.BN(2_000_000);
    await program.methods
      .adminChangeConfig({ change: { baseDeposit: { value: newBaseDeposit } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.strictEqual(globalState.baseDeposit.toString(), newBaseDeposit.toString());

    // FeeBasisPoints
    const newFeeBasisPoints = 1_000;
    await program.methods
      .adminChangeConfig({ change: { feeBasisPoints: { value: newFeeBasisPoints } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.strictEqual(globalState.feeBasisPoints.toString(), newFeeBasisPoints.toString());

    // StateBit
    const bit = 7;
    // set
    await program.methods
      .adminChangeConfig({ change: { stateBit: { bit, set: true } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.ok((globalState.state & (1 << bit)) !== 0);

    // Unset
    await program.methods
      .adminChangeConfig({ change: { stateBit: { bit, set: false } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.ok((globalState.state & (1 << bit)) === 0);

    // SetAdmin
    const newAdmin = Keypair.generate();

    await fundAccount(newAdmin.publicKey);

    await program.methods
      .adminChangeConfig({ change: { setAdmin: { newAdmin: newAdmin.publicKey } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.ok(globalState.admin.equals(newAdmin.publicKey));

    // Revert admin
    await program.methods
      .adminChangeConfig({ change: { setAdmin: { newAdmin: adminKeypair.publicKey } } })
      .accounts({
        globalState: globalStatePda,
        admin: newAdmin.publicKey,
      })
      .signers([newAdmin])
      .rpc();

    globalState = await program.account.globalState.fetch(globalStatePda);
    assert.ok(globalState.admin.equals(adminKeypair.publicKey));
  });

  it("Admin whitelist mint success", async () => {

    const mint = await createNewMint();

    // Add mintA
    await program.methods
      .adminWhitelistMint()
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
        mint,
      })
      .signers([adminKeypair])
      .rpc();

      const whitelistState = await program.account.whitelistState.fetch(getWhitelistPda(mint));
      assert.ok(whitelistState.mint.equals(mint));


      // Remove mintA
      await program.methods
        .adminUnwhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
          whitelistState: getWhitelistPda(mint),
        })
        .signers([adminKeypair])
        .rpc();

      try {
        await program.account.whitelistState.fetch(getWhitelistPda(mint));
        assert.fail("Expected fetch to fail");
      } catch (err) {
        const msg = err.toString().toLowerCase();
        assert.ok(msg.includes("not exist"), `Unexpected error: ${msg}`);
      }
  });

  it("Admin whitelist mint failure: Invalid admin", async () => {
    const mint = await createNewMint();

    const invalidAdmin = Keypair.generate();

    await fundAccount(invalidAdmin.publicKey, 2_000_000);

    try {
      await program.methods
        .adminWhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: invalidAdmin.publicKey,
          mint,
        })
        .signers([invalidAdmin])
        .rpc();
      assert.fail("Expected whitelist to fail");
    } catch (err) {
      const msg = err.toString().toLowerCase();
      assert.ok(msg.includes("unauthorized") || msg.includes("unauthorizedaction"), 
      `Unexpected error: ${msg}`);
    }
  });

  it("Admin unwhitelist mint failure: Invalid admin", async () => {
    const mint = await createNewMint();

    // Add mintA
    await program.methods
      .adminWhitelistMint()
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
        mint,
      })
      .signers([adminKeypair])
      .rpc();

      const whitelistState = await program.account.whitelistState.fetch(getWhitelistPda(mint));
      assert.ok(whitelistState.mint.equals(mint));

    const invalidAdmin = Keypair.generate();

    try {
      await program.methods
        .adminUnwhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: invalidAdmin.publicKey,
          whitelistState: getWhitelistPda(mint),
        })
        .signers([invalidAdmin])
        .rpc();
      assert.fail("Expected unwhitelist to fail");
    } catch (err) {
      const msg = err.toString().toLowerCase();
      assert.ok(msg.includes("unauthorized") || msg.includes("unauthorizedaction"), 
      `Unexpected error: ${msg}`);
    }
  });

  it("Admin change config failure: Invalid admin", async () => {
    let invalidAdmin = Keypair.generate();

    try {
      await program.methods
        .adminChangeConfig({ change: { creditsForDecrease: { value: new anchor.BN(1_000_000) } } })
        .accounts({
          globalState: globalStatePda,
          admin: invalidAdmin.publicKey,
          })
        .signers([invalidAdmin])
        .rpc();
      assert.fail("Expected change to fail");
    } catch (err) {
      const msg = err.toString().toLowerCase();

      assert.ok(msg.includes("unauthorized") || msg.includes("unauthorizedaction"), 
        `Unexpected error: ${msg}`);
    }
  });

  it("Admin withdraw SOL success", async () => {

    const recipient = Keypair.generate().publicKey; // Newly generated public key, has no prior balance
    const withdrawAmount = 1_000_000;

    await program.
      methods.
      adminWithdrawSol({amount:new anchor.BN(withdrawAmount)}).
      accounts({
        globalState:globalStatePda,
        admin:adminKeypair.publicKey,
        solVault:solVaultPda,
        recipient
      }).
      signers([adminKeypair]).
      rpc();
      // 271606558784

      const balance = await provider.connection.getBalance(recipient);
      assert.strictEqual(balance, withdrawAmount);
  });

  it("Admin withdraw SOL failure: Invalid admin", async () => {
    try{
      const recipient = Keypair.generate().publicKey;
      const withdrawAmount = 1_000_000;

      const invalidAdmin = Keypair.generate();

      await program.
        methods.
        adminWithdrawSol({amount:new anchor.BN(withdrawAmount)}).
        accounts({
          globalState:globalStatePda,
          admin:invalidAdmin.publicKey,
          solVault:solVaultPda,
          recipient
        }).
        signers([invalidAdmin]).
        rpc();

        assert.fail("Withdraw SOL should have failed");
    } catch(err){
        const msg = err.toString().toLowerCase();

        assert.ok(msg.includes("unauthorized") || msg.includes("unauthorizedaction"), 
        `Unexpected error: ${msg}`);
    }
  });

  it("Admin withdraw token success", async () => {

    const withdrawAmount = 1_000_000;
    const recipient = await createToken0Acccount(Keypair.generate().publicKey);

    await program.
      methods.
      adminWithdrawTokens({amount:new anchor.BN(withdrawAmount)}).
      accounts({
        globalState:globalStatePda,
        sourceTokenAccount:globalStateToken0Account,
        admin:adminKeypair.publicKey,
        mint:mint0,
        destinationTokenAccount:recipient,
        tokenProgram:TOKEN_PROGRAM_ID
      }).
      signers([adminKeypair]).
      rpc();

      const recipientBalance = await program.provider.connection.getTokenAccountBalance(recipient);

      assert.equal(recipientBalance.value.amount, withdrawAmount);
  });

  it("Admin withdraw token failure: Invalid admin", async () => {

    try{
      const withdrawAmount = 1_000_000;
      const recipient = await createToken0Acccount(Keypair.generate().publicKey);

      const invalidAdmin = Keypair.generate();

      await program.
        methods.
        adminWithdrawTokens({amount:new anchor.BN(withdrawAmount)}).
        accounts({
          globalState:globalStatePda,
          sourceTokenAccount:globalStateToken0Account,
          admin:invalidAdmin.publicKey,
          mint:mint0,
          destinationTokenAccount:recipient,
          tokenProgram:TOKEN_PROGRAM_ID
        }).
        signers([invalidAdmin]).
        rpc();

        assert.fail("Withdraw token should have failed");
    } catch(err){
        const msg = err.toString().toLowerCase();

        assert.ok(msg.includes("unauthorized") || msg.includes("unauthorizedaction"), 
        `Unexpected error: ${msg}`);
    }
  });

  it("Keeper create account success", async () => {
    await program.
      methods.
      createKeeperAccount().
      accounts({
        keeper:keeperKeypair.publicKey,
        payer:adminKeypair.publicKey
      }).
      rpc();

    const keeperAccount = await program.account.keeperState.fetch(keeperStatePda);
    assert.ok(keeperAccount.credits.eq(new anchor.BN(0)));
    assert.ok(keeperKeypair.publicKey.equals(keeperAccount.keeper));
  }); 

  it("User create account failure: action not allowed ", async () => {
    // StateBit
    const bit = 0;

    try{
      const mint0 = await createNewMint();
      
      const mint1 = await createNewMint();

      // Whitelist mint 0
      await program.methods
        .adminWhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
          mint: mint0,
        })
        .rpc();

      // Whitelist mint 1
      await program.methods
        .adminWhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
          mint: mint1,
        })
        .rpc(); 

      sleep(3000);

      // unset
      await program.methods
        .adminChangeConfig({ change: { stateBit: { bit, set: false } } })
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
        })
        .rpc();     

      // Try to create the position
      await program.methods.
        userCreatePositionFromRaydium({
          tickLowerIndexInThreshold:thresholdAmounts.tickLowerIndexInThreshold,
          tickUpperIndexInThreshold:thresholdAmounts.tickUpperIndexInThreshold,
          tickLowerIndexOutThreshold:thresholdAmounts.tickLowerIndexOutThreshold,
          tickUpperIndexOutThreshold:thresholdAmounts.tickUpperIndexOutThreshold
        }).
        accountsPartial({
          payer:adminKeypair.publicKey,
          user:userKeypair.publicKey,
          userMint:raydiumAccounts.nftMint,
          userTokenAccount:raydiumAccounts.nftAccount,
          positionState:raydiumAccounts.personalPosition,
          poolState:raydiumAccounts.poolState,
          globalState:globalStatePda,        
          mint0Whitelist: getWhitelistPda(mint0),
          mint1Whitelist: getWhitelistPda(mint1),
          tokenProgram:TOKEN_PROGRAM_ID
        }).
        signers([
          userKeypair
        ]).
        rpc();

        assert.fail("Transaction should have failed")
      } catch(err){
        // set
        await program.methods
        .adminChangeConfig({ change: { stateBit: { bit, set: true } } })
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
        })
        .rpc(); 

        const msg:string = err.toString().toLowerCase(); 
        assert.ok(msg.includes("notopen"), `Unexpected Error: ${msg}`);
      }
  });
  
  it("User create account failure: invalid whitelist", async () => {      

    try{
      const mint0 = await createNewMint();
      
      const mint1 = await createNewMint();

      // Whitelist mint 0
      await program.methods
        .adminWhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
          mint: mint0,
        })
        .rpc();

      // Whitelist mint 1
      await program.methods
        .adminWhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
          mint: mint1,
        })
        .rpc(); 

      sleep(3000);

      // Create the position
      await program.methods.
        userCreatePositionFromRaydium({
          tickLowerIndexInThreshold:thresholdAmounts.tickLowerIndexInThreshold,
          tickUpperIndexInThreshold:thresholdAmounts.tickUpperIndexInThreshold,
          tickLowerIndexOutThreshold:thresholdAmounts.tickLowerIndexOutThreshold,
          tickUpperIndexOutThreshold:thresholdAmounts.tickUpperIndexOutThreshold
        }).
        accountsPartial({
          payer:adminKeypair.publicKey,
          user:userKeypair.publicKey,
          userMint:raydiumAccounts.nftMint,
          userTokenAccount:raydiumAccounts.nftAccount,
          positionState:raydiumAccounts.personalPosition,
          poolState:raydiumAccounts.poolState,
          globalState:globalStatePda,
          mint0Whitelist: getWhitelistPda(mint0),
          mint1Whitelist: getWhitelistPda(mint1),
          tokenProgram:TOKEN_PROGRAM_ID        
        }).
        signers([
          userKeypair
        ]).
        rpc();
    } catch (err){
      const msg:string = err.toString().toLowerCase();
      assert.ok(msg.includes("notwhitelisted"), `Unknown Error ${msg}`);
    }
  }); 

  it("User create account failure: pool and personal user state mismatch", async () => {
    try{
      let mint0 = await createNewMint();
      
      let mint1 = await createNewMint();

      const mint0Base58 = mint0.toBase58();
      const mint1Base58 = mint1.toBase58();

      if (mint0Base58.length > mint1Base58.length){
        [mint0,mint1] = [mint1, mint0];
      } else if (mint0Base58.length == mint1Base58.length){
        [mint0, mint1] = mint0Base58 < mint1Base58 ? [mint0, mint1] : [mint1, mint0];
      }

      const pool = await createPoolWithMint(mint0, mint1, initialPrice);

      // Whitelist mint 0
      await program.methods
        .adminWhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
          mint: mint0,
        })
        .rpc();

      // Whitelist mint 1
      await program.methods
        .adminWhitelistMint()
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
          mint: mint1,
        })
        .rpc();      

      // Create the position
      await program.methods.
        userCreatePositionFromRaydium({
          tickLowerIndexInThreshold:thresholdAmounts.tickLowerIndexInThreshold,
          tickUpperIndexInThreshold:thresholdAmounts.tickUpperIndexInThreshold,
          tickLowerIndexOutThreshold:thresholdAmounts.tickLowerIndexOutThreshold,
          tickUpperIndexOutThreshold:thresholdAmounts.tickUpperIndexOutThreshold
        }).
        accountsPartial({
          payer:adminKeypair.publicKey,
          user:userKeypair.publicKey,
          userMint:raydiumAccounts.nftMint,
          userTokenAccount:raydiumAccounts.nftAccount,
          positionState:raydiumAccounts.personalPosition,
          poolState:pool.address.id,
          globalState:globalStatePda,
          mint0Whitelist: getWhitelistPda(mint0),
          mint1Whitelist: getWhitelistPda(mint1),
          tokenProgram:TOKEN_PROGRAM_ID        
        }).
        signers([
          userKeypair
        ]).
        rpc();
    } catch (err){
      const msg = err.toString().toLowerCase();
      assert.ok(msg.includes("invalidpool"), `Unexpected Error ${msg}`);
    }
  });  

  it("User create account success", async () => {

    // Whitelist mint 0
    await program.methods
      .adminWhitelistMint()
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
        mint: mint0,
      })
      .rpc();

    // Whitelist mint 1
    await program.methods
      .adminWhitelistMint()
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
        mint: mint1,
      })
      .rpc();  
      
    sleep(10000);

    // Create the position
    const tx = await program.methods.
      userCreatePositionFromRaydium({
        tickLowerIndexInThreshold:thresholdAmounts.tickLowerIndexInThreshold,
        tickUpperIndexInThreshold:thresholdAmounts.tickUpperIndexInThreshold,
        tickLowerIndexOutThreshold:thresholdAmounts.tickLowerIndexOutThreshold,
        tickUpperIndexOutThreshold:thresholdAmounts.tickUpperIndexOutThreshold
      }).
      accountsPartial({
        payer:adminKeypair.publicKey,
        user:userKeypair.publicKey,
        userMint:raydiumAccounts.nftMint,
        userTokenAccount:raydiumAccounts.nftAccount,
        positionState:raydiumAccounts.personalPosition,
        poolState:raydiumAccounts.poolState,
        globalState:globalStatePda,
        mint0Whitelist: getWhitelistPda(mint0),
        mint1Whitelist: getWhitelistPda(mint1),
        tokenProgram:TOKEN_PROGRAM_ID       
      }).
      signers([
        userKeypair
      ]).
      rpc();
  });

  it("User create account failure: invalid mint", async () => {
    try{
      const mint = await createNewMint();
      
      const tokenAccount = await createTokenAcccount(mint, userKeypair.publicKey);

      fundTokenAccount(mint, tokenAccount);

      // Create the position
      await program.methods.
        userCreatePositionFromRaydium({
          tickLowerIndexInThreshold:thresholdAmounts.tickLowerIndexInThreshold,
          tickUpperIndexInThreshold:thresholdAmounts.tickUpperIndexInThreshold,
          tickLowerIndexOutThreshold:thresholdAmounts.tickLowerIndexOutThreshold,
          tickUpperIndexOutThreshold:thresholdAmounts.tickUpperIndexOutThreshold
        }).
        accountsPartial({
          payer:adminKeypair.publicKey,
          user:userKeypair.publicKey,
          userMint:mint,
          userTokenAccount:tokenAccount,
          positionState:raydiumAccounts.personalPosition,
          poolState:raydiumAccounts.poolState,
          globalState:globalStatePda,
          mint0Whitelist: getWhitelistPda(mint0),
          mint1Whitelist: getWhitelistPda(mint1),
          tokenProgram:TOKEN_PROGRAM_ID
        }).
        signers([
          userKeypair
        ]).
        rpc();
    } catch (err){
      const msg = err.toString().toLowerCase();
      assert.ok(msg.includes("invalidnftmint"), `Unexpected Error: ${msg}`);
    }
  }); 

  it("Keeper withdraw rewards success", async () => {

    const recipient = Keypair.generate().publicKey; // Newly generated public key, has no prior balance
    const solPerCredit = (await program.account.globalState.fetch(globalStatePda)).solPerCredit
    const withdrawAmount = 
      (await program.account.keeperState.fetch(keeperStatePda)).
      credits.mul(solPerCredit);    

    await program.
      methods.
      keeperWithdrawRewards().
      accounts({
        keeperAccount:keeperStatePda,
        keeper:keeperKeypair.publicKey,
        globalState:globalStatePda,
        solVault:solVaultPda,
        recipient
      }).
      signers([keeperKeypair]).
      rpc();
    
    console.log("Withdraw SOL to: ", recipient.toBase58());

    const recipientBalance = await provider.connection.getBalance(recipient);

    assert.ok(withdrawAmount.eq(new anchor.BN(recipientBalance)));
  });

  it("Keeper withdraw rewards failure: Invalid keeper", async () => {
    const invalidKeeperKeypair = Keypair.generate();
    const recipient = Keypair.generate().publicKey;

    try {
      await program.
        methods.
        keeperWithdrawRewards().
        accounts({
          keeperAccount:keeperStatePda,
          keeper:invalidKeeperKeypair.publicKey,
          globalState:globalStatePda,
          solVault:solVaultPda,
          recipient
        }).
        signers([invalidKeeperKeypair]).
        rpc();
    } catch (err){
      const msg = err.toString().toLowerCase();

      assert.ok(msg.includes("unauthorizedaction"), `Unexpected error: ${msg}`);
    }
  });

  it("Keeper decrease liquidity failure: Invalid global state", async () => {

    try {
      const wrongGlobalState = Keypair.generate();

      const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: globalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftOwner: userStatePda,
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        wrongGlobalState.publicKey
      );

      await program.methods.
        keeperDecreaseLiquidityPosition({lpAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      const msg = error.toString().toLowerCase();
      assert.ok(msg.includes("accountdiscriminatornotfound."), `Unexpected Error: ${msg}`);
    }
  });

  it("Keeper decrease liquidity failure: Invalid global state raydium token ATAs", async () => {

    try {
      const wrongGlobalState = Keypair.generate();
      const wrongGlobalStateToken0Account = await createToken0Acccount(wrongGlobalState.publicKey);
      fundToken0Account(wrongGlobalStateToken0Account);

      const wrongGlobalStateToken1Account = await createToken1Acccount(wrongGlobalState.publicKey);
      fundToken1Account(wrongGlobalStateToken1Account);


      const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftOwner: userStatePda,
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: wrongGlobalStateToken0Account,
          recipientTokenAccount1: wrongGlobalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        keeperDecreaseLiquidityPosition({lpAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);
    }
  });

  it("Keeper decrease liquidity failure: Invalid global state lp ATA", async () => {

    try {
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateLpAccount = 
        await createTokenAcccount(meteoraAccounts.lpMint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: globalStateToken0Account,
          globalStateLpAccount: wrongGlobalStateLpAccount,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftOwner: userStatePda,
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        keeperDecreaseLiquidityPosition({lpAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);    }
  }); 
  
  it("Keeper decrease liquidity failure: Invalid global state meteora token0 ATA", async () => {

    try {
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateToken0Account = 
        await createTokenAcccount(mint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftOwner: userStatePda,
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        keeperDecreaseLiquidityPosition({lpAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);    
    }
  }); 

  it("Keeper decrease liquidity failure: Action not allowed", async () => {

    const bit = 2;
    try {
      // unset
      await program.methods
        .adminChangeConfig({ change: { stateBit: { bit, set: false } } })
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
        })
        .rpc(); 
      
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateToken0Account = 
        await createTokenAcccount(mint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftOwner: userStatePda,
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        keeperDecreaseLiquidityPosition({lpAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      // set
      await program.methods
      .adminChangeConfig({ change: { stateBit: { bit, set: true } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc(); 
      
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("unauthorizedaction"), `Unexpected error: ${msg}`);

    }
  }); 

  it("keeper decrease liquidity success", async () => {

    const globalToken0BeforeResp =
      await provider.connection.getTokenAccountBalance(globalStateToken0Account);

    const globalToken1BeforeResp =
      await provider.connection.getTokenAccountBalance(globalStateToken1Account);

    const globalLpBeforeResp =
      await provider.connection.getTokenAccountBalance(globalStateLp0Account);

    const raydiumTokenVault0Balance =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault0!);

    const raydiumTokenVault1Balance =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault1!);

    console.log("Raydium Token Vault 0 Balance Before: ", raydiumTokenVault0Balance.value.amount);
    console.log("Raydium Token Vault 1 Balance Before: ", raydiumTokenVault1Balance.value.amount);

    const globalToken0Before = new BN(globalToken0BeforeResp?.value?.amount ?? "0");
    const globalToken1Before = new BN(globalToken1BeforeResp?.value?.amount ?? "0");
    const globalLpBefore     = new BN(globalLpBeforeResp?.value?.amount ?? "0");

    const keeperBefore = await program.account.keeperState.fetch(keeperStatePda);
    const globalStateBefore = await program.account.globalState.fetch(globalStatePda);

    const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
      {
        vault: meteoraAccounts.vault0!,
        tokenVault: meteoraAccounts.tokenVault0!,
        lpMint: meteoraAccounts.lpMint0!,
        globalStateTokenAccount: globalStateToken0Account,
        globalStateLpAccount: globalStateLp0Account,
        meteoraProgramId: meteoraProgram.programId,
      },
      {
        nftOwner: userStatePda,
        nftAccount: userStateNftAccount,
        personalPosition: raydiumAccounts.personalPosition!,
        poolState: raydiumAccounts.poolState!,
        protocolPosition: raydiumAccounts.protocolPosition!,
        tokenVault0: raydiumAccounts.tokenVault0!,
        tokenVault1: raydiumAccounts.tokenVault1!,
        tickArrayLower: raydiumAccounts.tickArrayLower!,
        tickArrayUpper: raydiumAccounts.tickArrayUpper!,
        recipientTokenAccount0: globalStateToken0Account,
        recipientTokenAccount1: globalStateToken1Account,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        memoProgram: MEMO_PROGRAM_ID,
        vault0Mint: mint0,
        vault1Mint: mint1,
        tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
        raydiumProgramId: raydiumAccounts.programId!,
      },
      globalStatePda
    );

    await program.methods
      .keeperDecreaseLiquidityPosition({ lpAmountMin: new BN(0) })
      .accounts({
        keeperAccount: keeperStatePda,
      })
      .remainingAccounts(remainingAccounts)
      
      .rpc();

    const globalToken0AfterResp =
      await provider.connection.getTokenAccountBalance(globalStateToken0Account);
    const globalToken1AfterResp =
      await provider.connection.getTokenAccountBalance(globalStateToken1Account);
    const globalLpAfterResp =
      await provider.connection.getTokenAccountBalance(globalStateLp0Account);

    const globalToken0After = new BN(globalToken0AfterResp?.value?.amount ?? "0");
    const globalToken1After = new BN(globalToken1AfterResp?.value?.amount ?? "0");
    const globalLpAfter     = new BN(globalLpAfterResp?.value?.amount ?? "0");

    const raydiumTokenVault0BalanceAfter =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault0!);

    const raydiumTokenVault1BalanceAfter =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault1!);

    console.log("Raydium Token Vault 0 Balance After: ", raydiumTokenVault0BalanceAfter.value.amount);
    console.log("Raydium Token Vault 1 Balance After: ", raydiumTokenVault1BalanceAfter.value.amount);


    console.log("Global Token0 Before: ", globalToken0Before.toString());
    console.log("Global Token0 After: ", globalToken0After.toString());
    const deltaToken0 = globalToken0Before.sub(globalToken0After);
    assert.ok(deltaToken0.eq(new BN(0)), `DeltaToken0 mismatch: got ${deltaToken0.toString()}, expected 0`);

    console.log("Global Token1 Before: ", globalToken1Before.toString());
    console.log("Global Token1 After: ", globalToken1After.toString());
    const deltaToken1 = globalToken1Before.sub(globalToken1After);
    assert.ok(deltaToken1.eq(new BN(0)), `DeltaToken1 mismatch: got ${deltaToken1.toString()}, expected 0`);

    const meteoraTokenVaultBalance = new BN((await provider.connection.getTokenAccountBalance(meteoraAccounts.tokenVault0!)).value.amount);

    const lpIncrease = globalLpAfter.sub(globalLpBefore);
    assert.ok(lpIncrease.eq(meteoraTokenVaultBalance), `LP increase mismatch: got ${lpIncrease.toString()}, expected ${meteoraTokenVaultBalance.toString()}`);

    console.log("User state pda: ", userStatePda.toBase58());

    const userStateAfter = await program.account.userState.fetch(userStatePda);
    console.log("Reached here");

    assert.strictEqual(
      userStateAfter.amountDepositedIntoVault.toString(),
      meteoraTokenVaultBalance.toString(),
      `userState.amountDepositedIntoVault mismatch: got ${userStateAfter.amountDepositedIntoVault}, expected ${meteoraTokenVaultBalance.toString()}`
    );

    assert.strictEqual(
      new BN(userStateAfter.lpAmount).toString(),
      lpIncrease.toString(),
      `userState.lpAmount mismatch: got ${userStateAfter.lpAmount}, expected ${lpIncrease.toString()}`
    );

    console.log("Reached here");

    const keeperAfter = await program.account.keeperState.fetch(keeperStatePda);

    console.log("Reached here");

    const beforeCredits = new BN(keeperBefore.credits ?? 0);
    const afterCredits = new BN(keeperAfter.credits ?? 0);

    const expectedDelta = new BN(globalStateBefore.creditsForDecreaseLiquidity ?? 0);

    assert.ok(
      afterCredits.eq(beforeCredits.add(expectedDelta)),
      `keeper credits mismatch: before=${beforeCredits.toString()} after=${afterCredits.toString()} expected=${expectedDelta.toString()}`
    );

    assert.ok(meteoraTokenVaultBalance.gt(new BN(0)), "meteoraTokenVaultBalance must be > 0");

    assert.ok(lpIncrease.gt(new BN(0)), "lpIncrease must be > 0");
  });

  it("keeper decrease liquidity failure: Already deployed", async () => {
    const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
      {
        vault: meteoraAccounts.vault0!,
        tokenVault: meteoraAccounts.tokenVault0!,
        lpMint: meteoraAccounts.lpMint0!,
        globalStateTokenAccount: globalStateToken0Account,
        globalStateLpAccount: globalStateLp0Account,
        meteoraProgramId: meteoraProgram.programId,
      },
      {
        nftOwner: userStatePda,
        nftAccount: userStateNftAccount,
        personalPosition: raydiumAccounts.personalPosition!,
        poolState: raydiumAccounts.poolState!,
        protocolPosition: raydiumAccounts.protocolPosition!,
        tokenVault0: raydiumAccounts.tokenVault0!,
        tokenVault1: raydiumAccounts.tokenVault1!,
        tickArrayLower: raydiumAccounts.tickArrayLower!,
        tickArrayUpper: raydiumAccounts.tickArrayUpper!,
        recipientTokenAccount0: globalStateToken0Account,
        recipientTokenAccount1: globalStateToken1Account,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        memoProgram: MEMO_PROGRAM_ID,
        vault0Mint: mint0,
        vault1Mint: mint1,
        tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
        raydiumProgramId: raydiumAccounts.programId!,
      },
      globalStatePda
    );
    try {
      await program.methods
        .keeperDecreaseLiquidityPosition({ lpAmountMin: new BN(0) })
        .accounts({
          keeperAccount: keeperStatePda,
        })
        .remainingAccounts(remainingAccounts)
        
        .rpc();
      assert.fail("This should have failed");
    } catch (error) {
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("positiondeployed"), `Unexpected error: ${msg}`);
    }
  });  

  it("Simulate swap", async () => {
    await swap(false, true);

    let poolInfo: ApiV3PoolInfoConcentratedItem;

    const poolId = raydiumAccounts.poolState.toBase58();

    let poolKeys: ClmmKeys | undefined;
    let clmmPoolInfo: ComputeClmmPoolInfo;
    let tickCache: ReturnTypeFetchMultiplePoolTickArrays;

    const data = await raydium.clmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
    clmmPoolInfo = data.computePoolInfo;
    tickCache = data.tickData;

    console.log("Current price: ", data.computePoolInfo.currentPrice);
  });

  it("Keeper increase liquidity failure: Invalid global state", async () => {

    try {
      const wrongGlobalState = Keypair.generate();

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: globalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        wrongGlobalState.publicKey
      );

      console.log("Reached here");

      await program.methods.
        keeperIncreaseLiquidityPosition({tokenAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda,
          userStateAccount:userStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("accountdiscriminatornotfound."), `Unexpected error: ${msg}`);
    }
  });

  it("Keeper increase liquidity failure: Invalid global state raydium token ATAs", async () => {

    try {
      const wrongGlobalState = Keypair.generate();
      const wrongGlobalStateToken0Account = await createToken0Acccount(wrongGlobalState.publicKey);
      fundToken0Account(wrongGlobalStateToken0Account);

      const wrongGlobalStateToken1Account = await createToken1Acccount(wrongGlobalState.publicKey);
      fundToken1Account(wrongGlobalStateToken1Account);


      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: wrongGlobalStateToken0Account,
          recipientTokenAccount1: wrongGlobalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        keeperIncreaseLiquidityPosition({tokenAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda,
          userStateAccount:userStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

    } catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);
    }
  });

  it("Keeper increase liquidity failure: Invalid global state lp ATA", async () => {

    try {
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateLpAccount = 
        await createTokenAcccount(meteoraAccounts.lpMint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: globalStateToken0Account,
          globalStateLpAccount: wrongGlobalStateLpAccount,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      console.log("Reached here");

      await program.methods.
        keeperIncreaseLiquidityPosition({tokenAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda,
          userStateAccount:userStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);
    }
  }); 
  
  it("Keeper increase liquidity failure: Invalid global state meteora token0 ATA", async () => {

    try {
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateToken0Account = 
        await createTokenAcccount(mint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      console.log("Reached here");

      await program.methods.
        keeperIncreaseLiquidityPosition({tokenAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda,
          userStateAccount:userStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);
    }
  }); 

  it("Keeper increase liquidity failure: Action not allowed", async () => {

    const bit = 1;
    try {
      // unset
      await program.methods
        .adminChangeConfig({ change: { stateBit: { bit, set: false } } })
        .accounts({
          globalState: globalStatePda,
          admin: adminKeypair.publicKey,
        })
        .rpc(); 
      
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateToken0Account = 
        await createTokenAcccount(mint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        keeperIncreaseLiquidityPosition({tokenAmountMin:new BN(0)}).
        accounts({
          keeperAccount:keeperStatePda,
          userStateAccount:userStatePda
        }).
        remainingAccounts(
          remainingAccounts
        ).
        rpc();

        assert.fail("This should have failed");

    } catch(error){
      // set
      await program.methods
      .adminChangeConfig({ change: { stateBit: { bit, set: true } } })
      .accounts({
        globalState: globalStatePda,
        admin: adminKeypair.publicKey,
      })
      .rpc(); 

      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("unauthorizedaction"), `Unexpected error: ${msg}`);
    }
  }); 

  it("keeper increase liquidity success", async () => {

    sleep(10000);

    const globalToken0BeforeResp =
      await provider.connection.getTokenAccountBalance(globalStateToken0Account);

    const globalToken1BeforeResp =
      await provider.connection.getTokenAccountBalance(globalStateToken1Account);

    const raydiumTokenVault0Balance =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault0!);

    const raydiumTokenVault1Balance =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault1!);

    console.log("Raydium Token Vault 0 Balance Before: ", raydiumTokenVault0Balance.value.amount);
    console.log("Raydium Token Vault 1 Balance Before: ", raydiumTokenVault1Balance.value.amount);

    const meteoraToken0VaultBalanceBefore = 
      await provider.connection.getTokenAccountBalance(meteoraAccounts.tokenVault0);

    console.log("Meteora Token0 Vault Balance Before: ", meteoraToken0VaultBalanceBefore.value.amount);

    const globalToken0Before = new BN(globalToken0BeforeResp?.value?.amount ?? "0");
    const globalToken1Before = new BN(globalToken1BeforeResp?.value?.amount ?? "0");


    const keeperBefore = await program.account.keeperState.fetch(keeperStatePda);
    const globalStateBefore = await program.account.globalState.fetch(globalStatePda);

    const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
      {
        vault: meteoraAccounts.vault0!,
        tokenVault: meteoraAccounts.tokenVault0!,
        lpMint: meteoraAccounts.lpMint0!,
        globalStateTokenAccount: globalStateToken0Account,
        globalStateLpAccount: globalStateLp0Account,
        meteoraProgramId: meteoraProgram.programId,
      },
      {
        nftAccount: userStateNftAccount,
        personalPosition: raydiumAccounts.personalPosition!,
        poolState: raydiumAccounts.poolState!,
        protocolPosition: raydiumAccounts.protocolPosition!,
        tokenVault0: raydiumAccounts.tokenVault0!,
        tokenVault1: raydiumAccounts.tokenVault1!,
        tickArrayLower: raydiumAccounts.tickArrayLower!,
        tickArrayUpper: raydiumAccounts.tickArrayUpper!,
        recipientTokenAccount0: globalStateToken0Account,
        recipientTokenAccount1: globalStateToken1Account,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        vault0Mint: mint0,
        vault1Mint: mint1,
        tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
        raydiumProgramId: raydiumAccounts.programId!,
      },
      globalStatePda
    );

    await program.methods.
      keeperIncreaseLiquidityPosition({tokenAmountMin:new BN(0)}).
      accounts({
          keeperAccount:keeperStatePda,
          userStateAccount:userStatePda
        })
      .remainingAccounts(remainingAccounts)
      .rpc();

    const globalToken0AfterResp =
      await provider.connection.getTokenAccountBalance(globalStateToken0Account);
    const globalToken1AfterResp =
      await provider.connection.getTokenAccountBalance(globalStateToken1Account);
    const globalLpAfterResp =
      await provider.connection.getTokenAccountBalance(globalStateLp0Account);

    const globalToken0After = new BN(globalToken0AfterResp?.value?.amount ?? "0");
    const globalToken1After = new BN(globalToken1AfterResp?.value?.amount ?? "0");
    const globalLpAfter = new BN(globalLpAfterResp?.value?.amount ?? "0");

    const raydiumTokenVault0BalanceAfter =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault0!);

    const raydiumTokenVault1BalanceAfter =
      await provider.connection.getTokenAccountBalance(raydiumAccounts.tokenVault1!);

    console.log("Raydium Token Vault 0 Balance After: ", raydiumTokenVault0BalanceAfter.value.amount);
    console.log("Raydium Token Vault 1 Balance After: ", raydiumTokenVault1BalanceAfter.value.amount);


    const meteoraToken0VaultBalanceAfter =
      await provider.connection.getTokenAccountBalance(meteoraAccounts.tokenVault0);

    console.log("Meteora Token0 Vault Balance after: ", meteoraToken0VaultBalanceAfter.value.amount);

    const raydiumTokenVault0Delta = new BN(raydiumTokenVault0BalanceAfter.value.amount).sub(new BN(raydiumTokenVault0Balance.value.amount));
    const meteoraToken0VaultDelta = new BN(meteoraToken0VaultBalanceBefore.value.amount).sub(new BN(meteoraToken0VaultBalanceAfter.value.amount));

    assert.ok(raydiumTokenVault0Delta.eq(meteoraToken0VaultDelta), `Raydium vault0 delta mismatch: got ${raydiumTokenVault0Delta.toString()}, expected ${meteoraToken0VaultDelta.toString()}`);

    console.log("Global Token0 Before: ", globalToken0Before.toString());
    console.log("Global Token0 After: ", globalToken0After.toString());
    const deltaToken0 = globalToken0Before.sub(globalToken0After);
    assert.ok(deltaToken0.eq(new BN(0)), `DeltaToken0 mismatch: got ${deltaToken0.toString()}, expected 0`);

    console.log("Global Token1 Before: ", globalToken1Before.toString());
    console.log("Global Token1 After: ", globalToken1After.toString());
    const deltaToken1 = globalToken1Before.sub(globalToken1After);
    assert.ok(deltaToken1.eq(new BN(0)), `DeltaToken1 mismatch: got ${deltaToken1.toString()}, expected 0`);


    // It would usually not be emptied but in this case only one user has provided liquidity
    // so it would
    assert.ok(globalLpAfter.eq(new BN(0)), `Global LP was not emptied: got ${globalLpAfter.toString()}, expected 0`);

    console.log("User state pda: ", userStatePda.toBase58());

    const userStateAfter = await program.account.userState.fetch(userStatePda);
    console.log("Reached here");

    assert.ok(
      userStateAfter.amountDepositedIntoVault.eq(new BN(0)),
      `userState.amountDepositedIntoVault was not zeroed: got ${userStateAfter.amountDepositedIntoVault}, expected 0`
    );

    assert.ok(
      userStateAfter.lpAmount.eq(new BN(0)),
      `userState.lpAmount was not zeroed: got ${userStateAfter.lpAmount}, expected 0`
    );

    console.log("Reached here");

    const keeperAfter = await program.account.keeperState.fetch(keeperStatePda);

    console.log("Reached here");

    const beforeCredits = new BN(keeperBefore.credits ?? 0);
    const afterCredits = new BN(keeperAfter.credits ?? 0);

    const expectedDelta = new BN(globalStateBefore.creditsForDecreaseLiquidity ?? 0);

    assert.ok(
      afterCredits.eq(beforeCredits.add(expectedDelta)),
      `keeper credits mismatch: before=${beforeCredits.toString()} after=${afterCredits.toString()} expected=${expectedDelta.toString()}`
    );

    const mint = await getMint(provider.connection, meteoraAccounts.lpMint0!);
    assert.ok(mint.supply.toString() === "0", `LP mint supply was not zeroed: got ${mint.supply.toString()}, expected 0`);

  });  

  it("keeper increase liquidity failure: Already deployed", async () => {
    const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
      {
        vault: meteoraAccounts.vault0!,
        tokenVault: meteoraAccounts.tokenVault0!,
        lpMint: meteoraAccounts.lpMint0!,
        globalStateTokenAccount: globalStateToken0Account,
        globalStateLpAccount: globalStateLp0Account,
        meteoraProgramId: meteoraProgram.programId,
      },
      {
        nftAccount: userStateNftAccount,
        personalPosition: raydiumAccounts.personalPosition!,
        poolState: raydiumAccounts.poolState!,
        protocolPosition: raydiumAccounts.protocolPosition!,
        tokenVault0: raydiumAccounts.tokenVault0!,
        tokenVault1: raydiumAccounts.tokenVault1!,
        tickArrayLower: raydiumAccounts.tickArrayLower!,
        tickArrayUpper: raydiumAccounts.tickArrayUpper!,
        recipientTokenAccount0: globalStateToken0Account,
        recipientTokenAccount1: globalStateToken1Account,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        vault0Mint: mint0,
        vault1Mint: mint1,
        tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
        raydiumProgramId: raydiumAccounts.programId!,
      },
      globalStatePda
    );
    try {
      await program.methods
        .keeperIncreaseLiquidityPosition({ tokenAmountMin: new BN(0) })
        .accounts({
          keeperAccount:keeperStatePda,
          userStateAccount:userStatePda
        })
        .remainingAccounts(remainingAccounts)
        .rpc();
      assert.fail("This should have failed");
    } catch (error) {
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("positionnotdeployed"), `Unexpected error: ${msg}`);
    }
  });  
  
  it("Create new out of range position and decrease position", async() => {
    const userInfo = await createPositionWithPoolId(
      raydiumAccounts.poolState,
      14, 16);
      
    raydiumAccounts.nftMint = userInfo.nftMint;
    raydiumAccounts.nftAccount = userInfo.positionNftAccount;
    raydiumAccounts.tickArrayLower = userInfo.tickArrayLower;
    raydiumAccounts.tickArrayUpper = userInfo.tickArrayUpper;
    raydiumAccounts.personalPosition = userInfo.personalPosition;

    thresholdAmounts = await getTickThresholdFromPriceAndInfo(raydiumAccounts.poolState, 14, 16);

    userStatePda = PublicKey.findProgramAddressSync(
          [Buffer.from(USER_STATE_SEED), raydiumAccounts.nftMint.toBuffer()],
          program.programId
        )[0];    

    userStateNftAccount = 
      getAssociatedTokenAddressSync(raydiumAccounts.nftMint, userStatePda, true);    

    const remainingAccounts = buildRemainingAccountsForKeeperDecrease(
      {
        vault: meteoraAccounts.vault0!,
        tokenVault: meteoraAccounts.tokenVault0!,
        lpMint: meteoraAccounts.lpMint0!,
        globalStateTokenAccount: globalStateToken0Account,
        globalStateLpAccount: globalStateLp0Account,
        meteoraProgramId: meteoraProgram.programId,
      },
      {
        nftOwner: userStatePda,
        nftAccount: userStateNftAccount,
        personalPosition: raydiumAccounts.personalPosition!,
        poolState: raydiumAccounts.poolState!,
        protocolPosition: raydiumAccounts.protocolPosition!,
        tokenVault0: raydiumAccounts.tokenVault0!,
        tokenVault1: raydiumAccounts.tokenVault1!,
        tickArrayLower: raydiumAccounts.tickArrayLower!,
        tickArrayUpper: raydiumAccounts.tickArrayUpper!,
        recipientTokenAccount0: globalStateToken0Account,
        recipientTokenAccount1: globalStateToken1Account,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        memoProgram: MEMO_PROGRAM_ID,
        vault0Mint: mint0,
        vault1Mint: mint1,
        tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
        raydiumProgramId: raydiumAccounts.programId!,
      },
      globalStatePda
    );

    const tx = await program.methods.
      userCreatePositionFromRaydium({
        tickLowerIndexInThreshold:thresholdAmounts.tickLowerIndexInThreshold,
        tickUpperIndexInThreshold:thresholdAmounts.tickUpperIndexInThreshold,
        tickLowerIndexOutThreshold:thresholdAmounts.tickLowerIndexOutThreshold,
        tickUpperIndexOutThreshold:thresholdAmounts.tickUpperIndexOutThreshold
      }).
      accountsPartial({
        payer:adminKeypair.publicKey,
        user:userKeypair.publicKey,
        userMint:raydiumAccounts.nftMint,
        userTokenAccount:raydiumAccounts.nftAccount,
        positionState:raydiumAccounts.personalPosition,
        poolState:raydiumAccounts.poolState,
        globalState:globalStatePda,
        mint0Whitelist: getWhitelistPda(mint0),
        mint1Whitelist: getWhitelistPda(mint1),
        tokenProgram:TOKEN_PROGRAM_ID       
      }).
      signers([
        userKeypair
      ]).
      rpc();

    await program.methods
      .keeperDecreaseLiquidityPosition({ lpAmountMin: new BN(0) })
      .accounts({
        keeperAccount: keeperStatePda
      })
      .remainingAccounts(remainingAccounts)
      .rpc();
  });

  it("Close position failure: Invalid user", async ()=> {
    try {
      const invalidUser = Keypair.generate();

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
            {
              vault: meteoraAccounts.vault0!,
              tokenVault: meteoraAccounts.tokenVault0!,
              lpMint: meteoraAccounts.lpMint0!,
              globalStateTokenAccount: globalStateToken0Account,
              globalStateLpAccount: globalStateLp0Account,
              meteoraProgramId: meteoraProgram.programId,
            },
            {
              nftAccount: userStateNftAccount,
              personalPosition: raydiumAccounts.personalPosition!,
              poolState: raydiumAccounts.poolState!,
              protocolPosition: raydiumAccounts.protocolPosition!,
              tokenVault0: raydiumAccounts.tokenVault0!,
              tokenVault1: raydiumAccounts.tokenVault1!,
              tickArrayLower: raydiumAccounts.tickArrayLower!,
              tickArrayUpper: raydiumAccounts.tickArrayUpper!,
              recipientTokenAccount0: globalStateToken0Account,
              recipientTokenAccount1: globalStateToken1Account,
              tokenProgram: TOKEN_PROGRAM_ID,
              tokenProgram2022: TOKEN_2022_PROGRAM_ID,
              vault0Mint: mint0,
              vault1Mint: mint1,
              tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
              raydiumProgramId: raydiumAccounts.programId!,
            },
            globalStatePda
      );      

      await program.methods.
        userClosePosition({tokenAmountMin:new BN(0)}).
        accounts({
          user:invalidUser.publicKey,
          userState:userStatePda,
          userNftAccount:raydiumAccounts.nftAccount,
          userStateNftAccount,
          nftMint:raydiumAccounts.nftMint
        }).
        signers([
          invalidUser
        ]).
        remainingAccounts(remainingAccounts).
        rpc();

    }catch(err){
      const msg:string = err.toString().toLowerCase();
      assert.ok(msg.includes("unauthorizeduser"), `Unexpected error: ${msg}`);
    }
  });

  it("Close position failure: Invalid global state", async ()=> {
    try {
      const wrongGlobalState = Keypair.generate();

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: globalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        wrongGlobalState.publicKey
      );

      await program.methods.
        userClosePosition({tokenAmountMin:new BN(0)}).
        accounts({
          user:userKeypair.publicKey,
          userState:userStatePda,
          userNftAccount:raydiumAccounts.nftAccount,
          userStateNftAccount,
          nftMint:raydiumAccounts.nftMint
        }).
        signers([
          userKeypair
        ]).
        remainingAccounts(remainingAccounts).
        rpc();

    }catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("accountdiscriminatornotfound."), `Unexpected error: ${msg}`);
    }
  });

  it("Close position failure: Invalid global state raydium token ata", async ()=> {
    try {
      const wrongGlobalState = Keypair.generate();
      const wrongGlobalStateToken0Account = await createToken0Acccount(wrongGlobalState.publicKey);
      fundToken0Account(wrongGlobalStateToken0Account);

      const wrongGlobalStateToken1Account = await createToken1Acccount(wrongGlobalState.publicKey);
      fundToken1Account(wrongGlobalStateToken1Account);


      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: wrongGlobalStateToken0Account,
          recipientTokenAccount1: wrongGlobalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        userClosePosition({tokenAmountMin:new BN(0)}).
        accounts({
          user:userKeypair.publicKey,
          userState:userStatePda,
          userNftAccount:raydiumAccounts.nftAccount,
          userStateNftAccount,
          nftMint:raydiumAccounts.nftMint
        }).
        signers([
          userKeypair
        ]).
        remainingAccounts(remainingAccounts).
        rpc();

    }catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);
    }
  });
  
  it("Close position failure: Invalid global state lp ata", async ()=> {
    try {
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateLpAccount = 
        await createTokenAcccount(meteoraAccounts.lpMint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: globalStateToken0Account,
          globalStateLpAccount: wrongGlobalStateLpAccount,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        userClosePosition({tokenAmountMin:new BN(0)}).
        accounts({
          user:userKeypair.publicKey,
          userState:userStatePda,
          userNftAccount:raydiumAccounts.nftAccount,
          userStateNftAccount,
          nftMint:raydiumAccounts.nftMint
        }).
        signers([
          userKeypair
        ]).
        remainingAccounts(remainingAccounts).
        rpc();

    }catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);
    }
  });  

  it("Close position failure: Invalid global state meteora token0 ata", async ()=> {
    try {
      const wrongGlobalState = Keypair.generate();

      const wrongGlobalStateToken0Account = 
        await createTokenAcccount(mint0, wrongGlobalState.publicKey);

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
        {
          vault: meteoraAccounts.vault0!,
          tokenVault: meteoraAccounts.tokenVault0!,
          lpMint: meteoraAccounts.lpMint0!,
          globalStateTokenAccount: wrongGlobalStateToken0Account,
          globalStateLpAccount: globalStateLp0Account,
          meteoraProgramId: meteoraProgram.programId,
        },
        {
          nftAccount: userStateNftAccount,
          personalPosition: raydiumAccounts.personalPosition!,
          poolState: raydiumAccounts.poolState!,
          protocolPosition: raydiumAccounts.protocolPosition!,
          tokenVault0: raydiumAccounts.tokenVault0!,
          tokenVault1: raydiumAccounts.tokenVault1!,
          tickArrayLower: raydiumAccounts.tickArrayLower!,
          tickArrayUpper: raydiumAccounts.tickArrayUpper!,
          recipientTokenAccount0: globalStateToken0Account,
          recipientTokenAccount1: globalStateToken1Account,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vault0Mint: mint0,
          vault1Mint: mint1,
          tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
          raydiumProgramId: raydiumAccounts.programId!,
        },
        globalStatePda
      );

      await program.methods.
        userClosePosition({tokenAmountMin:new BN(0)}).
        accounts({
          user:userKeypair.publicKey,
          userState:userStatePda,
          userNftAccount:raydiumAccounts.nftAccount,
          userStateNftAccount,
          nftMint:raydiumAccounts.nftMint
        }).
        signers([
          userKeypair
        ]).
        remainingAccounts(remainingAccounts).
        rpc();

    }catch(error){
      const msg:string = error.toString().toLowerCase();
      assert.ok(msg.includes("invalidtokenaccount"), `Unexpected error: ${msg}`);
    }
  });  

  it("Close position success", async ()=> {
    try {

      const remainingAccounts = buildRemainingAccountsForKeeperIncrease(
            {
              vault: meteoraAccounts.vault0!,
              tokenVault: meteoraAccounts.tokenVault0!,
              lpMint: meteoraAccounts.lpMint0!,
              globalStateTokenAccount: globalStateToken0Account,
              globalStateLpAccount: globalStateLp0Account,
              meteoraProgramId: meteoraProgram.programId,
            },
            {
              nftAccount: userStateNftAccount,
              personalPosition: raydiumAccounts.personalPosition!,
              poolState: raydiumAccounts.poolState!,
              protocolPosition: raydiumAccounts.protocolPosition!,
              tokenVault0: raydiumAccounts.tokenVault0!,
              tokenVault1: raydiumAccounts.tokenVault1!,
              tickArrayLower: raydiumAccounts.tickArrayLower!,
              tickArrayUpper: raydiumAccounts.tickArrayUpper!,
              recipientTokenAccount0: globalStateToken0Account,
              recipientTokenAccount1: globalStateToken1Account,
              tokenProgram: TOKEN_PROGRAM_ID,
              tokenProgram2022: TOKEN_2022_PROGRAM_ID,
              vault0Mint: mint0,
              vault1Mint: mint1,
              tickArrayBitmap: raydiumAccounts.tickArrayBitmap!,
              raydiumProgramId: raydiumAccounts.programId!,
            },
            globalStatePda
      );      

      await program.methods.
        userClosePosition({tokenAmountMin:new BN(0)}).
        accounts({
          user:userKeypair.publicKey,
          userState:userStatePda,
          userNftAccount:raydiumAccounts.nftAccount,
          userStateNftAccount,
          nftMint:raydiumAccounts.nftMint
        }).
        signers([
          userKeypair
        ]).
        remainingAccounts(remainingAccounts).
        rpc();

    }catch(err){
      const msg:string = err.toString().toLowerCase();
      assert.ok(msg.includes("unauthorizeduser"), `Unexpected error: ${msg}`);
    }
  });  
});