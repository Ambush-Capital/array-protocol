pub mod admin_hot_wallet {
    use anchor_lang::solana_program::declare_id;

    declare_id!("E9rpsfTJQph6Ev4TeEgRubGBaPUbJuoD1VsEYbfqaFXZ");
}

pub mod drift {
    use anchor_lang::solana_program::declare_id;
    #[cfg(feature = "devnet")]
    declare_id!("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"); // Devnet ID
    #[cfg(not(feature = "devnet"))]
    declare_id!("DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo"); // Local ID
}
