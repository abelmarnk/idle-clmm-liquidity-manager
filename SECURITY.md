# Security

## Committed Keypairs

The `tests/keys/` directory contains JSON keypairs that are committed to this repository intentionally:

- `tests/keys/devnet-authority.json` - the test deployer / program admin wallet
- `tests/keys/devnet-keeper.json` - the test keeper wallet

These keypairs exist on Solana **devnet only**. They hold no mainnet funds and have no access to any production system. They are committed so that the Anchor integration test suite can be run by anyone without additional setup.

## Reporting a Vulnerability

If you discover a genuine security issue in the on-chain program logic - such as an incorrect permission check, an arithmetic flaw, or an account validation bypass - please report it by emailing the repository owner directly. Do not open a public issue for sensitive findings.
