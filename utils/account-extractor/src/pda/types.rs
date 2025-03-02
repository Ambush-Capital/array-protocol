//! PDA type definitions

use serde::{Deserialize, Serialize};
use solana_program::pubkey::Pubkey;

/// Enum representing different types of PDAs
#[derive(Debug, Clone, PartialEq)]
pub enum PdaType {
    /// Program state PDA
    State,
    /// Spot market PDA with market index
    SpotMarket { market_index: u16 },
    /// Spot market vault PDA with market index
    SpotMarketVault { market_index: u16 },
    /// Drift program signer PDA
    DriftSigner,
}

/// Information about a derived PDA
#[derive(Debug, Clone)]
pub struct PdaInfo {
    /// The derived PDA address
    pub address: Pubkey,
}

/// Configuration for PDA seed remapping
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PdaSeedConfig {
    /// Name of the PDA type (for logging)
    pub name: String,
    /// Seeds used to derive the PDA
    pub seeds: Vec<String>,
}
