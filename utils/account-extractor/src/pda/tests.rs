#[cfg(test)]
mod tests {
    use super::*;
    use solana_program::pubkey::Pubkey;
    use std::str::FromStr;

    const ORIGINAL_PROGRAM_ID: &str = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";
    const NEW_PROGRAM_ID: &str = "DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo";

    #[test]
    fn test_pda_generator() {
        let program_id = Pubkey::from_str(ORIGINAL_PROGRAM_ID).unwrap();
        let generator = PdaGenerator::new(&program_id);
        
        // Test State PDA
        let state_pda = generator.find_state_pda();
        assert_eq!(state_pda.seeds, vec![b"drift_state".to_vec()]);
        
        // Test SpotMarket PDA
        let market_index = 0;
        let spot_market_pda = generator.find_spot_market_pda(market_index);
        assert_eq!(
            spot_market_pda.seeds, 
            vec![b"spot_market".to_vec(), market_index.to_le_bytes().to_vec()]
        );
        
        // Test SpotMarketVault PDA
        let vault_pda = generator.find_spot_market_vault_pda(market_index);
        assert_eq!(
            vault_pda.seeds, 
            vec![b"spot_market_vault".to_vec(), market_index.to_le_bytes().to_vec()]
        );
        
        // Test DriftSigner PDA
        let signer_pda = generator.find_drift_signer_pda();
        assert_eq!(signer_pda.seeds, vec![b"drift_signer".to_vec()]);
    }
    
    #[test]
    fn test_pda_remapper() {
        // Create PDA configs
        let pda_configs = vec![
            PdaSeedConfig {
                name: "State".to_string(),
                seeds: vec!["drift_state".to_string()],
            },
            PdaSeedConfig {
                name: "SpotMarket".to_string(),
                seeds: vec!["spot_market".to_string(), "{market_index}".to_string()],
            },
        ];
        
        // Create remapper
        let remapper = PdaRemapper::new(ORIGINAL_PROGRAM_ID, NEW_PROGRAM_ID, pda_configs).unwrap();
        
        // Generate original PDAs
        let original_generator = PdaGenerator::from_str(ORIGINAL_PROGRAM_ID).unwrap();
        let state_pda = original_generator.find_state_pda();
        let state_address = state_pda.address.to_string();
        
        // Test remapping
        let remapped_state = remapper.remap_address(&state_address).unwrap();
        assert!(remapped_state.is_some());
        
        // Check that the remapped address is different
        assert_ne!(remapped_state.unwrap(), state_address);
        
        // Test market PDA
        let market_pda = original_generator.find_spot_market_pda(0);
        let market_address = market_pda.address.to_string();
        
        let remapped_market = remapper.remap_address(&market_address).unwrap();
        assert!(remapped_market.is_some());
        assert_ne!(remapped_market.unwrap(), market_address);
    }
    
    #[test]
    fn test_extract_market_index() {
        let program_id = Pubkey::from_str(ORIGINAL_PROGRAM_ID).unwrap();
        let generator = PdaGenerator::new(&program_id);
        
        // Generate a SpotMarket PDA for market index 3
        let market_index = 3;
        let pda_info = generator.find_spot_market_pda(market_index);
        
        // Extract the market index from the PDA
        let extracted_index = extract_market_index(
            &pda_info.address, 
            &program_id, 
            b"spot_market", 
            10
        );
        
        assert_eq!(extracted_index, Some(market_index));
    }
} 