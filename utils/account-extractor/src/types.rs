use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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
