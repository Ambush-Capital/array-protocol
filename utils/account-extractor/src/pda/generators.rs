//! PDA generator functionality

use super::derivation::find_program_address;
use super::types::{PdaInfo, PdaType};
use solana_program::pubkey::Pubkey;

/// Generator for Program Derived Addresses (PDAs)
#[derive(Debug, Clone)]
pub struct PdaGenerator {
    /// Program ID to derive PDAs for
    program_id: Pubkey,
}

impl PdaGenerator {
    /// Create a new PDA generator for the given program ID
    pub fn new(program_id: &Pubkey) -> Self {
        Self {
            program_id: *program_id,
        }
    }

    /// Generate a PDA for the specified type
    pub fn find_pda(&self, pda_type: PdaType) -> PdaInfo {
        match pda_type {
            PdaType::State => self.find_state_pda(),
            PdaType::SpotMarket { market_index } => self.find_spot_market_pda(market_index),
            PdaType::SpotMarketVault { market_index } => {
                self.find_spot_market_vault_pda(market_index)
            }
            PdaType::DriftSigner => self.find_drift_signer_pda(),
        }
    }

    /// Find the State PDA
    pub fn find_state_pda(&self) -> PdaInfo {
        let seed = b"drift_state";
        let seeds = &[&seed[..]];
        let (address, _) = find_program_address(seeds, &self.program_id);

        PdaInfo { address }
    }

    /// Find the Spot Market PDA for a given market index
    pub fn find_spot_market_pda(&self, market_index: u16) -> PdaInfo {
        let prefix = b"spot_market";
        let market_index_bytes = market_index.to_le_bytes();
        let seeds = &[&prefix[..], &market_index_bytes[..]];

        let (address, _) = find_program_address(seeds, &self.program_id);

        PdaInfo { address }
    }

    /// Find the Spot Market Vault PDA for a given market index
    pub fn find_spot_market_vault_pda(&self, market_index: u16) -> PdaInfo {
        let prefix = b"spot_market_vault";
        let market_index_bytes = market_index.to_le_bytes();
        let seeds = &[&prefix[..], &market_index_bytes[..]];

        let (address, _) = find_program_address(seeds, &self.program_id);

        PdaInfo { address }
    }

    /// Find the Drift Signer PDA
    pub fn find_drift_signer_pda(&self) -> PdaInfo {
        let seed = b"drift_signer";
        let seeds = &[&seed[..]];
        let (address, _) = find_program_address(seeds, &self.program_id);

        PdaInfo { address }
    }
}
