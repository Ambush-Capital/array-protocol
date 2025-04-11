# Array Protocol

A Solana program built with the Anchor framework that implements array-based functionality on the Solana blockchain.

## Overview

Array Protocol is a Solana program that provides array manipulation capabilities on the blockchain. The program is built using the Anchor framework, making it secure and easy to interact with.

## Prerequisites

- Rust and Cargo
- Solana CLI tools
- Anchor Framework (v0.30.1)
- Node.js and npm (for client interactions)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/array-protocol.git
cd array-protocol
```

2. Make sure anchor version is 0.30.1 on specific commit:
avm install 0.31.0

3. Build the program:
```bash
anchor build
```

4. Deploy to your desired Solana cluster:
```bash
anchor deploy

5. For local stuff
COPYFILE_DISABLE=1 solana-test-validator
Make sure that the version is 3 for Cargo.lock
solana-keygen pubkey target/deploy/array_protocol-keypair.json
```


## Program Structure

The program is organized as a Cargo workspace with the following structure:

```
array-protocol/
├── programs/
│   └── array-protocol/     # Main program code
├── Anchor.toml             # Anchor configuration
├── Cargo.toml             # Workspace configuration
└── README.md
```

## Program ID

The program is deployed with the following ID:
```
3mGJZ2tU1Pgnhdy7gN2YRh6eFutwAGxezUmjrDUJFcts
```

## Features

- Initialize program state
- More features coming soon...

## Development

To contribute to the development:

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the terms specified in the LICENSE file.

## Contact

For questions and support, please open an issue in the GitHub repository.


need direnv