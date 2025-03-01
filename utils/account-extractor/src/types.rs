use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Metadata about the extraction
#[derive(Serialize, Deserialize)]
pub struct ExtractionMetadata {
    /// Program ID that was extracted
    pub drift: String,

    /// USDC mint address
    pub usdc: String,

    /// Timestamp when extraction was performed
    pub extracted_at: DateTime<Utc>,
}

/// Configuration for program extraction
#[derive(Clone, Debug)]
pub struct ProgramExtractorConfig {
    /// Discriminators to filter accounts by
    pub discriminators: Vec<[u8; 8]>,

    /// New program ID to replace the original owner with
    pub new_program_id: Option<String>,

    /// PDA seeds to remap
    pub pda_seeds: Vec<PdaSeedConfig>,

    /// Token account remappings
    pub token_remappings: HashMap<String, TokenAccountRemapping>,
}

/// Configuration for PDA seed remapping
#[derive(Clone, Debug)]
pub struct PdaSeedConfig {
    /// Name of the PDA type (for logging)
    pub name: String,

    /// Seeds used to derive the PDA
    pub seeds: Vec<String>,
}

/// Represents account data extracted from Solana
#[derive(Serialize, Deserialize)]
pub struct AccountData {
    /// Account public key
    pub pubkey: String,

    /// Owner program ID
    pub owner: String,

    /// Whether the account is executable
    pub executable: bool,

    /// Account balance in lamports
    pub lamports: u64,

    /// Account data as base64 encoded string
    pub data: String,

    /// Rent epoch
    pub rent_epoch: u64,
}

/// Configuration for remapping token accounts
#[derive(Clone, Debug)]
pub struct TokenAccountRemapping {
    /// The original token account address we're looking for
    pub original_address: String,

    /// The new owner to assign to this token account
    pub new_owner: Option<String>,

    /// PDA configuration for generating the new address
    pub pda_config: Option<PdaSeedConfig>,

    /// Optional market index if we already know it
    pub market_index: Option<u16>,

    /// Optional reference to another account (like a SpotMarket)
    /// that contains the market index we need
    pub market_reference_account: Option<String>,
}
