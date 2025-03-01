use crate::types::PdaSeedConfig;
use log::info;
use solana_program::pubkey::Pubkey;
use std::collections::HashMap;
use std::str::FromStr;

/// Maps PDAs from one program ID to another
pub struct PdaRemapper {
    /// Original program ID
    original_program_id: Pubkey,

    /// New program ID
    new_program_id: Pubkey,

    /// PDA seed configurations
    pda_configs: Vec<PdaSeedConfig>,

    /// Cache of remapped addresses
    address_cache: HashMap<String, String>,
}

impl PdaRemapper {
    /// Create a new PDA remapper
    pub fn new(
        original_program_id: &str,
        new_program_id: &str,
        pda_configs: Vec<PdaSeedConfig>,
    ) -> anyhow::Result<Self> {
        let original = Pubkey::from_str(original_program_id)?;
        let new = Pubkey::from_str(new_program_id)?;

        Ok(Self {
            original_program_id: original,
            new_program_id: new,
            pda_configs,
            address_cache: HashMap::new(),
        })
    }

    /// Check if an address is a PDA of the original program and remap it
    pub fn remap_address(&self, address: &str) -> anyhow::Result<Option<String>> {
        // Check cache first
        if let Some(remapped) = self.address_cache.get(address) {
            return Ok(Some(remapped.clone()));
        }

        let address_pubkey = Pubkey::from_str(address)?;

        // Try each PDA configuration
        for config in &self.pda_configs {
            if config.seeds.iter().all(|s| !s.contains('{')) {
                // Handle static seeds (no parameters)
                if let Some(new_address) = self.try_static_pda(address, &address_pubkey, config)? {
                    return Ok(Some(new_address));
                }
            } else if config.name == "SpotMarket" {
                // Handle spot market PDAs
                if let Some(new_address) =
                    self.try_spot_market_pda(address, &address_pubkey, config)?
                {
                    return Ok(Some(new_address));
                }
            }
            // Add more specialized handlers for other PDA types as needed
        }

        // Not a PDA or not recognized
        Ok(None)
    }

    /// Try to remap a static PDA (no dynamic parameters)
    fn try_static_pda(
        &self,
        address: &str,
        address_pubkey: &Pubkey,
        config: &PdaSeedConfig,
    ) -> anyhow::Result<Option<String>> {
        let seeds: Vec<&[u8]> = config.seeds.iter().map(|s| s.as_bytes()).collect();

        // Use find_program_address to get the PDA and bump
        let (derived_address, _bump) =
            Pubkey::find_program_address(&seeds, &self.original_program_id);

        if derived_address == *address_pubkey {
            // Found a match! Now derive the new address with the same seeds
            let (new_address, _new_bump) =
                Pubkey::find_program_address(&seeds, &self.new_program_id);

            let new_address_str = new_address.to_string();
            info!(
                "Remapped static PDA {} to {} (type: {})",
                address, new_address_str, config.name
            );

            return Ok(Some(new_address_str));
        }

        Ok(None)
    }

    /// Try to remap a spot market PDA
    fn try_spot_market_pda(
        &self,
        address: &str,
        address_pubkey: &Pubkey,
        config: &PdaSeedConfig,
    ) -> anyhow::Result<Option<String>> {
        // Try market indices from 0 to 50 until we find a match
        let mut actual_market_index = None;

        for i in 0..50u16 {
            let market_index_bytes = i.to_le_bytes();

            // Replace {market_index} with the current test value
            let mut dynamic_seeds = Vec::new();
            for seed in &config.seeds {
                if seed == "{market_index}" {
                    dynamic_seeds.push(&market_index_bytes[..]);
                } else {
                    dynamic_seeds.push(seed.as_bytes());
                }
            }

            // Check if this market index produces the correct address
            let (derived_address, _) =
                Pubkey::find_program_address(&dynamic_seeds, &self.original_program_id);

            if derived_address == *address_pubkey {
                actual_market_index = Some(i);
                break;
            }
        }

        // If we found a matching market index, generate the new address
        if let Some(index) = actual_market_index {
            let index_bytes = index.to_le_bytes();

            // Reconstruct the seeds with the correct market index
            let mut new_seeds = Vec::new();
            for seed in &config.seeds {
                if seed == "{market_index}" {
                    new_seeds.push(&index_bytes[..]);
                } else {
                    new_seeds.push(seed.as_bytes());
                }
            }

            // Generate the new address with the new program ID
            let (new_address, _) = Pubkey::find_program_address(&new_seeds, &self.new_program_id);

            let new_address_str = new_address.to_string();
            info!(
                "Remapped spot market PDA {} to {} (market_index: {})",
                address, new_address_str, index
            );

            return Ok(Some(new_address_str));
        }

        Ok(None)
    }
}
