use anchor_lang::prelude::*;

declare_id!("3mGJZ2tU1Pgnhdy7gN2YRh6eFutwAGxezUmjrDUJFcts");

#[program]
pub mod array_protocol {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
