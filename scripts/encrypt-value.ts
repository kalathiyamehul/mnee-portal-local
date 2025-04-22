#!/usr/bin/env bun
import { Command } from 'commander';
import { encryptKmsValue } from '@/lib/kms';

const program = new Command();

program
  .name('encrypt-value')
  .description('Encrypt a value using AWS KMS')
  .argument('<value>', 'The value to encrypt')
  .option('-q, --quiet', 'Only output the encrypted value')
  .option('-d, --description <description>', 'Description to identify the value (e.g. "MINT_WIF" or "BURN_WIF")')
  .action(async (value: string, options: { quiet: boolean, description?: string }) => {
    try {
      const encrypted = await encryptKmsValue(value, options.description);
      
      if (options.quiet) {
        console.log(encrypted);
      } else {
        console.log('\nEncrypted value:');
        console.log(encrypted);
        console.log('\nAdd this to your .env file:');
        if (options.description) {
          console.log(`ENCRYPTED_${options.description}=${encrypted}`);
        } else {
          console.log(`ENCRYPTED_MINT_WIF=${encrypted}`);
          console.log('# or');
          console.log(`ENCRYPTED_BURN_WIF=${encrypted}`);
        }
      }
    } catch (error) {
      console.error('\nError encrypting value:', error);
      process.exit(1);
    }
  });

program.parse(); 