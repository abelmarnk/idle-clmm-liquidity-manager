/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/vault.json`.
 */
export type Vault = {
  "address": "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi",
  "metadata": {
    "name": "vault",
    "version": "0.9.3",
    "spec": "0.1.0"
  },
  "docs": [
    "Program for vault"
  ],
  "instructions": [
    {
      "name": "initialize",
      "docs": [
        "initialize new vault"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "This is base account for all vault",
            "No need base key now because we only allow 1 vault per token now",
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "payer",
          "docs": [
            "Payer can be anyone"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "Token vault account"
          ],
          "writable": true
        },
        {
          "name": "tokenMint",
          "docs": [
            "Token mint account"
          ]
        },
        {
          "name": "lpMint",
          "docs": [
            "LP mint account"
          ],
          "writable": true
        },
        {
          "name": "rent",
          "docs": [
            "rent"
          ]
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        },
        {
          "name": "systemProgram",
          "docs": [
            "systemProgram"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeIdleVault",
      "docs": [
        "initialize idle vault the vault that cannot be rebalanced"
      ],
      "discriminator": [
        100,
        187,
        43,
        147,
        149,
        180,
        117,
        223
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "payer",
          "docs": [
            "Payer can be anyone"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "Token vault account"
          ],
          "writable": true
        },
        {
          "name": "tokenMint",
          "docs": [
            "Token mint account"
          ]
        },
        {
          "name": "lpMint",
          "docs": [
            "LP mint"
          ],
          "writable": true
        },
        {
          "name": "rent",
          "docs": [
            "rent"
          ]
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        },
        {
          "name": "systemProgram",
          "docs": [
            "systemProgram"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "enableVault",
      "docs": [
        "enable vault"
      ],
      "discriminator": [
        145,
        82,
        241,
        156,
        26,
        154,
        233,
        211
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "admin",
          "docs": [
            "Admin account"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "enabled",
          "type": "u8"
        }
      ]
    },
    {
      "name": "setOperator",
      "docs": [
        "set new operator"
      ],
      "discriminator": [
        238,
        153,
        101,
        169,
        243,
        131,
        36,
        1
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "operator"
        },
        {
          "name": "admin",
          "docs": [
            "admin"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateLockedProfitDegradation",
      "docs": [
        "update locked profit degradation"
      ],
      "discriminator": [
        103,
        192,
        9,
        190,
        43,
        209,
        235,
        115
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "admin",
          "docs": [
            "Admin account"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "lockedProfitDegradation",
          "type": "u64"
        }
      ]
    },
    {
      "name": "getUnlockedAmount",
      "docs": [
        "get unlocked amount"
      ],
      "discriminator": [
        22,
        184,
        50,
        213,
        60,
        168,
        181,
        227
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "transferAdmin",
      "docs": [
        "transfer admin"
      ],
      "discriminator": [
        42,
        242,
        66,
        106,
        228,
        10,
        111,
        156
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "admin",
          "docs": [
            "Admin account"
          ],
          "signer": true
        },
        {
          "name": "newAdmin",
          "docs": [
            "New vault admin"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "transferFeeVault",
      "docs": [
        "transfer fee account"
      ],
      "discriminator": [
        24,
        18,
        129,
        149,
        149,
        32,
        45,
        105
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "admin",
          "docs": [
            "Admin account"
          ],
          "signer": true
        },
        {
          "name": "newFeeVault",
          "docs": [
            "New fee vault account"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "initializeStrategy",
      "docs": [
        "Initialize a strategy and add strategy to vault.strategies index"
      ],
      "discriminator": [
        208,
        119,
        144,
        145,
        178,
        57,
        105,
        252
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "strategyProgram"
        },
        {
          "name": "strategy",
          "docs": [
            "Strategy account"
          ],
          "writable": true
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault account"
          ],
          "writable": true
        },
        {
          "name": "collateralMint",
          "docs": [
            "Collateral mint account"
          ]
        },
        {
          "name": "admin",
          "docs": [
            "Admin account"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "docs": [
            "System program account"
          ]
        },
        {
          "name": "rent",
          "docs": [
            "Rent account"
          ]
        },
        {
          "name": "tokenProgram",
          "docs": [
            "Token program account"
          ]
        }
      ],
      "args": [
        {
          "name": "bumps",
          "type": {
            "defined": {
              "name": "strategyBumps"
            }
          }
        },
        {
          "name": "strategyType",
          "type": {
            "defined": {
              "name": "strategyType"
            }
          }
        }
      ]
    },
    {
      "name": "removeStrategy",
      "docs": [
        "remove a strategy"
      ],
      "discriminator": [
        185,
        238,
        33,
        91,
        134,
        210,
        97,
        26
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "strategy",
          "docs": [
            "Strategy account"
          ],
          "writable": true
        },
        {
          "name": "strategyProgram"
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault account"
          ],
          "writable": true
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "tokenVault"
          ],
          "writable": true
        },
        {
          "name": "feeVault",
          "docs": [
            "feeVault"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "lpMint"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        },
        {
          "name": "admin",
          "docs": [
            "admin"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "removeStrategy2",
      "docs": [
        "remove a strategy by advance payment"
      ],
      "discriminator": [
        138,
        104,
        208,
        148,
        126,
        35,
        195,
        14
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "Vault account"
          ],
          "writable": true
        },
        {
          "name": "strategy",
          "docs": [
            "Strategy account"
          ],
          "writable": true
        },
        {
          "name": "strategyProgram"
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault account"
          ],
          "writable": true
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "tokenVault"
          ],
          "writable": true
        },
        {
          "name": "tokenAdminAdvancePayment",
          "docs": [
            "token_advance_payemnt",
            "the owner of token_advance_payment must be admin"
          ],
          "writable": true
        },
        {
          "name": "tokenVaultAdvancePayment",
          "docs": [
            "tokenVaultAdvancePayment",
            "the account must be different from token_vault",
            "the owner of token_advance_payment must be vault"
          ],
          "writable": true
        },
        {
          "name": "feeVault",
          "docs": [
            "feeVault"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "lpMint"
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        },
        {
          "name": "admin",
          "docs": [
            "admin"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "maxAdminPayAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addStrategy",
      "docs": [
        "add a strategy"
      ],
      "discriminator": [
        64,
        123,
        127,
        227,
        192,
        234,
        198,
        20
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "vault"
          ],
          "writable": true
        },
        {
          "name": "strategy",
          "docs": [
            "strategy"
          ]
        },
        {
          "name": "admin",
          "docs": [
            "admin"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "depositStrategy",
      "docs": [
        "deposit liquidity to a strategy"
      ],
      "discriminator": [
        246,
        82,
        57,
        226,
        131,
        222,
        253,
        249
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "vault"
          ],
          "writable": true
        },
        {
          "name": "strategy",
          "docs": [
            "strategy"
          ],
          "writable": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "tokenVault"
          ],
          "writable": true
        },
        {
          "name": "feeVault",
          "docs": [
            "feeVault"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "lpMint"
          ],
          "writable": true
        },
        {
          "name": "strategyProgram"
        },
        {
          "name": "collateralVault",
          "docs": [
            "collateralVault"
          ],
          "writable": true
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        },
        {
          "name": "operator",
          "docs": [
            "operator"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawStrategy",
      "docs": [
        "withdraw liquidity from a strategy"
      ],
      "discriminator": [
        31,
        45,
        162,
        5,
        193,
        217,
        134,
        188
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "vault"
          ],
          "writable": true
        },
        {
          "name": "strategy",
          "docs": [
            "strategy"
          ],
          "writable": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "tokenVault"
          ],
          "writable": true
        },
        {
          "name": "feeVault",
          "docs": [
            "feeVault"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "lpMint"
          ],
          "writable": true
        },
        {
          "name": "strategyProgram"
        },
        {
          "name": "collateralVault",
          "docs": [
            "collateralVault"
          ],
          "writable": true
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        },
        {
          "name": "operator",
          "docs": [
            "operator"
          ],
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimRewards",
      "docs": [
        "claim rewards from a strategy"
      ],
      "discriminator": [
        4,
        144,
        132,
        71,
        116,
        23,
        151,
        80
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "vault"
          ]
        },
        {
          "name": "strategy",
          "docs": [
            "strategy"
          ]
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        },
        {
          "name": "tokenRewardAcc",
          "docs": [
            "tokenRewardAcc"
          ],
          "writable": true
        },
        {
          "name": "operator",
          "docs": [
            "operator"
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "docs": [
        "user deposit liquidity to vault"
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "vault"
          ],
          "writable": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "tokenVault"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "lpMint"
          ],
          "writable": true
        },
        {
          "name": "userToken",
          "docs": [
            "userToken"
          ],
          "writable": true
        },
        {
          "name": "userLp",
          "docs": [
            "userLp"
          ],
          "writable": true
        },
        {
          "name": "user",
          "docs": [
            "user"
          ],
          "signer": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        }
      ],
      "args": [
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "minimumLpTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "user withdraw liquidity from vault"
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "vault"
          ],
          "writable": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "tokenVault"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "lpMint"
          ],
          "writable": true
        },
        {
          "name": "userToken",
          "docs": [
            "userToken"
          ],
          "writable": true
        },
        {
          "name": "userLp",
          "docs": [
            "userLp"
          ],
          "writable": true
        },
        {
          "name": "user",
          "docs": [
            "user"
          ],
          "signer": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        }
      ],
      "args": [
        {
          "name": "unmintAmount",
          "type": "u64"
        },
        {
          "name": "minOutAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawDirectlyFromStrategy",
      "docs": [
        "user withdraw liquidity from vault, if vault reserve doesn't have enough liquidity, it will withdraw from the strategy firstly"
      ],
      "discriminator": [
        201,
        141,
        146,
        46,
        173,
        116,
        198,
        22
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "vault"
          ],
          "writable": true
        },
        {
          "name": "strategy",
          "docs": [
            "strategy"
          ],
          "writable": true
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "strategyProgram"
        },
        {
          "name": "collateralVault",
          "docs": [
            "collateralVault"
          ],
          "writable": true
        },
        {
          "name": "tokenVault",
          "docs": [
            "tokenVault"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "lpMint"
          ],
          "writable": true
        },
        {
          "name": "feeVault",
          "docs": [
            "feeVault"
          ],
          "writable": true
        },
        {
          "name": "userToken",
          "docs": [
            "userToken"
          ],
          "writable": true
        },
        {
          "name": "userLp",
          "docs": [
            "userLp"
          ],
          "writable": true
        },
        {
          "name": "user",
          "docs": [
            "user"
          ],
          "signer": true
        },
        {
          "name": "tokenProgram",
          "docs": [
            "tokenProgram"
          ]
        }
      ],
      "args": [
        {
          "name": "unmintAmount",
          "type": "u64"
        },
        {
          "name": "minOutAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    },
    {
      "name": "strategy",
      "discriminator": [
        174,
        110,
        39,
        119,
        82,
        106,
        169,
        102
      ]
    }
  ],
  "events": [
    {
      "name": "addLiquidity",
      "discriminator": [
        31,
        94,
        125,
        90,
        227,
        52,
        61,
        186
      ]
    },
    {
      "name": "removeLiquidity",
      "discriminator": [
        116,
        244,
        97,
        232,
        103,
        31,
        152,
        58
      ]
    },
    {
      "name": "strategyDeposit",
      "discriminator": [
        205,
        53,
        91,
        239,
        34,
        136,
        73,
        47
      ]
    },
    {
      "name": "strategyWithdraw",
      "discriminator": [
        120,
        76,
        208,
        95,
        221,
        210,
        229,
        189
      ]
    },
    {
      "name": "claimReward",
      "discriminator": [
        148,
        116,
        134,
        204,
        22,
        171,
        85,
        95
      ]
    },
    {
      "name": "performanceFee",
      "discriminator": [
        28,
        70,
        231,
        223,
        81,
        109,
        239,
        167
      ]
    },
    {
      "name": "reportLoss",
      "discriminator": [
        154,
        36,
        158,
        196,
        32,
        163,
        123,
        126
      ]
    },
    {
      "name": "totalAmount",
      "discriminator": [
        92,
        200,
        122,
        145,
        211,
        203,
        49,
        205
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "vaultIsDisabled",
      "msg": "Vault is disabled"
    },
    {
      "code": 6001,
      "name": "exceededSlippage",
      "msg": "Exceeded slippage tolerance"
    },
    {
      "code": 6002,
      "name": "strategyIsNotExisted",
      "msg": "Strategy is not existed"
    },
    {
      "code": 6003,
      "name": "unAuthorized",
      "msg": "unAuthorized"
    },
    {
      "code": 6004,
      "name": "mathOverflow",
      "msg": "Math operation overflow"
    },
    {
      "code": 6005,
      "name": "protocolIsNotSupported",
      "msg": "Protocol is not supported"
    },
    {
      "code": 6006,
      "name": "unMatchReserve",
      "msg": "Reserve does not support token mint"
    },
    {
      "code": 6007,
      "name": "invalidLockedProfitDegradation",
      "msg": "lockedProfitDegradation is invalid"
    },
    {
      "code": 6008,
      "name": "maxStrategyReached",
      "msg": "Maximum number of strategies have been reached"
    },
    {
      "code": 6009,
      "name": "strategyExisted",
      "msg": "Strategy existed"
    },
    {
      "code": 6010,
      "name": "invalidUnmintAmount",
      "msg": "Invalid unmint amount"
    },
    {
      "code": 6011,
      "name": "invalidAccountsForStrategy",
      "msg": "Invalid accounts for strategy"
    },
    {
      "code": 6012,
      "name": "invalidBump",
      "msg": "Invalid bump"
    },
    {
      "code": 6013,
      "name": "amountMustGreaterThanZero",
      "msg": "Amount must be greater than 0"
    },
    {
      "code": 6014,
      "name": "mangoIsNotSupportedAnymore",
      "msg": "Mango is not supported anymore"
    },
    {
      "code": 6015,
      "name": "strategyIsNotSupported",
      "msg": "Strategy is not supported"
    },
    {
      "code": 6016,
      "name": "payAmountIsExeeced",
      "msg": "Pay amount is exceeded"
    },
    {
      "code": 6017,
      "name": "feeVaultIsNotSet",
      "msg": "Fee vault is not set"
    },
    {
      "code": 6018,
      "name": "lendingAssertionViolation",
      "msg": "deposit amount in lending is not matched"
    },
    {
      "code": 6019,
      "name": "haveMoneyInLending",
      "msg": "Cannot remove strategy becase we have some in lending"
    },
    {
      "code": 6020,
      "name": "invalidPrecisionLoss",
      "msg": "Invalid precision loss"
    }
  ],
  "types": [
    {
      "name": "lockedProfitTracker",
      "docs": [
        "LockedProfitTracker struct"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lastUpdatedLockedProfit",
            "docs": [
              "The total locked profit from the last report"
            ],
            "type": "u64"
          },
          {
            "name": "lastReport",
            "docs": [
              "The last timestamp (in seconds) rebalancing"
            ],
            "type": "u64"
          },
          {
            "name": "lockedProfitDegradation",
            "docs": [
              "Rate per second of degradation"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultBumps",
      "docs": [
        "Vault bumps struct"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaultBump",
            "docs": [
              "vaultBump"
            ],
            "type": "u8"
          },
          {
            "name": "tokenVaultBump",
            "docs": [
              "tokenVaultBump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "strategyBumps",
      "docs": [
        "Strategy bumps struct"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "strategyIndex",
            "docs": [
              "strategyIndex"
            ],
            "type": "u8"
          },
          {
            "name": "otherBumps",
            "docs": [
              "Bumps of PDAs for the integrated protocol."
            ],
            "type": {
              "array": [
                "u8",
                10
              ]
            }
          }
        ]
      }
    },
    {
      "name": "strategyType",
      "docs": [
        "StrategyType struct"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "portFinanceWithoutLm"
          },
          {
            "name": "portFinanceWithLm"
          },
          {
            "name": "solendWithoutLm"
          },
          {
            "name": "mango"
          },
          {
            "name": "solendWithLm"
          },
          {
            "name": "apricotWithoutLm"
          },
          {
            "name": "francium"
          },
          {
            "name": "tulip"
          },
          {
            "name": "vault"
          },
          {
            "name": "drift"
          },
          {
            "name": "frakt"
          },
          {
            "name": "marginfi"
          },
          {
            "name": "kamino"
          }
        ]
      }
    },
    {
      "name": "vaultType",
      "docs": [
        "Vault type"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "idleVault"
          },
          {
            "name": "rebalanceVault"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "Vault struct"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "enabled",
            "docs": [
              "The flag, if admin set enable = false, then the user can only withdraw and cannot deposit in the vault."
            ],
            "type": "u8"
          },
          {
            "name": "bumps",
            "docs": [
              "Vault nonce, to create vault seeds"
            ],
            "type": {
              "defined": {
                "name": "vaultBumps"
              }
            }
          },
          {
            "name": "totalAmount",
            "docs": [
              "The total liquidity of the vault, including remaining tokens in token_vault and the liquidity in all strategies."
            ],
            "type": "u64"
          },
          {
            "name": "tokenVault",
            "docs": [
              "Token account, hold liquidity in vault reserve"
            ],
            "type": "pubkey"
          },
          {
            "name": "feeVault",
            "docs": [
              "Hold lp token of vault, each time rebalance crank is called, vault calculate performance fee and mint corresponding lp token amount to fee_vault. fee_vault is owned by treasury address"
            ],
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "docs": [
              "Token mint that vault supports"
            ],
            "type": "pubkey"
          },
          {
            "name": "lpMint",
            "docs": [
              "Lp mint of vault"
            ],
            "type": "pubkey"
          },
          {
            "name": "strategies",
            "docs": [
              "The list of strategy addresses that vault supports, vault can support up to MAX_STRATEGY strategies at the same time."
            ],
            "type": {
              "array": [
                "pubkey",
                30
              ]
            }
          },
          {
            "name": "base",
            "docs": [
              "The base address to create vault seeds"
            ],
            "type": "pubkey"
          },
          {
            "name": "admin",
            "docs": [
              "Admin of vault"
            ],
            "type": "pubkey"
          },
          {
            "name": "operator",
            "docs": [
              "Person who can send the crank. Operator can only send liquidity to strategies that admin defined, and claim reward to account of treasury address"
            ],
            "type": "pubkey"
          },
          {
            "name": "lockedProfitTracker",
            "docs": [
              "Stores information for locked profit."
            ],
            "type": {
              "defined": {
                "name": "lockedProfitTracker"
              }
            }
          }
        ]
      }
    },
    {
      "name": "strategy",
      "docs": [
        "Strategy struct"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "reserve",
            "docs": [
              "Lending pool address, that the strategy will deposit/withdraw balance"
            ],
            "type": "pubkey"
          },
          {
            "name": "collateralVault",
            "docs": [
              "The token account, that holds the collateral token"
            ],
            "type": "pubkey"
          },
          {
            "name": "strategyType",
            "docs": [
              "Specify type of strategy"
            ],
            "type": {
              "defined": {
                "name": "strategyType"
              }
            }
          },
          {
            "name": "currentLiquidity",
            "docs": [
              "The liquidity in strategy at the time vault deposit/withdraw from a lending protocol"
            ],
            "type": "u64"
          },
          {
            "name": "bumps",
            "docs": [
              "Hold some bumps, in case the strategy needs to use other seeds to sign a CPI call."
            ],
            "type": {
              "array": [
                "u8",
                10
              ]
            }
          },
          {
            "name": "vault",
            "docs": [
              "Vault address, that the strategy belongs"
            ],
            "type": "pubkey"
          },
          {
            "name": "isDisable",
            "docs": [
              "If we remove strategy by remove_strategy2 endpoint, this account will be never added again"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "addLiquidity",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lpMintAmount",
            "type": "u64"
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "removeLiquidity",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lpUnmintAmount",
            "type": "u64"
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "strategyDeposit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "strategyType",
            "type": {
              "defined": {
                "name": "strategyType"
              }
            }
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "strategyWithdraw",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "strategyType",
            "type": {
              "defined": {
                "name": "strategyType"
              }
            }
          },
          {
            "name": "collateralAmount",
            "type": "u64"
          },
          {
            "name": "estimatedTokenAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "claimReward",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "strategyType",
            "type": {
              "defined": {
                "name": "strategyType"
              }
            }
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          },
          {
            "name": "mintAccount",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "performanceFee",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lpMintMore",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "reportLoss",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "strategy",
            "type": "pubkey"
          },
          {
            "name": "loss",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "totalAmount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalAmount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
