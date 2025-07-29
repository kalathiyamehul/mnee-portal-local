// import { APPROVER_PUBKEY, getMintWif, MNEE_API, MNEE_WEBHOOK_API } from '@/env';
// import { createMintOp } from '@/new-cosiner/src/services/mint';
// import { PrivateKey, PublicKey } from '@bsv/sdk';
// import { PrismaClient } from '@prisma/client';
// import { Command } from 'commander';
// import * as readline from 'readline';

// const prisma = new PrismaClient();
// const program = new Command();

// // Create readline interface for user input
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// // Helper function to prompt for user input
// function askQuestion(question: string): Promise<string> {
//   return new Promise((resolve) => {
//     rl.question(question, (answer) => {
//       resolve(answer);
//     });
//   });
// }

// program
//   .name('approve')
//   .description('Approve various types of requests')
//   .requiredOption('-t, --type <type>', 'Type of request (mint, burn, etc)')
//   .requiredOption('-i, --id <id>', 'Request ID')
//   .requiredOption('-u, --user <userId>', 'User ID to approve as')
//   .parse(process.argv);

// const opts = program.opts();

// async function approveMint() {
//   try {
//     const amount = BigInt(1000000000000000000);
    
//     // Prompt for current available supply
//     const currectAvailableSupplyInput = await askQuestion('Enter current available supply (default: 18000000000000000000): ');
//     const currectAvailableSupply = currectAvailableSupplyInput.trim();
    
//     // Prompt for webhook URL
//     const webhookUrlInput = await askQuestion('Enter webhook URL (default: ' + MNEE_WEBHOOK_API + '/api/webhook): ');
//     const webhookUrl = webhookUrlInput.trim() 
//       ? webhookUrlInput.trim() 
//       : `${MNEE_WEBHOOK_API}/api/webhook`;
    
//     console.log(`Using current available supply: ${currectAvailableSupply}`);
//     console.log(`Using webhook URL: ${webhookUrl}`);
    
//     // find totalSupply // 400000 no of token already minted
//     const totalSupplyDatabase = await prisma.mintRequest.aggregate({
//         where: {
//           status: 'DONE'
//         },
//         _sum: {
//           amount: true
//         }
//     })
//     const totalSupply = totalSupplyDatabase._sum.amount || BigInt(0);
//     // create mint op
//     const config = await prisma.config.findFirst();
//     if (!config) {
//       throw new Error("Config not found");
//     }
//     const mintPk = PrivateKey.fromWif(await getMintWif());
//     const approverPk = PublicKey.fromString(APPROVER_PUBKEY);
//     const latestDeployTokenTxOp = 1;
//     const address = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
//     const response = await createMintOp(
//       amount,
//       config.latestMinterTx,
//       latestDeployTokenTxOp,
//       address,
//       config.tokenId,
//       mintPk,
//       approverPk,
//       totalSupply,
//       BigInt(currectAvailableSupply),
//       config.mintAddress
//     );
//     const payload = {
//       rawtx: Buffer.from(response.txHex, 'hex').toString('base64'),
//       callback_url: webhookUrl,
//     }
//     console.log(payload)
//     try {
//       const res = await fetch(`https://dev-api-cosigner.mnee.net/v1/mint`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(payload),
//       });

//       const data = await res.json();
//       console.log("Mint Response:", data);
//       if (data?.error) {
//         return {
//           rawtx: "",
//           success: false,
//           error: data?.error
//         };
//       }
//       return {
//         rawtx: data,
//         success: true
//       };
//     } catch (error) {
//       return {
//         rawtx: "",
//         success: false,
//         error: error?.toString()
//       };
//     }
//   } catch (error) {
//     console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
//     process.exit(1);
//   } finally {
//     await prisma.$disconnect();
//     rl.close();
//   }
// }

// async function main() {
//     await approveMint();
// }

// main(); 